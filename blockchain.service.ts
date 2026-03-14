/**
 * blockchain.service.ts
 *
 * All on-chain reads and writes go through here.
 * Nothing else in the codebase touches ethers.js directly.
 */

import { ethers, Contract, JsonRpcProvider, Wallet } from "ethers";

function loadAbi() {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const candidates = [
    "./contracts/AgentFiLending.abi.json",
    "./artifacts/contracts/AgentFiLending.sol/AgentFiLending.json",
  ];

  for (const path of candidates) {
    try {
      const abiJson = require(path);
      return Array.isArray(abiJson) ? abiJson : abiJson.abi || [];
    } catch {
      continue;
    }
  }

  return [];
}

const ABI = loadAbi();
const logger = process.env.NODE_ENV === "test" ? console : require("./utils/logger");

// ─── Provider + Signer setup ──────────────────────────────────────────────────

const provider = new JsonRpcProvider(process.env.RPC_URL || ""); // Base Sepolia

const platformWallet = new Wallet(process.env.PLATFORM_PRIVATE_KEY || "0x0123456789012345678901234567890123456789012345678901234567890123", provider);

const contract = new Contract(
  process.env.CONTRACT_ADDRESS || ethers.ZeroAddress,
  ABI,
  platformWallet
);

// USDC contract 
const USDC_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];
const usdc = new Contract(process.env.USDC_ADDRESS || ethers.ZeroAddress, USDC_ABI, provider);

const USDC_DECIMALS = 6n;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toUsdc(amount: number | string): bigint {
  return ethers.parseUnits(String(amount), Number(USDC_DECIMALS));
}

export function fromUsdc(bigintVal: bigint): number {
  return Number(ethers.formatUnits(bigintVal, Number(USDC_DECIMALS)));
}

