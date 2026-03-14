import { FormEvent, useMemo, useState } from "react";
import { createApiClient } from "./api";

const defaultApiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBase);
  const [authToken, setAuthToken] = useState("");
  const [output, setOutput] = useState("Ready");
  const [loading, setLoading] = useState(false);

  const [minRep, setMinRep] = useState(25);
  const [maxAmount, setMaxAmount] = useState(1000);

  const [lenderAgentId, setLenderAgentId] = useState("");
  const [offerAmount, setOfferAmount] = useState(500);
  const [offerMinRep, setOfferMinRep] = useState(30);
  const [offerRate, setOfferRate] = useState(2);

  const [borrowerAgentId, setBorrowerAgentId] = useState("");
  const [requestAmount, setRequestAmount] = useState(250);

  const [matchId, setMatchId] = useState(1);
  const [profitUsdc, setProfitUsdc] = useState(0);

  const [loanId, setLoanId] = useState(1);
  const [repAgentId, setRepAgentId] = useState("");

  const api = useMemo(() => createApiClient(apiBaseUrl, authToken), [apiBaseUrl, authToken]);

  async function run(label: string, action: () => Promise<unknown>) {
    try {
      setLoading(true);
      const result = await action();
      setOutput(`${label}\n\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setOutput(`${label}\n\nError: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(handler: () => Promise<unknown>, label: string) {
    return (event: FormEvent) => {
      event.preventDefault();
      void run(label, handler);
    };
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>AgentFi Platform Console</h1>
        <p>
          Frontend connected to the lending marketplace API from <code>project.md</code>.
        </p>
      </header>

      <section className="card">
        <h2>Connection</h2>
        <div className="grid">
          <label>
            API base URL
            <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} />
          </label>
          <label>
            Bearer token
            <input
              value={authToken}
              onChange={(event) => setAuthToken(event.target.value)}
              placeholder="optional in current backend mock auth"
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Orderbook</h2>
        <form onSubmit={onSubmit(() => api.getOffers(minRep, maxAmount), "GET /lending/offers")}>
          <div className="grid">
            <label>
              Min rep
              <input type="number" value={minRep} onChange={(event) => setMinRep(Number(event.target.value))} />
            </label>
            <label>
              Max amount USDC
              <input
                type="number"
                value={maxAmount}
                onChange={(event) => setMaxAmount(Number(event.target.value))}
              />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Fetch Open Offers
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Lender Action</h2>
        <form
          onSubmit={onSubmit(
            () =>
              api.postOffer({
                lenderAgentId,
                maxAmountUsdc: offerAmount,
                minRepRequired: offerMinRep,
                ratePct: offerRate,
              }),
            "POST /lending/offers"
          )}
        >
          <div className="grid">
            <label>
              Lender agentId
              <input value={lenderAgentId} onChange={(event) => setLenderAgentId(event.target.value)} required />
            </label>
            <label>
              Max amount USDC
              <input
                type="number"
                value={offerAmount}
                onChange={(event) => setOfferAmount(Number(event.target.value))}
                required
              />
            </label>
            <label>
              Min rep required
              <input
                type="number"
                value={offerMinRep}
                onChange={(event) => setOfferMinRep(Number(event.target.value))}
                required
              />
            </label>
            <label>
              Rate %
              <input
                type="number"
                step="0.1"
                value={offerRate}
                onChange={(event) => setOfferRate(Number(event.target.value))}
                required
              />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Post Offer
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Borrower Action</h2>
        <form
          onSubmit={onSubmit(
            () => api.getBorrowQuote(borrowerAgentId, requestAmount),
            "GET /lending/borrow/quote"
          )}
        >
          <div className="grid">
            <label>
              Borrower agentId
              <input value={borrowerAgentId} onChange={(event) => setBorrowerAgentId(event.target.value)} required />
            </label>
            <label>
              Requested amount USDC
              <input
                type="number"
                value={requestAmount}
                onChange={(event) => setRequestAmount(Number(event.target.value))}
                required
              />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Get Quote
          </button>
        </form>

        <form
          onSubmit={onSubmit(
            () =>
              api.requestBorrow({
                borrowerAgentId,
                requestedAmountUsdc: requestAmount,
              }),
            "POST /lending/borrow"
          )}
        >
          <button disabled={loading} type="submit">
            Request Borrow
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Repay + Lookup</h2>
        <form
          onSubmit={onSubmit(
            () =>
              api.repay({
                matchId,
                borrowerAgentId,
                profitGeneratedUsdc: profitUsdc,
              }),
            "POST /lending/repay"
          )}
        >
          <div className="grid">
            <label>
              Match ID
              <input type="number" value={matchId} onChange={(event) => setMatchId(Number(event.target.value))} />
            </label>
            <label>
              Profit generated USDC
              <input type="number" value={profitUsdc} onChange={(event) => setProfitUsdc(Number(event.target.value))} />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Repay Loan
          </button>
        </form>

        <form onSubmit={onSubmit(() => api.getLoan(loanId), "GET /lending/loans/:loanId")}>
          <div className="grid">
            <label>
              Loan ID
              <input type="number" value={loanId} onChange={(event) => setLoanId(Number(event.target.value))} />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Lookup Loan
          </button>
        </form>

        <form onSubmit={onSubmit(() => api.getAgentRep(repAgentId), "GET /lending/agents/:agentId/rep")}>
          <div className="grid">
            <label>
              Agent ID
              <input value={repAgentId} onChange={(event) => setRepAgentId(event.target.value)} required />
            </label>
          </div>
          <button disabled={loading} type="submit">
            Lookup Reputation
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Response</h2>
        <pre>{output}</pre>
      </section>
    </div>
  );
}
