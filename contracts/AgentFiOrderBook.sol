// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentFiOrderBook
 * @notice Off-chain sorted, on-chain settled orderbook view.
 *         Exposes sorted lend/borrow queues that the matcher reads before
 *         calling AgentFiLending.matchAndOriginate().
 *
 *  The actual matching loop runs off-chain (cheaper, no gas for failed matches).
 *  This contract holds the canonical order state and enforces:
 *   - Lend sorted: lowest interestRate first
 *   - Borrow sorted: highest rep first
 */
contract AgentFiOrderBook {
    struct LendEntry {
        bytes32 offerId;
        bytes32 lenderAgentId;
        uint256 interestRateBps;
        uint256 minRepRequired;
        uint256 maxAmount;
        uint256 expiresAt;
        bool    active;
    }

    struct BorrowEntry {
        bytes32 requestId;
        bytes32 borrowerAgentId;
        uint256 requestedAmount;
        uint256 repScore;          // snapshot at request time — refreshed by matcher
        uint256 expiresAt;
        bool    active;
    }

    // ─── Storage (append-only; active flag = soft delete) ────────────────────
    LendEntry[]   public lendBook;
    BorrowEntry[] public borrowBook;

    address public lendingPool;
    address public owner;

    // ─── Events ──────────────────────────────────────────────────────────────
    event LendEnqueued(bytes32 indexed offerId, bytes32 indexed lenderAgentId, uint256 rate);
    event BorrowEnqueued(bytes32 indexed requestId, bytes32 indexed borrowerAgentId, uint256 rep);
    event EntryDeactivated(bytes32 indexed id, bool isLend);

    constructor(address _lendingPool) {
        lendingPool = _lendingPool;
        owner = msg.sender;
    }

    modifier onlyPool() {
        require(msg.sender == lendingPool || msg.sender == owner, "Not authorized");
        _;
    }

    function enqueueLend(
        bytes32 offerId,
        bytes32 lenderAgentId,
        uint256 rateBps,
        uint256 minRep,
        uint256 maxAmount,
        uint256 expiresAt
    ) external onlyPool {
        lendBook.push(LendEntry({
            offerId:         offerId,
            lenderAgentId:   lenderAgentId,
            interestRateBps: rateBps,
            minRepRequired:  minRep,
            maxAmount:       maxAmount,
            expiresAt:       expiresAt,
            active:          true
        }));
        emit LendEnqueued(offerId, lenderAgentId, rateBps);
    }

    function enqueueBorrow(
        bytes32 requestId,
        bytes32 borrowerAgentId,
        uint256 amount,
        uint256 repScore,
        uint256 expiresAt
    ) external onlyPool {
        borrowBook.push(BorrowEntry({
            requestId:       requestId,
            borrowerAgentId: borrowerAgentId,
            requestedAmount: amount,
            repScore:        repScore,
            expiresAt:       expiresAt,
            active:          true
        }));
        emit BorrowEnqueued(requestId, borrowerAgentId, repScore);
    }

    function deactivate(bytes32 id, bool isLend) external onlyPool {
        if (isLend) {
            for (uint i = 0; i < lendBook.length; i++) {
                if (lendBook[i].offerId == id) { lendBook[i].active = false; break; }
            }
        } else {
            for (uint i = 0; i < borrowBook.length; i++) {
                if (borrowBook[i].requestId == id) { borrowBook[i].active = false; break; }
            }
        }
        emit EntryDeactivated(id, isLend);
    }

    /// @notice Returns all active lend offers (off-chain sorts by rate)
    function getActiveLendOffers() external view returns (LendEntry[] memory) {
        uint count;
        for (uint i = 0; i < lendBook.length; i++) {
            if (lendBook[i].active && lendBook[i].expiresAt > block.timestamp) count++;
        }
        LendEntry[] memory out = new LendEntry[](count);
        uint j;
        for (uint i = 0; i < lendBook.length; i++) {
            if (lendBook[i].active && lendBook[i].expiresAt > block.timestamp) {
                out[j++] = lendBook[i];
            }
        }
        return out;
    }

    /// @notice Returns all active borrow requests (off-chain sorts by rep)
    function getActiveBorrowRequests() external view returns (BorrowEntry[] memory) {
        uint count;
        for (uint i = 0; i < borrowBook.length; i++) {
            if (borrowBook[i].active && borrowBook[i].expiresAt > block.timestamp) count++;
        }
        BorrowEntry[] memory out = new BorrowEntry[](count);
        uint j;
        for (uint i = 0; i < borrowBook.length; i++) {
            if (borrowBook[i].active && borrowBook[i].expiresAt > block.timestamp) {
                out[j++] = borrowBook[i];
            }
        }
        return out;
    }
}
