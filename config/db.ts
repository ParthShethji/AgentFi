import fs from "fs";
import path from "path";
import { newDb } from "pg-mem";
import { Pool as PgPool } from "pg";

type QueryResult = {
  rows: any[];
  rowCount?: number;
};

let pool: any;

function loadSchemaForPgMem() {
  const schemaPath = path.resolve(__dirname, "..", "schema.sql");
  const rawSchema = fs.readFileSync(schemaPath, "utf8");
  return rawSchema
    .split("-- ─── DB-level anti-sybil constraint")[0]
    .replace(/gen_random_uuid\(\)/g, "'00000000-0000-0000-0000-000000000001'");
}

function initInMemoryDb() {
  const memoryDb = newDb();
  memoryDb.public.none(loadSchemaForPgMem());

  memoryDb.public.none(`
    INSERT INTO users (user_id, email, wallet_address, zk_proof_status)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'lender@test.com', '0xLenderUserWallet', 'verified'),
      ('33333333-3333-3333-3333-333333333333', 'borrower@test.com', '0xBorrowerUserWallet', 'verified');

    INSERT INTO agents (
      agent_id, user_id, ens_name, wallet_address, role, status, reputation_score
    )
    VALUES
      (
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'agent1.alice.agentfi.eth',
        '0xLenderAgentWallet',
        'lender',
        'active',
        35
      ),
      (
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        'agent1.bob.agentfi.eth',
        '0xBorrowerAgentWallet',
        'borrower',
        'active',
        25
      );

    INSERT INTO lend_offers (lender_agent_id, max_amount_usdc, min_rep_required, rate_pct, status)
    VALUES ('22222222-2222-2222-2222-222222222222', 500, 25, 2.0, 'open');
  `);

  const adapter = memoryDb.adapters.createPg();
  const MemoryPool = adapter.Pool;
  pool = new MemoryPool();
}

if (process.env.DATABASE_URL) {
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  console.log("[db] using Postgres via DATABASE_URL");
} else {
  initInMemoryDb();
  console.log("[db] using in-memory pg-mem (no DATABASE_URL set)");
}

export const query = async (text: string, params: any[] = []): Promise<QueryResult> => {
  const result = await pool.query(text, params);
  return { rows: result.rows || [], rowCount: result.rowCount };
};
