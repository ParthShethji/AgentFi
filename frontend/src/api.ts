import type {
  CreateUserPayload,
  CreateUserResponse,
  CreateAgentPayload,
  CreateAgentResponse,
  GetOffersResponse,
  PostOfferPayload,
  PostOfferResponse,
  GetBorrowQuoteResponse,
  RequestBorrowPayload,
  RequestBorrowResponse,
  RepayPayload,
  Loan,
  GetAgentLoansResponse,
  AgentRep,
} from "./types/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiClient = {
  createUser(payload: CreateUserPayload): Promise<CreateUserResponse>;
  createAgent(payload: CreateAgentPayload): Promise<CreateAgentResponse>;
  updateAgentStrategy(agentId: string, strategy: Record<string, unknown>): Promise<unknown>;
  getOffers(minRep: number, maxAmount: number): Promise<GetOffersResponse>;
  postOffer(payload: PostOfferPayload): Promise<PostOfferResponse>;
  deleteOffer(offerId: number, lenderAgentId: string): Promise<{ message: string }>;
  getBorrowQuote(borrowerAgentId: string, amountUsdc: number): Promise<GetBorrowQuoteResponse>;
  requestBorrow(payload: RequestBorrowPayload): Promise<RequestBorrowResponse>;
  approveBorrow(approvalId: number): Promise<RequestBorrowResponse>;
  repay(payload: RepayPayload): Promise<unknown>;
  getLoan(loanId: number): Promise<Loan>;
  getAgentLoans(agentId: string, role?: "lender" | "borrower"): Promise<GetAgentLoansResponse>;
  getAgentRep(agentId: string): Promise<AgentRep>;
};

function buildHeaders(token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function callApi<T>(
  baseUrl: string,
  token: string,
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || "Request failed";
    throw new Error(message);
  }
  return payload as T;
}

export function createApiClient(baseUrl: string, token: string): ApiClient {
  return {
    createUser(payload) {
      return callApi<CreateUserResponse>(baseUrl, token, "POST", "/platform/users", payload);
    },
    createAgent(payload) {
      return callApi<CreateAgentResponse>(baseUrl, token, "POST", "/platform/agents", payload);
    },
    updateAgentStrategy(agentId, strategy) {
      return callApi(baseUrl, token, "PUT", `/platform/agents/${encodeURIComponent(agentId)}/strategy`, strategy);
    },
    getOffers(minRep, maxAmount) {
      return callApi<GetOffersResponse>(baseUrl, token, "GET", `/lending/offers?minRep=${minRep}&maxAmount=${maxAmount}`);
    },
    postOffer(payload) {
      return callApi<PostOfferResponse>(baseUrl, token, "POST", "/lending/offers", payload);
    },
    deleteOffer(offerId, lenderAgentId) {
      return callApi<{ message: string }>(baseUrl, token, "DELETE", `/lending/offers/${offerId}`, { lenderAgentId });
    },
    getBorrowQuote(borrowerAgentId, amountUsdc) {
      return callApi<GetBorrowQuoteResponse>(
        baseUrl,
        token,
        "GET",
        `/lending/borrow/quote?borrowerAgentId=${encodeURIComponent(borrowerAgentId)}&amountUsdc=${amountUsdc}`
      );
    },
    requestBorrow(payload) {
      return callApi<RequestBorrowResponse>(baseUrl, token, "POST", "/lending/borrow", payload);
    },
    approveBorrow(approvalId) {
      return callApi<RequestBorrowResponse>(baseUrl, token, "POST", `/lending/borrow/approve/${approvalId}`);
    },
    repay(payload) {
      return callApi(baseUrl, token, "POST", "/lending/repay", payload);
    },
    getLoan(loanId) {
      return callApi<Loan>(baseUrl, token, "GET", `/lending/loans/${loanId}`);
    },
    getAgentLoans(agentId, role = "borrower") {
      return callApi<GetAgentLoansResponse>(
        baseUrl,
        token,
        "GET",
        `/lending/agents/${encodeURIComponent(agentId)}/loans?role=${role}`
      );
    },
    getAgentRep(agentId) {
      return callApi<AgentRep>(baseUrl, token, "GET", `/lending/agents/${encodeURIComponent(agentId)}/rep`);
    },
  };
}

/** Public (no auth): resolve ENS name to address. Used by onboarding before user exists. */
export async function resolveEns(
  baseUrl: string,
  ensName: string
): Promise<{ address: string | null }> {
  const url = `${baseUrl.replace(/\/$/, "")}/platform/ens/resolve?name=${encodeURIComponent(ensName)}`;
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || "ENS resolution failed";
    throw new Error(message);
  }
  return payload as { address: string | null };
}

/** Public (no auth): compute ENS node hashes for a subdomain — saves adding ethers to the browser. */
export async function ensNodes(
  baseUrl: string,
  parent: string,
  label: string
): Promise<{ parentNode: string; labelHash: string; subdomainNode: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/platform/ens/nodes?parent=${encodeURIComponent(parent)}&label=${encodeURIComponent(label)}`;
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: string }).error || "ENS node computation failed";
    throw new Error(message);
  }
  return payload as { parentNode: string; labelHash: string; subdomainNode: string };
}
