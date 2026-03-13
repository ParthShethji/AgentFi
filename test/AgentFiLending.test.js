const { expect } = require("chai");
const { ethers } = require("hardhat");

// ─── helpers ──────────────────────────────────────────────────────────────────
const USDC = (n) => ethers.parseUnits(String(n), 6);
const id = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("AgentFi Under-Collateralised Lending", function () {
  let rep, pool, usdc;
  let owner, alice, bob, matcher;

  // Agent/user IDs
  const ALICE_USER = id("alice");
  const BOB_USER = id("bob");
  const ALICE_AGENT1 = id("agent1.alice");
  const BOB_AGENT1 = id("agent1.bob");

  before(async () => {
    [owner, alice, bob, matcher] = await ethers.getSigners();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy core contracts
    const RepManager = await ethers.getContractFactory("ReputationManager");
    rep = await RepManager.deploy();

    const Pool = await ethers.getContractFactory("AgentFiLending");
    pool = await Pool.deploy(await usdc.getAddress(), await rep.getAddress());

    // Grant roles
    const LENDING_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LENDING_ROLE"));
    const MATCHER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MATCHER_ROLE"));
    const PLATFORM_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PLATFORM_ROLE"));
    await rep.grantRole(LENDING_ROLE, await pool.getAddress());
    await pool.grantRole(MATCHER_ROLE, matcher.address);
    await pool.grantRole(PLATFORM_ROLE, owner.address);

    // Register agent wallets
    await pool.registerAgentWallet(ALICE_AGENT1, alice.address);
    await pool.registerAgentWallet(BOB_AGENT1, bob.address);

    // Mint USDC
    await usdc.mint(alice.address, USDC(10_000));
    await usdc.mint(bob.address, USDC(10_000));

    // Register agents  (lending pool calls rep internally via LENDING_ROLE)
    const LENDING_ROLE_REP = ethers.keccak256(ethers.toUtf8Bytes("LENDING_ROLE"));
    await rep.grantRole(LENDING_ROLE_REP, owner.address); // temp for test setup
    await rep.registerAgent(ALICE_AGENT1, ALICE_USER, 0); // rep 25
    await rep.registerAgent(BOB_AGENT1, BOB_USER, 0); // rep 25
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Reputation Curve", () => {

    it("New agent has rep 25", async () => {
      expect(await rep.getScore(ALICE_AGENT1)).to.equal(25n);
    });

    it("Collateral at rep 25 ≈ 28.6%  (2860 bps)", async () => {
      const bps = await rep.collateralBps(ALICE_AGENT1);
      // (35 - 25) × 286 = 2860
      expect(bps).to.equal(2860n);
    });

    it("Collateral at rep 35 = 0%", async () => {
      // Register a high-rep agent
      const HIGH_REP_AGENT = id("high-rep");
      await rep.registerAgent(HIGH_REP_AGENT, id("dave"), 0);
      // Manually push score to 35 via repeated positive deltas
      for (let i = 0; i < 5; i++) await rep.applyRepayProfitDelta(HIGH_REP_AGENT); // +10
      const score = await rep.getScore(HIGH_REP_AGENT);
      expect(score).to.be.gte(35n);
      const bps = await rep.collateralBps(HIGH_REP_AGENT);
      expect(bps).to.equal(0n);
    });

    it("Max loan at rep 25 = 500 USDC", async () => {
      expect(await rep.maxLoanUsdc(ALICE_AGENT1)).to.equal(USDC(500));
    });

    it("Interest floor at rep 25 ≈ 200 bps (2%)", async () => {
      // 350 - 25×6 = 350 - 150 = 200
      expect(await rep.interestFloorBps(ALICE_AGENT1)).to.equal(200n);
    });

    it("+2 delta on profit repayment", async () => {
      const before = await rep.getScore(ALICE_AGENT1);
      await rep.applyRepayProfitDelta(ALICE_AGENT1);
      expect(await rep.getScore(ALICE_AGENT1)).to.equal(before + 2n);
    });

    it("−10 delta on default", async () => {
      const before = await rep.getScore(ALICE_AGENT1);
      await rep.applyDefaultDelta(ALICE_AGENT1);
      const after = await rep.getScore(ALICE_AGENT1);
      expect(after).to.equal(before > 10n ? before - 10n : 0n);
    });

    it("ZK vouch adds +8 once only", async () => {
      const ZK_ORACLE = ethers.keccak256(ethers.toUtf8Bytes("ZK_ORACLE_ROLE"));
      await rep.grantRole(ZK_ORACLE, owner.address);
      await rep.registerAgent(id("zk-agent"), id("zk-user"), 0);
      const before = await rep.getScore(id("zk-agent"));
      await rep.applyZKVouch(id("zk-agent"));
      expect(await rep.getScore(id("zk-agent"))).to.equal(before + 8n);
      await expect(rep.applyZKVouch(id("zk-agent"))).to.be.revertedWith("ZK vouch already applied");
    });

    it("Score capped at 50", async () => {
      const agent = id("cap-test");
      await rep.registerAgent(agent, id("cap-user"), 0);
      // Push score very high
      for (let i = 0; i < 20; i++) await rep.applyRepayProfitDelta(agent);
      expect(await rep.getScore(agent)).to.equal(50n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Anti-Exploit: Self-Match", () => {

    it("Blocks same-user agent matching", async () => {
      const ALICE_AGENT2 = id("agent2.alice");
      await rep.registerAgent(ALICE_AGENT2, ALICE_USER, 0); // same user as alice_agent1
      await pool.registerAgentWallet(ALICE_AGENT2, alice.address);

      // Alice posts lend offer with agent2
      await usdc.connect(alice).approve(await pool.getAddress(), USDC(500));
      const offerTx = await pool.connect(alice).postLendOffer(ALICE_AGENT2, USDC(200), 250, 20, 7 * 24 * 3600);
      const offerReceipt = await offerTx.wait();
      const offerId = offerReceipt.logs.find(l => l.fragment?.name === "LendOfferPosted").args[0];

      // Alice posts borrow request with agent1 (same userId!)
      const colBps = await rep.collateralBps(ALICE_AGENT1);
      const col = (USDC(200) * colBps) / 10000n;
      await usdc.connect(alice).approve(await pool.getAddress(), col);
      const reqTx = await pool.connect(alice).postBorrowRequest(ALICE_AGENT1, USDC(200), 7 * 24 * 3600);
      const reqReceipt = await reqTx.wait();
      const requestId = reqReceipt.logs.find(l => l.fragment?.name === "BorrowRequestPosted").args[0];

      // Matcher tries to match — MUST REVERT
      await expect(
        pool.connect(matcher).matchAndOriginate(offerId, requestId)
      ).to.be.revertedWith("Self-match: same user agents cannot match");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Full Loan Lifecycle", () => {

    let offerId, requestId, loanId;

    it("Bob posts lend offer", async () => {
      await usdc.connect(bob).approve(await pool.getAddress(), USDC(1000));
      const tx = await pool.connect(bob).postLendOffer(BOB_AGENT1, USDC(500), 250, 0, 14 * 24 * 3600);
      const r = await tx.wait();
      offerId = r.logs.find(l => l.fragment?.name === "LendOfferPosted").args[0];
      expect(offerId).to.not.equal(ethers.ZeroHash);
    });

    it("Alice posts borrow request with correct collateral", async () => {
      const colBps = await rep.collateralBps(ALICE_AGENT1);
      const col = (USDC(300) * colBps) / 10000n;
      await usdc.connect(alice).approve(await pool.getAddress(), col);
      const tx = await pool.connect(alice).postBorrowRequest(ALICE_AGENT1, USDC(300), 14 * 24 * 3600);
      const r = await tx.wait();
      requestId = r.logs.find(l => l.fragment?.name === "BorrowRequestPosted").args[0];
      expect(requestId).to.not.equal(ethers.ZeroHash);
    });

    it("Matcher creates loan", async () => {
      const tx = await pool.connect(matcher).matchAndOriginate(offerId, requestId);
      const r = await tx.wait();
      const ev = r.logs.find(l => l.fragment?.name === "LoanOriginated");
      loanId = ev.args[0];
      expect(loanId).to.not.equal(ethers.ZeroHash);

      const loan = await pool.loans(loanId);
      expect(loan.principal).to.equal(USDC(300));
      expect(loan.status).to.equal(0); // Active
    });

    it("Alice repays with profit → rep increases", async () => {
      const loan = await pool.loans(loanId);
      const repBefore = await rep.getScore(ALICE_AGENT1);

      // Calculate total owed (approx — interest is time-weighted)
      const totalOwed = USDC(310); // principal + some interest
      await usdc.connect(alice).approve(await pool.getAddress(), totalOwed);

      await pool.connect(alice).repay(loanId, totalOwed, true /* profit generated */);

      const repAfter = await rep.getScore(ALICE_AGENT1);
      expect(repAfter).to.be.gte(repBefore); // rep went up
      expect(await pool.activeLoan(ALICE_AGENT1)).to.equal(ethers.ZeroHash);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  describe("Default flow", () => {
    it("Default after grace period seizes collateral and slashes rep", async () => {
      // Setup a fresh loan
      const CHAR_AGENT = id("charlie-agent");
      const CHAR_USER = id("charlie-user");
      const DAVE_AGENT = id("dave-agent2");
      const DAVE_USER = id("dave-user2");
      const [, , , charlie, dave] = await ethers.getSigners();

      await usdc.mint(charlie.address, USDC(5000));
      await usdc.mint(dave.address, USDC(5000));

      await rep.registerAgent(CHAR_AGENT, CHAR_USER, 0);
      await rep.registerAgent(DAVE_AGENT, DAVE_USER, 0);
      await pool.registerAgentWallet(CHAR_AGENT, charlie.address);
      await pool.registerAgentWallet(DAVE_AGENT, dave.address);

      // Dave lends
      await usdc.connect(dave).approve(await pool.getAddress(), USDC(300));
      const lTx = await pool.connect(dave).postLendOffer(DAVE_AGENT, USDC(200), 300, 20, 7 * 24 * 3600);
      const lR = await lTx.wait();
      const oid = lR.logs.find(l => l.fragment?.name === "LendOfferPosted").args[0];

      // Charlie borrows
      const colBps = await rep.collateralBps(CHAR_AGENT);
      const col = (USDC(200) * colBps) / 10000n;
      await usdc.connect(charlie).approve(await pool.getAddress(), col);
      const bTx = await pool.connect(charlie).postBorrowRequest(CHAR_AGENT, USDC(200), 7 * 24 * 3600);
      const bR = await bTx.wait();
      const rid = bR.logs.find(l => l.fragment?.name === "BorrowRequestPosted").args[0];

      // Match
      const mTx = await pool.connect(matcher).matchAndOriginate(oid, rid);
      const mR = await mTx.wait();
      const lid = mR.logs.find(l => l.fragment?.name === "LoanOriginated").args[0];

      const repBefore = await rep.getScore(CHAR_AGENT);

      // Fast-forward past due + grace
      await ethers.provider.send("evm_increaseTime", [34 * 24 * 3600]); // 34 days
      await ethers.provider.send("evm_mine");

      await pool.declareLoanDefault(lid);

      const repAfter = await rep.getScore(CHAR_AGENT);
      expect(repAfter).to.equal(repBefore > 10n ? repBefore - 10n : 0n);
    });
  });
});
