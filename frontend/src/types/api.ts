/**
 * Shared request/response types for platform and lending API.
 * Aligned with backend routes (platform.routes.ts, lending.routes.ts).
 */

// ─── Platform ───────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  email: string;
  walletAddress?: string;
  zkProofData?: string;
}

export interface CreateUserResponse {
  userId: string;
  email: string;
  walletAddress: string;
  zkVerified: boolean;
}

export interface CreateAgentStrategy {
  maxLoanAmount?: number;
  minReputation?: number;
  interestRate?: number;
  tradeAllocation?: { ETH: number; stablecoin: number };
  repayAfterSeconds?: number;
  signals?: string[];
  raw?: string;
  /** Fileverse dDoc secure URL. When provided, the backend fetches and decrypts
   *  the strategy document from Fileverse's decentralised storage. */
  fileverseUrl?: string;
  [key: string]: unknown;
}

export interface CreateAgentPayload {
  userId: string;
  role: "lender" | "borrower";
  username?: string;
  ensName: string;
  initialScore?: number;
  strategy?: CreateAgentStrategy;
}

export interface CreateAgentResponse {
  agentId: string;
  ensName: string;
  walletAddress: string;
  privateKey?: string;
  role: string;
  fileverseDocId: string;
  registerTxHash: string;
  initialScore: number;
}

// ─── Lending - Offers ────────────────────────────────────────────────────────

export interface Offer {
  offer_id: number;
  lender_agent_id: string;
  ens_name: string;
  max_amount_usdc: number;
  min_rep_required: number;
  rate_pct: number;
  created_at: string;
}

export interface GetOffersResponse {
  offers: Offer[];
}

export interface PostOfferPayload {
  lenderAgentId: string;
  maxAmountUsdc: number;
  minRepRequired: number;
  ratePct: number;
}

export interface PostOfferResponse {
  offerId: number;
}

// ─── Lending - Borrow ────────────────────────────────────────────────────────

export interface GetBorrowQuoteResponse {
  reputationScore: number;
  maxLoanUsdc: number;
  requestedAmountUsdc: number;
  collateralUsdc: number;
  interestUsdc: number;
  ratePct: number;
  totalOwedUsdc: number;
}

export interface RequestBorrowPayload {
  borrowerAgentId: string;
  requestedAmountUsdc: number;
}

export type RequestBorrowResponse =
  | { status: "pending_user_approval"; approvalId: number }
  | {
      status: "funded";
      matchId: number;
      loanId: number;
      principalUsdc: number;
      interestUsdc: number;
      ratePct: number;
      collateralLockedUsdc: number;
      fundTxHash: string;
      requestTxHash: string;
    };

// ─── Lending - Repay ────────────────────────────────────────────────────────

export interface RepayPayload {
  matchId: number;
  borrowerAgentId: string;
  profitGeneratedUsdc: number;
}

// ─── Lending - Loans ────────────────────────────────────────────────────────

export interface Loan {
  loanId: number;
  borrower: string;
  lender: string;
  principalUsdc: number;
  collateralUsdc: number;
  interestUsdc: number;
  dueAt: string;
  repaidAt: string | null;
  status: string;
}

export interface GetAgentLoansResponse {
  loans: Loan[];
}

// ─── Lending - Agent Rep ─────────────────────────────────────────────────────

export interface AgentRep {
  score: number;
  lastActivityAt: number;
  totalLoans: number;
  cleanRepayments: number;
  defaults: number;
  collateralPctFor100Usdc?: number;
  maxLoanUsdc?: number;
}
