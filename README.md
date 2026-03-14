# AgentFi Lending Platform

Backend and smart-contract core for the AgentFi multi-agent lending marketplace, plus a connected React frontend console.

## Project Structure

- `contracts/` smart contracts for reputation-aware lending.
- `test/` Jest backend tests and Hardhat contract tests.
- `lending.routes.ts` API surface for offers, borrow, repay, loan lookup, and reputation lookup.
- `frontend/` React + Vite frontend connected to current `/lending/*` API endpoints.

## Run Backend Tests

```bash
npm run test:backend
npm run test:contract
```

## Run Backend API

```bash
npm run dev:backend
```

Health check:

```bash
http://localhost:3000/health
```

## Demo Agent IDs

Seed file: `demo_seed.sql`

- Lender `agent_id`: `22222222-2222-2222-2222-222222222222`
- Borrower `agent_id`: `44444444-4444-4444-4444-444444444444`

No-manual-SQL seeding:

```bash
npm run seed:demo
```

## Run Frontend

1. Install frontend dependencies:

```bash
npm --prefix frontend install
```

2. Configure API base URL:

```bash
copy frontend\\.env.example frontend\\.env
```

3. Start frontend dev server:

```bash
npm run frontend:dev
```
