import { expect } from "chai";
const { ethers } = require("hardhat");
type SignerWithAddress = any;
type Contract = any;

describe("AgentFiLending", function () {
  let usdc: any, lending: any;
  let owner: SignerWithAddress, platformSigner: SignerWithAddress, borrower: SignerWithAddress, lender: SignerWithAddress, other: SignerWithAddress;

  const USDC_DECIMALS = 6n;
  const parseUsdc = (num: number | string) => ethers.parseUnits(num.toString(), Number(USDC_DECIMALS));
  const dummyEns = ethers.encodeBytes32String("dummy.agentfi.eth");

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    platformSigner = signers[1];
    borrower = signers[2];
    lender = signers[3];
    other = signers[4];

    // Deploy a mock USDC 
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USDC", "USDC", 6);
    await usdc.waitForDeployment();

    const AgentFiLending = await ethers.getContractFactory("AgentFiLending");
    lending = await AgentFiLending.deploy(usdc.target, platformSigner.address);
    await lending.waitForDeployment();

    // Mint some mock USDC to borrower and lender
    await usdc.mint(borrower.address, parseUsdc(5000));
    await usdc.mint(lender.address, parseUsdc(5000));
  });

  describe("Agent Registration", function() {
    it("should allow platform to register an agent", async function() {
      await lending.connect(platformSigner).registerAgent(borrower.address, 25, dummyEns);
      const rep = await lending.getAgentRep(borrower.address);
      expect(rep.score).to.equal(25n);
    });

    it("should revert if registered by non-platform", async function() {
      await (expect(
        lending.connect(owner).registerAgent(borrower.address, 25, dummyEns)
      ) as any).to.be.revertedWith("AgentFi: caller is not platform");
    });

    it("should revert if initial rep is above 35", async function() {
      await (expect(
        lending.connect(platformSigner).registerAgent(borrower.address, 36, dummyEns)
      ) as any).to.be.revertedWith("AgentFi: initial score too high");
    });
  });

  describe("Reputation Read Helpers", function() {
    beforeEach(async function() {
      await lending.connect(platformSigner).registerAgent(borrower.address, 25, dummyEns);
    });

    it("should calculate correct collateral for rep = 25", async function() {
      // (35 - 25) * 2.86 = 28.6%
      const principal = parseUsdc(100);
      const coll = await lending.requiredCollateral(borrower.address, principal);
      expect(coll).to.equal(parseUsdc(28.6)); 
    });

    it("should calculate correct max loan for rep = 25", async function() {
      const max = await lending.maxLoanSize(borrower.address);
      expect(max).to.equal(parseUsdc(25 * 20)); // 500
    });
  });

  describe("Loan Lifecycle", function() {
    const loanId = 1n;
    const principal = parseUsdc(100);
    const interest = parseUsdc(2); // 2%
    const bEns = ethers.encodeBytes32String("bEns");
    const lEns = ethers.encodeBytes32String("lEns");
    
    beforeEach(async function() {
      await lending.connect(platformSigner).registerAgent(borrower.address, 25, dummyEns);
      await lending.connect(platformSigner).registerAgent(lender.address, 35, ethers.encodeBytes32String("lenderEns"));

      const reqCollateral = await lending.requiredCollateral(borrower.address, principal);
      await usdc.connect(borrower).approve(lending.target, reqCollateral);
      await usdc.connect(lender).approve(lending.target, principal);
    });

    it("should request and fund a loan", async function() {
      const bBalanceBefore = await usdc.balanceOf(borrower.address);
      const reqCollateral = await lending.requiredCollateral(borrower.address, principal);

      await (expect(
        lending.connect(platformSigner).requestLoan(
          borrower.address, lender.address, principal, interest, bEns, lEns
        )
      ) as any).to.emit(lending, "LoanRequested").withArgs(
        1n, borrower.address, lender.address, principal, reqCollateral, interest, /*dueAt*/() => true
      );

      // check borrower balance dropped by collateral
      expect(await usdc.balanceOf(borrower.address)).to.equal(bBalanceBefore - reqCollateral);

      // check loan status
      const loan = await lending.getLoan(loanId);
      expect(loan.status).to.equal(1n); // Requested

      // fund
      const bBalPreFund = await usdc.balanceOf(borrower.address);
      const lBalPreFund = await usdc.balanceOf(lender.address);
      await lending.connect(platformSigner).fundLoan(loanId);
      
      expect(await usdc.balanceOf(borrower.address)).to.equal(bBalPreFund + principal);
      expect(await usdc.balanceOf(lender.address)).to.equal(lBalPreFund - principal);

      const activeLoan = await lending.getLoan(loanId);
      expect(activeLoan.status).to.equal(2n); // Active
    });

    it("should repay a loan fully and return collateral", async function() {
      await lending.connect(platformSigner).requestLoan(borrower.address, lender.address, principal, interest, bEns, lEns);
      await lending.connect(platformSigner).fundLoan(loanId);

      const reqCollateral = await lending.requiredCollateral(borrower.address, principal);

      // Approve lending contract to pull principal + interest
      await usdc.connect(borrower).approve(lending.target, principal + interest);
      
      const bBalPreRepay = await usdc.balanceOf(borrower.address);
      const lBalPreRepay = await usdc.balanceOf(lender.address);

      // Repay
      await lending.connect(borrower).repayLoan(loanId, parseUsdc(5)); // with profit

      // Verify lender receives principal + interest
      expect(await usdc.balanceOf(lender.address)).to.equal(lBalPreRepay + principal + interest);
      
      // Verify borrower owes principal+interest, receives collateral back
      expect(await usdc.balanceOf(borrower.address)).to.equal(bBalPreRepay - principal - interest + reqCollateral);

      const loan = await lending.getLoan(loanId);
      expect(loan.status).to.equal(3n); // Repaid

      // Check rep updated
      const rep = await lending.getAgentRep(borrower.address);
      expect(rep.score).to.equal(27n); // 25 + 2 = 27 (on_time_with_profit)
    });
  });
});
