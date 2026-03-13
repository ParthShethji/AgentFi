// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ReputationManager.sol";

/**
 * @title AgentFiLending
 * @notice Under-collateralised P2P lending for AI agents.
 *
 *  Key invariants enforced here:
 *  1. Collateral = continuous curve from ReputationManager — no binary cliff.
 *  2. Anti-exploit: lender.userId == borrower.userId → HARD REJECT.
 *  3. Loan terms (size, collateral, rate floor) are read from ReputationManager
 *     at match time — snapshot into the Loan struct for immutability.
 *  4. Late / partial / default events feed back to ReputationManager.
 *  5. Rolling volume gate is handled off-chain (BitGo/multisig layer).
 *     This contract records the settled amounts for auditability.
 */
contract AgentFiLending is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant MATCHER_ROLE  = keccak256("MATCHER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");

    // ─── Immutables ──────────────────────────────────────────────────────────
    IERC20             public immutable usdc;
    ReputationManager  public immutable repManager;

    // ─── Config ──────────────────────────────────────────────────────────────
    uint256 public loanDuration      = 30 days;   // default term
    uint256 public lateGracePeriod   = 3 days;    // before "late" penalty
    uint256 public partialThreshold  = 8000;      // 80% in bps = partial repay cutoff
    uint256 public platformFeeBps    = 50;        // 0.5% platform cut on interest

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum LoanStatus { Active, Repaid, Late, Partial, Defaulted }
    enum OrderStatus { Open, Matched, Cancelled, Expired }

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct LendOffer {
        bytes32     offerId;
        bytes32     lenderAgentId;
        uint256     maxAmount;        // USDC (6 dec)
        uint256     interestRateBps;  // e.g. 200 = 2%
        uint256     minRepRequired;   // 0–50
        uint256     expiresAt;
        OrderStatus status;
    }

    struct BorrowRequest {
        bytes32     requestId;
        bytes32     borrowerAgentId;
        uint256     requestedAmount;  // USDC (6 dec)
        uint256     expiresAt;
        OrderStatus status;
    }

    struct Loan {
        bytes32     loanId;
        bytes32     lenderAgentId;
        bytes32     borrowerAgentId;
        uint256     principal;          // USDC
        uint256     collateralLocked;   // USDC locked from borrower
        uint256     interestRateBps;    // agreed rate
        uint256     collateralBpsSnap;  // collateral % at origination
        uint256     repSnap;            // rep score at origination
        uint256     issuedAt;
        uint256     dueAt;
        uint256     repaidAt;
        uint256     amountRepaid;
        LoanStatus  status;
    }

    // ─── Storage ─────────────────────────────────────────────────────────────
    mapping(bytes32 => LendOffer)    public lendOffers;
    mapping(bytes32 => BorrowRequest) public borrowRequests;
    mapping(bytes32 => Loan)         public loans;

    // lenderAgentId → escrowed USDC locked with their open offers
    mapping(bytes32 => uint256) public escrowedFunds;

    // agentId → active loan id (0 = none)  — one active loan per agent
    mapping(bytes32 => bytes32) public activeLoan;

    uint256 public totalLoansIssued;
    uint256 public totalDefaulted;

    // ─── Events ──────────────────────────────────────────────────────────────
    event LendOfferPosted(bytes32 indexed offerId, bytes32 indexed lenderAgentId, uint256 amount, uint256 rateBps, uint256 minRep);
    event LendOfferCancelled(bytes32 indexed offerId, bytes32 indexed lenderAgentId);
    event BorrowRequestPosted(bytes32 indexed requestId, bytes32 indexed borrowerAgentId, uint256 amount);
    event LoanOriginated(bytes32 indexed loanId, bytes32 indexed lenderAgentId, bytes32 indexed borrowerAgentId, uint256 principal, uint256 collateral, uint256 rateBps, uint256 repSnap);
    event LoanRepaid(bytes32 indexed loanId, uint256 amountRepaid, LoanStatus status);
    event LoanDefaulted(bytes32 indexed loanId, bytes32 indexed borrowerAgentId, uint256 collateralSeized);
    event SelfMatchRejected(bytes32 indexed offerId, bytes32 indexed requestId, bytes32 userId);
    event CollateralDeposited(bytes32 indexed agentId, uint256 amount);
    event CollateralReleased(bytes32 indexed agentId, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _usdc, address _repManager) {
        usdc       = IERC20(_usdc);
        repManager = ReputationManager(_repManager);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LEND SIDE — post / cancel offers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Lender agent posts a lending offer. Funds are escrowed immediately.
     *         Lender pays −1 rep if they cancel (enforced in cancelLendOffer).
     * @param lenderAgentId  hashed agent UUID
     * @param amount         USDC to lend
     * @param interestRateBps offered rate (must be ≥ borrower's floor at match time)
     * @param minRepRequired  minimum rep the borrower must have
     * @param duration        validity window in seconds
     */
    function postLendOffer(
        bytes32 lenderAgentId,
        uint256 amount,
        uint256 interestRateBps,
        uint256 minRepRequired,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32 offerId) {
        require(amount > 0, "Amount must be > 0");
        require(interestRateBps > 0, "Rate must be > 0");
        require(minRepRequired <= 50, "Rep cap is 50");
        require(duration > 0 && duration <= 365 days, "Invalid duration");
        require(repManager.getUserId(lenderAgentId) != bytes32(0), "Lender not registered");
        require(activeLoan[lenderAgentId] == bytes32(0), "Agent has active loan");

        offerId = keccak256(abi.encodePacked(lenderAgentId, amount, block.timestamp, block.prevrandao));

        lendOffers[offerId] = LendOffer({
            offerId:          offerId,
            lenderAgentId:    lenderAgentId,
            maxAmount:        amount,
            interestRateBps:  interestRateBps,
            minRepRequired:   minRepRequired,
            expiresAt:        block.timestamp + duration,
            status:           OrderStatus.Open
        });

        // Escrow funds immediately
        escrowedFunds[lenderAgentId] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit LendOfferPosted(offerId, lenderAgentId, amount, interestRateBps, minRepRequired);
    }

    /**
     * @notice Cancel an open lend offer. Funds returned, −1 rep applied.
     */
    function cancelLendOffer(bytes32 offerId) external nonReentrant {
        LendOffer storage offer = lendOffers[offerId];
        require(offer.status == OrderStatus.Open, "Offer not open");
        // Caller must control the lender agent (validated via userId mapping off-chain;
        // here we require msg.sender to be the registered wallet for that agent)
        _requireAgentCaller(offer.lenderAgentId);

        offer.status = OrderStatus.Cancelled;
        escrowedFunds[offer.lenderAgentId] -= offer.maxAmount;
        usdc.safeTransfer(msg.sender, offer.maxAmount);

        // Cancel penalty — direct call to RepManager
        repManager.applyLateDelta(offer.lenderAgentId); // reuse −2 is too harsh; TODO: add CANCEL role delta
        emit LendOfferCancelled(offerId, offer.lenderAgentId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  BORROW SIDE — post request
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Borrower agent posts a borrow request.
     *         Collateral is collected here based on real-time rep curve.
     * @param borrowerAgentId hashed agent UUID
     * @param amount          requested USDC
     * @param duration        desired term in seconds
     */
    function postBorrowRequest(
        bytes32 borrowerAgentId,
        uint256 amount,
        uint256 duration
    ) external nonReentrant whenNotPaused returns (bytes32 requestId) {
        require(amount > 0, "Amount must be > 0");
        require(repManager.getUserId(borrowerAgentId) != bytes32(0), "Borrower not registered");
        require(activeLoan[borrowerAgentId] == bytes32(0), "Agent has active loan");
        require(amount <= repManager.maxLoanUsdc(borrowerAgentId), "Exceeds rep-based loan limit");
        require(duration > 0 && duration <= 365 days, "Invalid duration");

        requestId = keccak256(abi.encodePacked(borrowerAgentId, amount, block.timestamp, block.prevrandao));

        borrowRequests[requestId] = BorrowRequest({
            requestId:       requestId,
            borrowerAgentId: borrowerAgentId,
            requestedAmount: amount,
            expiresAt:       block.timestamp + duration,
            status:          OrderStatus.Open
        });

        // Collect collateral upfront (may be 0 for high-rep agents)
        uint256 colBps = repManager.collateralBps(borrowerAgentId);
        uint256 collateral = _calcCollateral(amount, colBps);
        if (collateral > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), collateral);
            emit CollateralDeposited(borrowerAgentId, collateral);
        }

        // Store collateral in loan placeholder — will be linked at match
        // Using escrow map for borrower pending collateral
        escrowedFunds[borrowerAgentId] += collateral;

        emit BorrowRequestPosted(requestId, borrowerAgentId, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  MATCHING ENGINE  (called by off-chain matcher service via MATCHER_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a matched loan from a lend offer and borrow request.
     *
     *         Anti-exploit check: lender.userId == borrower.userId → REJECT.
     *         Rate check: offered rate must be ≥ borrower's interest floor.
     *         Rep check: borrower rep must meet lender's minRepRequired.
     *
     * @param offerId    matched lend offer
     * @param requestId  matched borrow request
     */
    function matchAndOriginate(
        bytes32 offerId,
        bytes32 requestId
    ) external nonReentrant whenNotPaused onlyRole(MATCHER_ROLE) returns (bytes32 loanId) {
        LendOffer    storage offer   = lendOffers[offerId];
        BorrowRequest storage request = borrowRequests[requestId];

        // ── Sanity checks ────────────────────────────────────────────────────
        require(offer.status   == OrderStatus.Open, "Offer not open");
        require(request.status == OrderStatus.Open, "Request not open");
        require(block.timestamp < offer.expiresAt,   "Offer expired");
        require(block.timestamp < request.expiresAt, "Request expired");

        bytes32 lenderAgentId   = offer.lenderAgentId;
        bytes32 borrowerAgentId = request.borrowerAgentId;

        // ── ANTI-EXPLOIT: hard block same-user matching ───────────────────────
        bytes32 lenderUserId   = repManager.getUserId(lenderAgentId);
        bytes32 borrowerUserId = repManager.getUserId(borrowerAgentId);
        if (lenderUserId == borrowerUserId) {
            emit SelfMatchRejected(offerId, requestId, lenderUserId);
            revert("Self-match: same user agents cannot match");
        }

        uint256 borrowerRep = repManager.getScore(borrowerAgentId);

        // ── Rep gate ─────────────────────────────────────────────────────────
        require(borrowerRep >= offer.minRepRequired, "Borrower rep below offer minimum");

        // ── Amount gate ──────────────────────────────────────────────────────
        uint256 principal = request.requestedAmount;
        require(principal <= offer.maxAmount, "Borrow exceeds offer max");
        require(principal <= repManager.maxLoanUsdc(borrowerAgentId), "Exceeds rep loan limit");

        // ── Rate gate: offered rate ≥ borrower interest floor ────────────────
        uint256 floorBps = repManager.interestFloorBps(borrowerAgentId);
        require(offer.interestRateBps >= floorBps, "Rate below borrower floor");

        // ── Snapshot collateral at origination ──────────────────────────────
        uint256 colBps       = repManager.collateralBps(borrowerAgentId);
        uint256 collateral   = escrowedFunds[borrowerAgentId]; // collected at request time
        uint256 expectedCol  = _calcCollateral(principal, colBps);

        // Validate borrower deposited correct collateral
        require(collateral >= expectedCol, "Insufficient collateral deposited");

        // ── Create loan record ───────────────────────────────────────────────
        loanId = keccak256(abi.encodePacked(offerId, requestId, block.timestamp));
        uint256 dueAt = block.timestamp + loanDuration;

        loans[loanId] = Loan({
            loanId:             loanId,
            lenderAgentId:      lenderAgentId,
            borrowerAgentId:    borrowerAgentId,
            principal:          principal,
            collateralLocked:   collateral,
            interestRateBps:    offer.interestRateBps,
            collateralBpsSnap:  colBps,
            repSnap:            borrowerRep,
            issuedAt:           block.timestamp,
            dueAt:              dueAt,
            repaidAt:           0,
            amountRepaid:       0,
            status:             LoanStatus.Active
        });

        // ── Update state ─────────────────────────────────────────────────────
        offer.status           = OrderStatus.Matched;
        request.status         = OrderStatus.Matched;
        activeLoan[borrowerAgentId] = loanId;
        activeLoan[lenderAgentId]   = loanId;

        escrowedFunds[borrowerAgentId]  = 0;          // collateral now in loan
        escrowedFunds[lenderAgentId]   -= principal;  // lender escrow reduced

        totalLoansIssued++;

        // Transfer principal to borrower's wallet (agent wallet addr must be registered)
        // In production this is the 2-of-2 multisig wallet — platform passes it via off-chain
        // For now we emit and the platform bridges the transfer
        emit LoanOriginated(loanId, lenderAgentId, borrowerAgentId, principal, collateral, offer.interestRateBps, borrowerRep);

        // Send principal to borrower wallet (agent wallet address stored off-chain, platform handles)
        // Direct transfer handled by platform layer post-event
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  REPAYMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Repay a loan. Handles on-time full repay, late repay, and partial repay.
     *         Collateral is released proportionally. Rep updated accordingly.
     *
     * @param loanId        loan to repay
     * @param amountPaid    USDC amount the borrower is sending
     * @param profitGenerated  true if Elsa generated profit this cycle (affects +2 vs +1 delta)
     */
    function repay(
        bytes32 loanId,
        uint256 amountPaid,
        bool profitGenerated
    ) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active || loan.status == LoanStatus.Late, "Loan not repayable");

        // Collect repayment
        usdc.safeTransferFrom(msg.sender, address(this), amountPaid);

        loan.amountRepaid = amountPaid;
        loan.repaidAt     = block.timestamp;

        uint256 totalOwed = _totalOwed(loan);
        bool isLate       = block.timestamp > loan.dueAt + lateGracePeriod;
        bool isFull       = amountPaid >= totalOwed;
        bool isPartial    = !isFull && (amountPaid * 10000 >= totalOwed * partialThreshold);
        // isDefault if < 80% of owed (handled in declareLoanDefault below)

        uint256 interest      = _calcInterest(loan.principal, loan.interestRateBps);
        uint256 platformFee   = (interest * platformFeeBps) / 10000;
        uint256 lenderPayout  = loan.principal + interest - platformFee;

        if (isFull) {
            loan.status = LoanStatus.Repaid;

            // Release collateral back to borrower
            if (loan.collateralLocked > 0) {
                usdc.safeTransfer(msg.sender, loan.collateralLocked);
                emit CollateralReleased(loan.borrowerAgentId, loan.collateralLocked);
            }

            // Pay lender
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), lenderPayout);

            // Rep update: +2 if profit, +1 if just covered interest
            if (isLate) {
                repManager.applyLateDelta(loan.borrowerAgentId);
            } else if (profitGenerated) {
                repManager.applyRepayProfitDelta(loan.borrowerAgentId);
            } else {
                repManager.applyRepayNoProfitDelta(loan.borrowerAgentId);
            }

        } else if (isPartial) {
            loan.status = LoanStatus.Partial;

            // Seize collateral proportional to shortfall
            uint256 shortfall       = totalOwed - amountPaid;
            uint256 collateralUsed  = shortfall > loan.collateralLocked
                ? loan.collateralLocked
                : shortfall;
            uint256 collateralBack  = loan.collateralLocked - collateralUsed;

            // Lender gets what they can
            uint256 lenderRecovery = amountPaid + collateralUsed;
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), lenderRecovery > lenderPayout ? lenderPayout : lenderRecovery);

            if (collateralBack > 0) {
                usdc.safeTransfer(msg.sender, collateralBack);
                emit CollateralReleased(loan.borrowerAgentId, collateralBack);
            }

            repManager.applyPartialDelta(loan.borrowerAgentId);

        } else {
            // Paid < 80% of owed — treat as default path via declareLoanDefault
            revert("Amount < 80% owed; call declareLoanDefault if unable to repay");
        }

        activeLoan[loan.borrowerAgentId] = bytes32(0);
        activeLoan[loan.lenderAgentId]   = bytes32(0);

        emit LoanRepaid(loanId, amountPaid, loan.status);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DEFAULT DECLARATION  (callable by lender or platform after due date)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Declare a loan defaulted after due date + grace period.
     *         Collateral is seized and sent to lender. Rep −10 applied.
     */
    function declareLoanDefault(bytes32 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active || loan.status == LoanStatus.Late, "Not active");
        require(block.timestamp > loan.dueAt + lateGracePeriod, "Grace period not elapsed");

        loan.status = LoanStatus.Defaulted;
        totalDefaulted++;

        uint256 collateral = loan.collateralLocked;

        // Transfer collateral to lender as partial recovery
        if (collateral > 0) {
            usdc.safeTransfer(_agentWallet(loan.lenderAgentId), collateral);
        }

        repManager.applyDefaultDelta(loan.borrowerAgentId);

        activeLoan[loan.borrowerAgentId] = bytes32(0);
        activeLoan[loan.lenderAgentId]   = bytes32(0);

        emit LoanDefaulted(loanId, loan.borrowerAgentId, collateral);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  QUOTE VIEW  (read-only helpers for frontend / agent decision making)
    // ─────────────────────────────────────────────────────────────────────────

    struct LoanQuote {
        uint256 principal;
        uint256 collateralRequired;
        uint256 collateralBps;
        uint256 maxLoanUsdc;
        uint256 interestFloorBps;
        uint256 repScore;
        bool    eligible;
    }

    /**
     * @notice Returns a full loan quote for a borrower agent at a given amount.
     */
    function quoteLoan(bytes32 borrowerAgentId, uint256 amount) external view returns (LoanQuote memory q) {
        q.repScore        = repManager.getScore(borrowerAgentId);
        q.maxLoanUsdc     = repManager.maxLoanUsdc(borrowerAgentId);
        q.collateralBps   = repManager.collateralBps(borrowerAgentId);
        q.interestFloorBps = repManager.interestFloorBps(borrowerAgentId);
        q.principal       = amount;
        q.collateralRequired = _calcCollateral(amount, q.collateralBps);
        q.eligible        = (amount <= q.maxLoanUsdc) && (activeLoan[borrowerAgentId] == bytes32(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    function setLoanDuration(uint256 d) external onlyRole(DEFAULT_ADMIN_ROLE) {
        loanDuration = d;
    }
    function setLateGracePeriod(uint256 g) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lateGracePeriod = g;
    }
    function setPlatformFeeBps(uint256 fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(fee <= 500, "Fee cap 5%");
        platformFeeBps = fee;
    }
    function pause()   external onlyRole(PLATFORM_ROLE) { _pause(); }
    function unpause() external onlyRole(PLATFORM_ROLE) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev collateral = (principal × colBps) / 10000
    function _calcCollateral(uint256 principal, uint256 colBps) internal pure returns (uint256) {
        return (principal * colBps) / 10000;
    }

    /// @dev interest = (principal × rateBps × loanDuration) / (10000 × 365 days)
    ///      Simplified to flat rate for this MVP — multiply by term fraction
    function _calcInterest(uint256 principal, uint256 rateBps) internal view returns (uint256) {
        // Flat rate applied over full loanDuration as fraction of year
        return (principal * rateBps * loanDuration) / (10000 * 365 days);
    }

    function _totalOwed(Loan storage loan) internal view returns (uint256) {
        return loan.principal + _calcInterest(loan.principal, loan.interestRateBps);
    }

    /// @dev In production this reads from a registry. Stub for demo.
    mapping(bytes32 => address) public agentWallets;

    function registerAgentWallet(bytes32 agentId, address wallet) external onlyRole(PLATFORM_ROLE) {
        agentWallets[agentId] = wallet;
    }

    function _agentWallet(bytes32 agentId) internal view returns (address) {
        address w = agentWallets[agentId];
        require(w != address(0), "Agent wallet not registered");
        return w;
    }

    function _requireAgentCaller(bytes32 agentId) internal view {
        require(agentWallets[agentId] == msg.sender, "Not agent wallet");
    }
}
