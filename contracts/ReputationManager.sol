// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationManager
 * @notice Manages on-chain reputation scores for AgentFi agents.
 *         Scale: 0–50. Collateral curve is continuous — no binary cliff.
 *         Formula: collateral_bps = max(0, (35 − rep) × 286)
 *                  max_loan_usdc  = rep × 20e6   (6-decimal USDC)
 *                  interest_floor = max(50, 350 − rep × 6)  (bps)
 */
contract ReputationManager is AccessControl, ReentrancyGuard {
    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant LENDING_ROLE   = keccak256("LENDING_ROLE");
    bytes32 public constant ZK_ORACLE_ROLE = keccak256("ZK_ORACLE_ROLE");

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant MAX_REP              = 50;
    uint256 public constant ZERO_COLLATERAL_REP  = 35;   // C₀ crossover
    uint256 public constant NEW_AGENT_BASELINE   = 25;
    uint256 public constant SIBLING_BOOST_CAP    = 8;    // max +8 from siblings
    uint256 public constant ZK_BOOST             = 8;    // one-time ZK vouching
    uint256 public constant INACTIVITY_THRESHOLD = 60 days;
    uint256 public constant INACTIVITY_DECAY_BPS = 50;   // 0.5 rep per 30d (×100 stored)
    uint256 public constant DECAY_PERIOD         = 30 days;

    // Collateral multiplier: (35 - rep) × 286 bps ≈ (35 - rep) × 2.86%
    uint256 public constant COLLATERAL_SLOPE_BPS = 286;

    // ─── Score deltas (stored as int8 for gas) ───────────────────────────────
    int8 public constant DELTA_REPAY_PROFIT    =  2;
    int8 public constant DELTA_REPAY_NO_PROFIT =  1;
    int8 public constant DELTA_LATE            = -2;
    int8 public constant DELTA_PARTIAL         = -4;
    int8 public constant DELTA_DEFAULT         = -10;

    // ─── Agent record ────────────────────────────────────────────────────────
    struct AgentRecord {
        bytes32 userId;          // off-chain user UUID, hashed
        uint256 score;           // 0–50, stored ×100 internally for decay precision
        uint256 lastActivityAt;
        bool    zkVouched;
        bool    active;
    }

    // agentId → record
    mapping(bytes32 => AgentRecord) public agents;

    // agentId → accumulated decay debt (×100) not yet applied
    mapping(bytes32 => uint256) private _decayDebt;

    // ─── Events ──────────────────────────────────────────────────────────────
    event AgentRegistered(bytes32 indexed agentId, bytes32 indexed userId, uint256 initialScore);
    event RepUpdated(bytes32 indexed agentId, int256 delta, uint256 newScore, string reason);
    event ZKVouchApplied(bytes32 indexed agentId, uint256 newScore);
    event InactivityDecayApplied(bytes32 indexed agentId, uint256 decayAmount, uint256 newScore);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Registration
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new agent with baseline score 25.
     *         Optionally apply sibling bootstrap (validated off-chain, submitted by lending contract).
     * @param agentId     keccak256 of the agent UUID
     * @param userId      keccak256 of the user UUID (for anti-exploit binding)
     * @param siblingBonus pre-validated sibling boost, 0–8
     */
    function registerAgent(
        bytes32 agentId,
        bytes32 userId,
        uint256 siblingBonus
    ) external onlyRole(LENDING_ROLE) {
        require(!agents[agentId].active, "Agent already registered");
        require(siblingBonus <= SIBLING_BOOST_CAP, "Sibling bonus exceeds cap");

        uint256 initialScore = NEW_AGENT_BASELINE + siblingBonus; // max 33
        // Store ×100 for sub-integer decay precision
        agents[agentId] = AgentRecord({
            userId:         userId,
            score:          initialScore * 100,
            lastActivityAt: block.timestamp,
            zkVouched:      false,
            active:         true
        });

        emit AgentRegistered(agentId, userId, initialScore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ZK Bootstrap (one-time)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Apply one-time +8 ZK human vouching. Called by ZK oracle after proof verification.
     */
    function applyZKVouch(bytes32 agentId) external onlyRole(ZK_ORACLE_ROLE) {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");
        require(!rec.zkVouched, "ZK vouch already applied");

        rec.zkVouched = true;
        uint256 boost = ZK_BOOST * 100;
        rec.score = _capScore(rec.score + boost);
        rec.lastActivityAt = block.timestamp;

        emit ZKVouchApplied(agentId, rec.score / 100);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Reputation Updates (called by LendingPool)
    // ─────────────────────────────────────────────────────────────────────────

    function applyRepayProfitDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_REPAY_PROFIT, "repay_profit"); }

    function applyRepayNoProfitDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_REPAY_NO_PROFIT, "repay_no_profit"); }

    function applyLateDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_LATE, "late_repayment"); }

    function applyPartialDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_PARTIAL, "partial_repayment"); }

    function applyDefaultDelta(bytes32 agentId)
        external onlyRole(LENDING_ROLE)
    { _applyDelta(agentId, DELTA_DEFAULT, "default"); }

    // ─────────────────────────────────────────────────────────────────────────
    //  Inactivity Decay  (callable by anyone — permissionless upkeep)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Apply accumulated inactivity decay for an agent.
     *         −0.5 rep per 30 days after 60 days of inactivity.
     */
    function applyDecay(bytes32 agentId) external {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");

        uint256 inactive = block.timestamp - rec.lastActivityAt;
        if (inactive <= INACTIVITY_THRESHOLD) return;

        // Periods beyond the 60d grace window
        uint256 decayPeriods = (inactive - INACTIVITY_THRESHOLD) / DECAY_PERIOD;
        if (decayPeriods == 0) return;

        // 0.5 rep × 100 = 50 units per period
        uint256 totalDecay = decayPeriods * INACTIVITY_DECAY_BPS;
        uint256 before = rec.score;
        rec.score = rec.score > totalDecay ? rec.score - totalDecay : 0;

        // Advance lastActivityAt by the periods consumed to avoid re-applying
        rec.lastActivityAt += decayPeriods * DECAY_PERIOD;

        emit InactivityDecayApplied(agentId, totalDecay / 100, rec.score / 100);
        emit RepUpdated(agentId, -int256(totalDecay / 100), rec.score / 100, "inactivity_decay");
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  View helpers (consumed by LendingPool)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Returns the integer rep score (0–50)
    function getScore(bytes32 agentId) external view returns (uint256) {
        return agents[agentId].score / 100;
    }

    /// @notice Returns raw ×100 score for decay precision (internal use)
    function getRawScore(bytes32 agentId) external view returns (uint256) {
        return agents[agentId].score;
    }

    /// @notice userId bound to this agent (for anti-exploit match check)
    function getUserId(bytes32 agentId) external view returns (bytes32) {
        return agents[agentId].userId;
    }

    /**
     * @notice Collateral required as basis points.
     *         collateral_bps = max(0, (35 − rep) × 286)
     *         10000 bps = 100% collateral
     */
    function collateralBps(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return _collateralBps(rep);
    }

    /**
     * @notice Maximum loan size in USDC (6 decimals).
     *         max_loan = rep × 20 USDC
     */
    function maxLoanUsdc(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return rep * 20 * 1e6; // 6-decimal USDC
    }

    /**
     * @notice Minimum interest rate in basis points.
     *         floor = max(50, 350 − rep × 6)
     */
    function interestFloorBps(bytes32 agentId) external view returns (uint256) {
        uint256 rep = agents[agentId].score / 100;
        return _interestFloorBps(rep);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Pure math helpers (public so LendingPool can call for quoting)
    // ─────────────────────────────────────────────────────────────────────────

    function _collateralBps(uint256 rep) internal pure returns (uint256) {
        if (rep >= ZERO_COLLATERAL_REP) return 0;
        return (ZERO_COLLATERAL_REP - rep) * COLLATERAL_SLOPE_BPS;
    }

    function _interestFloorBps(uint256 rep) internal pure returns (uint256) {
        uint256 computed = rep * 6;
        uint256 floor    = computed >= 350 ? 0 : 350 - computed;
        return floor < 50 ? 50 : floor;
    }

    function _capScore(uint256 raw) internal pure returns (uint256) {
        uint256 cap = MAX_REP * 100;
        return raw > cap ? cap : raw;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _applyDelta(bytes32 agentId, int8 delta, string memory reason) internal {
        AgentRecord storage rec = agents[agentId];
        require(rec.active, "Agent not registered");

        int256 rawScore = int256(rec.score) + int256(int8(delta)) * 100;
        rec.score = rawScore < 0 ? 0 : _capScore(uint256(rawScore));
        rec.lastActivityAt = block.timestamp;

        emit RepUpdated(agentId, delta, rec.score / 100, reason);
    }
}