async function waitForTx(txPromise: Promise<any>, label: string) {
  const tx = await txPromise;
  logger.info(`[blockchain] ${label} tx sent: ${tx.hash}`);
  const receipt = await tx.wait(1); 
  if (receipt.status !== 1) throw new Error(`[blockchain] ${label} tx reverted: ${tx.hash}`);
  logger.info(`[blockchain] ${label} confirmed in block ${receipt.blockNumber}`);
  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

// ─── Registration ──────────────────────────────────────────────────────────────

export async function registerAgent(agentWallet: string, initialScore: number) {
  logger.info(`[blockchain] registering agent ${agentWallet} score=${initialScore}`);
  return waitForTx(
    contract.registerAgent(agentWallet, initialScore),
    `registerAgent(${agentWallet})`
  );
}

// ─── Reputation reads ─────────────────────────────────────────────────────────

export async function getAgentRep(agentWallet: string) {
  const rep = await contract.getAgentRep(agentWallet);
  return {
    score: Number(rep.score),
    lastActivityAt: Number(rep.lastActivityAt),
    totalLoans: Number(rep.totalLoans),
    cleanRepayments: Number(rep.cleanRepayments),
    defaults: Number(rep.defaults),
  };
}

export async function getRequiredCollateral(borrowerWallet: string, principalUsdc: number) {
  const collateral = await contract.requiredCollateral(
    borrowerWallet,
    toUsdc(principalUsdc)
  );
  return fromUsdc(collateral);
}

export async function getMaxLoanSize(borrowerWallet: string) {
  const max = await contract.maxLoanSize(borrowerWallet);
  return fromUsdc(max);
}

export async function checkAllowance(ownerWallet: string) {
  const spender = process.env.CONTRACT_ADDRESS || ethers.ZeroAddress;
  const allowance = await usdc.allowance(ownerWallet, spender);
  return fromUsdc(allowance);
}

export async function checkBalance(walletAddress: string) {
  const balance = await usdc.balanceOf(walletAddress);
  return fromUsdc(balance);
}

// ─── Loan lifecycle ───────────────────────────────────────────────────────────

export async function requestLoan({
  borrowerWallet,
  lenderWallet,
  principalUsdc,
  interestUsdc,
  borrowerEns,
  lenderEns,
}: {
  borrowerWallet: string;
  lenderWallet: string;
  principalUsdc: number;
  interestUsdc: number;
  borrowerEns: string;
  lenderEns: string;
}) {
  const principalBig = toUsdc(principalUsdc);
  const interestBig  = toUsdc(interestUsdc);
  const borrowerEnsHash = ethers.keccak256(ethers.toUtf8Bytes(borrowerEns));
  const lenderEnsHash   = ethers.keccak256(ethers.toUtf8Bytes(lenderEns));

  const collateralNeeded = await getRequiredCollateral(borrowerWallet, principalUsdc);
  if (collateralNeeded > 0) {
    const allowance = await checkAllowance(borrowerWallet);
    if (allowance < collateralNeeded) {
      throw new Error(
        `Borrower collateral allowance insufficient. Required: ${collateralNeeded} USDC, Approved: ${allowance} USDC`
      );
    }
    const balance = await checkBalance(borrowerWallet);
    if (balance < collateralNeeded) {
      throw new Error(
        `Borrower USDC balance too low for collateral. Required: ${collateralNeeded} USDC, Balance: ${balance} USDC`
      );
    }
  }

  const lenderAllowance = await checkAllowance(lenderWallet);
  if (lenderAllowance < principalUsdc) {
    throw new Error(
      `Lender allowance insufficient. Required: ${principalUsdc} USDC, Approved: ${lenderAllowance} USDC`
    );
  }

  logger.info(`[blockchain] requestLoan borrower=${borrowerWallet} lender=${lenderWallet}`);

  const result = await waitForTx(
    contract.requestLoan(
      borrowerWallet,
      lenderWallet,
      principalBig,
      interestBig,
      borrowerEnsHash,
      lenderEnsHash
    ),
    "requestLoan"
  );

  const receipt = await provider.getTransactionReceipt(result.txHash);
  if(!receipt) throw new Error("Tx Receipt not found");
  
  const loanRequestedTopic = contract.interface.getEvent("LoanRequested")!.topicHash;
  const log = receipt.logs.find(l => l.topics[0] === loanRequestedTopic);
  const parsed = contract.interface.parseLog(log as any);
  const loanId = Number(parsed?.args.loanId || 0);

  return { ...result, loanId, collateralLocked: collateralNeeded };
}

export async function fundLoan(loanId: number) {
  logger.info(`[blockchain] fundLoan loanId=${loanId}`);
  return waitForTx(contract.fundLoan(loanId), `fundLoan(${loanId})`);
}

export async function repayLoan(loanId: number, borrowerWallet: string, profitGeneratedUsdc: number) {
  const loan = await getLoan(loanId);
  const totalOwed = loan.principalUsdc + loan.interestUsdc;

  const allowance = await checkAllowance(borrowerWallet);
  if (allowance < totalOwed) {
    throw new Error(`Borrower repayment allowance insufficient.`);
  }

  const profitBig = toUsdc(profitGeneratedUsdc || 0);

  const borrowerContract = contract.connect(
    new Wallet(process.env[`AGENT_KEY_${borrowerWallet.toLowerCase()}`] || "", provider)
  ) as Contract;

  return waitForTx(
    borrowerContract.repayLoan?.(loanId, profitBig) as Promise<any>,
    `repayLoan(${loanId})`
  );
}

export async function repayPartial(loanId: number, borrowerWallet: string, partialAmountUsdc: number) {
  logger.info(`[blockchain] repayPartial loanId=${loanId} partial=${partialAmountUsdc}`);
  return waitForTx(contract.repayPartial(loanId, toUsdc(partialAmountUsdc)), `repayPartial(${loanId})`);
}

export async function liquidateLoan(loanId: number) {
  return waitForTx(contract.liquidateLoan(loanId), `liquidateLoan(${loanId})`);
}

export async function setReputation(agentWallet: string, newScore: number, reason: string) {
  return waitForTx(contract.setReputation(agentWallet, newScore, reason), `setReputation(${agentWallet})`);
}

export async function getLoan(loanId: number) {
  const loan = await contract.getLoan(loanId);
  return {
    loanId: Number(loan.loanId),
    borrower: loan.borrower,
    lender: loan.lender,
    principalUsdc: fromUsdc(loan.principal),
    collateralUsdc: fromUsdc(loan.collateral),
    interestUsdc: fromUsdc(loan.interestAmount),
    dueAt: new Date(Number(loan.dueAt) * 1000),
    repaidAt: loan.repaidAt > 0 ? new Date(Number(loan.repaidAt) * 1000) : null,
    status: ["None","Requested","Active","Repaid","Defaulted","Liquidated"][loan.status as number],
  };
}

export async function getBorrowerLoanIds(agentWallet: string) {
  const ids: bigint[] = await contract.getBorrowerLoans(agentWallet);
  return ids.map(Number);
}

export async function getLenderLoanIds(agentWallet: string) {
  const ids: bigint[] = await contract.getLenderLoans(agentWallet);
  return ids.map(Number);
}

export function onReputationUpdated(callback: (data: any) => void) {
  contract.on("ReputationUpdated", (agent: string, oldScore: bigint, newScore: bigint, reason: string, event: any) => {
    callback({
      agent,
      oldScore: Number(oldScore),
      newScore: Number(newScore),
      reason,
      txHash: event.log.transactionHash,
      blockNumber: event.log.blockNumber,
    });
  });
}

export function onLoanFunded(callback: (data: any) => void) {
  contract.on("LoanFunded", (loanId: bigint, fundedAt: bigint, event: any) => {
    callback({
      loanId: Number(loanId),
      fundedAt: new Date(Number(fundedAt) * 1000),
      txHash: event.log.transactionHash,
    });
  });
}

export function onLoanRepaid(callback: (data: any) => void) {
  contract.on("LoanRepaid", (loanId: bigint, repaidAt: bigint, withProfit: bigint, event: any) => {
    callback({
      loanId: Number(loanId),
      repaidAt: new Date(Number(repaidAt) * 1000),
      withProfit: Number(withProfit),
      txHash: event.log.transactionHash,
    });
  });
}
