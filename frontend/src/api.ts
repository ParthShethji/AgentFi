type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type ApiClient = {
  createUser(payload: {
    email: string;
    walletAddress?: string;
  }): Promise<unknown>;
  createAgent(payload: {
    userId: string;
    role: "lender" | "borrower";
    username: string;
    ensName?: string;
    initialScore?: number;
    strategy?: Record<string, unknown>;
  }): Promise<unknown>;
  updateAgentStrategy(agentId: string, strategy: Record<string, unknown>): Promise<unknown>;
  getOffers(minRep: number, maxAmount: number): Promise<unknown>;
  postOffer(payload: {
    lenderAgentId: string;
    maxAmountUsdc: number;
    minRepRequired: number;
    ratePct: number;
  }): Promise<unknown>;
  getBorrowQuote(borrowerAgentId: string, amountUsdc: number): Promise<unknown>;
  requestBorrow(payload: {
    borrowerAgentId: string;
    requestedAmountUsdc: number;
  }): Promise<unknown>;
  repay(payload: {
    matchId: number;
    borrowerAgentId: string;
    profitGeneratedUsdc: number;
  }): Promise<unknown>;
  getLoan(loanId: number): Promise<unknown>;
  getAgentRep(agentId: string): Promise<unknown>;
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

async function callApi(baseUrl: string, token: string, method: HttpMethod, path: string, body?: unknown) {
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
  return payload;
}

export function createApiClient(baseUrl: string, token: string): ApiClient {
  return {
    createUser(payload) {
      return callApi(baseUrl, token, "POST", "/platform/users", payload);
    },
    createAgent(payload) {
      return callApi(baseUrl, token, "POST", "/platform/agents", payload);
    },
    updateAgentStrategy(agentId, strategy) {
      return callApi(baseUrl, token, "PUT", `/platform/agents/${encodeURIComponent(agentId)}/strategy`, strategy);
    },
    getOffers(minRep, maxAmount) {
      return callApi(baseUrl, token, "GET", `/lending/offers?minRep=${minRep}&maxAmount=${maxAmount}`);
    },
    postOffer(payload) {
      return callApi(baseUrl, token, "POST", "/lending/offers", payload);
    },
    getBorrowQuote(borrowerAgentId, amountUsdc) {
      return callApi(
        baseUrl,
        token,
        "GET",
        `/lending/borrow/quote?borrowerAgentId=${encodeURIComponent(borrowerAgentId)}&amountUsdc=${amountUsdc}`
      );
    },
    requestBorrow(payload) {
      return callApi(baseUrl, token, "POST", "/lending/borrow", payload);
    },
    repay(payload) {
      return callApi(baseUrl, token, "POST", "/lending/repay", payload);
    },
    getLoan(loanId) {
      return callApi(baseUrl, token, "GET", `/lending/loans/${loanId}`);
    },
    getAgentRep(agentId) {
      return callApi(baseUrl, token, "GET", `/lending/agents/${encodeURIComponent(agentId)}/rep`);
    },
  };
}
