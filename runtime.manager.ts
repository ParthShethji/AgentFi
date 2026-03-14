import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import toolDefinitions from "./tools_definition.json";
import * as lending from "./lending.service";
import * as blockchain from "./blockchain.service";
import { query as db } from "./config/db";
import { getStrategyDoc } from "./utils/strategyStore";
import * as logger from "./utils/logger";

type AgentRow = {
  agent_id: string;
  user_id: string;
  ens_name: string;
  wallet_address: string;
  fileverse_doc_id: string | null;
  role: "lender" | "borrower";
  status: "pending" | "active" | "paused" | "stopped";
  reputation_score: number;
  agent_type: "lender" | "borrower";
  strategy_prompt: string;
  strategy_json: string;
  execution_interval_seconds: number;
  enabled_tools: string;
  risk_tolerance: string;
  profit_target_pct: number;
  runtime_status: "active" | "paused" | "stopped";
  last_execution_at: string | null;
  next_execution_at: string | null;
  last_result_summary: string | null;
  total_cycles: number;
  total_profit_usdc: number;
  total_borrowed_usdc: number;
  total_lent_usdc: number;
  current_positions_json: string;
};

type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

type ToolCallContext = {
  agent: AgentRow;
  cycleId: string;
  log: (phase: string, message: string, options?: LogOptions) => Promise<void>;
};

type LogOptions = {
  level?: RuntimeLogLevel;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  metadata?: unknown;
};

type RuntimeTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  call: (ctx: ToolCallContext, args: any) => Promise<any>;
};

const strategyTemplateCache = new Map<string, string>();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "serialization_failed" });
  }
}

function roundUsdc(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function strategyTemplateFor(role: "lender" | "borrower") {
  const cached = strategyTemplateCache.get(role);
  if (cached) return cached;

  const fileName = role === "lender" ? "lending.md" : "borrowing.md";
  const template = fs.readFileSync(path.resolve(__dirname, ".agents", fileName), "utf8");
  strategyTemplateCache.set(role, template);
  return template;
}

function defaultEnabledTools(role: "lender" | "borrower") {
  const lenderTools = ["fetch_open_offers", "post_lend_offer", "get_agent_reputation"];
  const borrowerTools = ["fetch_open_offers", "get_borrow_quote", "request_borrow", "repay_loan", "get_agent_reputation"];
  return role === "lender" ? lenderTools : borrowerTools;
}

async function getAgentWallet(agentId: string) {
  const { rows } = await db(
    `SELECT wallet_address FROM agents WHERE agent_id = $1`,
    [agentId]
  );
  if (!rows.length) {
    throw new Error(`Agent ${agentId} not found`);
  }
  return String(rows[0].wallet_address);
}

async function buildBorrowQuote(borrowerAgentId: string, amountUsdc: number) {
  const walletAddress = await getAgentWallet(borrowerAgentId);
  const [rep, collateralUsdc, maxLoanUsdc] = await Promise.all([
    blockchain.getAgentRep(walletAddress),
    blockchain.getRequiredCollateral(walletAddress, amountUsdc),
    blockchain.getMaxLoanSize(walletAddress),
  ]);
  const { interestUsdc, ratePct } = lending.calculateInterest(amountUsdc, rep.score);
  return {
    reputationScore: rep.score,
    maxLoanUsdc,
    requestedAmountUsdc: amountUsdc,
    collateralUsdc,
    interestUsdc,
    ratePct,
    totalOwedUsdc: roundUsdc(amountUsdc + interestUsdc),
  };
}

async function fetchOpenOffers(_ctx: ToolCallContext, args: any) {
  const minRep = Number(args?.minRep ?? 0);
  const maxAmount = Number(args?.maxAmount ?? 1000);
  const { rows } = await db(
    `SELECT lo.offer_id, lo.lender_agent_id, lo.max_amount_usdc, lo.min_rep_required, lo.rate_pct, lo.created_at,
            a.ens_name, a.reputation_score
     FROM lend_offers lo
     JOIN agents a ON a.agent_id = lo.lender_agent_id
     WHERE lo.status = 'open'
       AND lo.min_rep_required <= $1
       AND lo.max_amount_usdc >= $2
     ORDER BY lo.rate_pct ASC, lo.created_at ASC`,
    [minRep, maxAmount]
  );
  return { offers: rows };
}

async function getAgentReputation(_ctx: ToolCallContext, args: any) {
  const walletAddress = await getAgentWallet(String(args.agentId));
  const rep = await blockchain.getAgentRep(walletAddress);
  return rep;
}

const runtimeToolMap: Record<string, RuntimeTool> = {
  fetch_open_offers: {
    name: "fetch_open_offers",
    description: "Fetch marketplace offers",
    parameters: {},
    call: fetchOpenOffers,
  },
  post_lend_offer: {
    name: "post_lend_offer",
    description: "Post a lend offer",
    parameters: {},
    call: async (_ctx, args) => {
      const offerId = await lending.postLendOffer(args);
      return { offerId };
    },
  },
  get_borrow_quote: {
    name: "get_borrow_quote",
    description: "Get a borrow quote",
    parameters: {},
    call: async (_ctx, args) => buildBorrowQuote(String(args.borrowerAgentId), Number(args.amountUsdc)),
  },
  request_borrow: {
    name: "request_borrow",
    description: "Request a borrow",
    parameters: {},
    call: async (_ctx, args) => lending.requestBorrow(args),
  },
  repay_loan: {
    name: "repay_loan",
    description: "Repay an active loan",
    parameters: {},
    call: async (_ctx, args) => lending.repayLoan(args),
  },
  get_agent_reputation: {
    name: "get_agent_reputation",
    description: "Get on-chain reputation",
    parameters: {},
    call: getAgentReputation,
  },
};

export function getRegisteredTools() {
  return (toolDefinitions as any[]).map((definition) => ({
    ...definition,
    callable: Boolean(runtimeToolMap[definition.name]),
  }));
}

async function loadAgent(agentId: string) {
  const { rows } = await db(
    `SELECT a.agent_id, a.user_id, a.ens_name, a.wallet_address, a.fileverse_doc_id, a.role, a.status,
            a.reputation_score,
            c.agent_type, c.strategy_prompt, c.strategy_json, c.execution_interval_seconds,
            c.enabled_tools, c.risk_tolerance, c.profit_target_pct, c.runtime_status,
            c.last_execution_at, c.next_execution_at, c.last_result_summary,
            c.total_cycles, c.total_profit_usdc, c.total_borrowed_usdc, c.total_lent_usdc, c.current_positions_json
     FROM agents a
     JOIN agent_configs c ON c.agent_id = a.agent_id
     WHERE a.agent_id = $1`,
    [agentId]
  );
  return (rows[0] as AgentRow | undefined) || null;
}

async function listActiveAgents() {
  const { rows } = await db(
    `SELECT a.agent_id
     FROM agents a
     JOIN agent_configs c ON c.agent_id = a.agent_id
     WHERE a.status = 'active' AND c.runtime_status = 'active'`
  );
  return rows.map((row: any) => String(row.agent_id));
}

async function persistLog(agentId: string, cycleId: string, phase: string, message: string, options: LogOptions = {}) {
  const level = options.level || "info";
  const toolInput = options.toolInput === undefined ? null : serialize(options.toolInput);
  const toolOutput = options.toolOutput === undefined ? null : serialize(options.toolOutput);
  const metadata = options.metadata === undefined ? null : serialize(options.metadata);

  await db(
    `INSERT INTO agent_execution_logs
       (agent_id, cycle_id, phase, level, message, tool_name, tool_input, tool_output, metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [agentId, cycleId, phase, level, message, options.toolName || null, toolInput, toolOutput, metadata]
  );

  const prefix = `[runtime:${agentId}]`;
  if (level === "error") logger.error(prefix, phase, message);
  else if (level === "warn") logger.warn(prefix, phase, message);
  else logger.info(prefix, phase, message);
}

async function updateAgentRuntime(agentId: string, patch: Partial<Record<string, unknown>>) {
  const allowedFields = [
    "last_execution_at",
    "next_execution_at",
    "last_result_summary",
    "total_cycles",
    "total_profit_usdc",
    "total_borrowed_usdc",
    "total_lent_usdc",
    "current_positions_json",
    "runtime_status",
    "updated_at",
  ];

  const entries = Object.entries(patch).filter(([key]) => allowedFields.includes(key));
  if (!entries.length) return;

  const sets = entries.map(([key], index) => `${key} = $${index + 2}`);
  const values = entries.map(([, value]) => value);

  await db(
    `UPDATE agent_configs SET ${sets.join(", ")} WHERE agent_id = $1`,
    [agentId, ...values]
  );
}

async function callTool(ctx: ToolCallContext, toolName: string, args: any) {
  const tool = runtimeToolMap[toolName];
  if (!tool) {
    throw new Error(`Tool ${toolName} is not callable in the local runtime`);
  }

  await ctx.log("tool:selected", `Calling tool ${toolName}`, {
    toolName,
    toolInput: args,
  });

  const result = await tool.call(ctx, args);
  await ctx.log("tool:result", `Tool ${toolName} completed`, {
    toolName,
    toolInput: args,
    toolOutput: result,
  });
  return result;
}

function riskAdjustedRepThreshold(base: number, risk: string) {
  if (risk === "conservative") return Math.min(50, base + 5);
  if (risk === "aggressive") return Math.max(0, base - 5);
  return base;
}

function profitMultiplier(risk: string) {
  if (risk === "conservative") return 0.8;
  if (risk === "aggressive") return 1.15;
  return 1;
}

class AgentRuntimeManager {
  private started = false;
  private timers = new Map<string, NodeJS.Timeout>();
  private running = new Set<string>();

  async start() {
    if (this.started || process.env.NODE_ENV === "test") return;
    this.started = true;
    const activeAgents = await listActiveAgents();
    await Promise.all(activeAgents.map((agentId) => this.registerOrRefreshAgent(agentId)));
    logger.info(`[runtime] started manager with ${activeAgents.length} active agents`);
  }

  async registerOrRefreshAgent(agentId: string) {
    const agent = await loadAgent(agentId);
    if (!agent || agent.status !== "active" || agent.runtime_status !== "active") {
      this.clearTimer(agentId);
      return;
    }
    this.scheduleAgent(agentId, agent);
  }

  async pauseAgent(agentId: string, runtimeStatus: "active" | "paused" | "stopped") {
    await updateAgentRuntime(agentId, {
      runtime_status: runtimeStatus,
      updated_at: new Date(),
    });
    if (runtimeStatus === "active") {
      await this.registerOrRefreshAgent(agentId);
    } else {
      this.clearTimer(agentId);
    }
  }

  async runAgentNow(agentId: string, reason: string = "manual") {
    await this.executeCycle(agentId, reason);
  }

  async getAgentRuntime(agentId: string) {
    const agent = await loadAgent(agentId);
    if (!agent) return null;

    const { rows: logs } = await db(
      `SELECT log_id, cycle_id, phase, level, message, tool_name, tool_input, tool_output, metadata_json, created_at
       FROM agent_execution_logs
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [agentId]
    );

    const walletFunding = await blockchain.getWalletFundingSnapshot(agent.wallet_address);

    return {
      agent,
      strategy: parseJson(agent.strategy_json, {}),
      enabledTools: parseJson<string[]>(agent.enabled_tools, []),
      walletFunding,
      logs: logs.map((row: any) => ({
        ...row,
        tool_input: parseJson(row.tool_input, null),
        tool_output: parseJson(row.tool_output, null),
        metadata: parseJson(row.metadata_json, null),
      })),
    };
  }

  async getAdminOverview() {
    const { rows: agents } = await db(
      `SELECT a.agent_id, a.ens_name, a.role, a.status, a.reputation_score, a.last_activity_at,
              c.execution_interval_seconds, c.runtime_status, c.last_execution_at, c.next_execution_at,
              c.last_result_summary, c.total_cycles, c.total_profit_usdc, c.total_borrowed_usdc, c.total_lent_usdc
       FROM agents a
       JOIN agent_configs c ON c.agent_id = a.agent_id
       ORDER BY c.total_profit_usdc DESC, a.created_at DESC`
    );

    const { rows: recentLogs } = await db(
      `SELECT l.log_id, l.agent_id, a.ens_name, a.role, l.phase, l.level, l.message, l.tool_name, l.created_at
       FROM agent_execution_logs l
       JOIN agents a ON a.agent_id = l.agent_id
       ORDER BY l.created_at DESC
       LIMIT 60`
    );

    const { rows: activity } = await db(
      `SELECT type,
              COALESCE(SUM(amount), 0) AS total_amount,
              COUNT(*) AS total_events
       FROM event_log
       GROUP BY type`
    );

    return {
      tools: getRegisteredTools(),
      agents,
      recentLogs,
      activity,
    };
  }

  private clearTimer(agentId: string) {
    const timer = this.timers.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(agentId);
    }
  }

  private scheduleAgent(agentId: string, agent?: AgentRow) {
    this.clearTimer(agentId);
    const intervalSeconds = Math.max(10, Number(agent?.execution_interval_seconds || 60));
    const nextAt = agent?.next_execution_at ? new Date(agent.next_execution_at).getTime() : Date.now() + intervalSeconds * 1000;
    const delayMs = Math.max(1000, nextAt - Date.now());
    const timer = setTimeout(() => {
      void this.executeCycle(agentId, "scheduled");
    }, delayMs);
    this.timers.set(agentId, timer);
  }

  private async executeCycle(agentId: string, reason: string) {
    if (this.running.has(agentId)) return;
    this.running.add(agentId);

    const cycleId = randomUUID();
    try {
      const agent = await loadAgent(agentId);
      if (!agent || agent.status !== "active" || agent.runtime_status !== "active") {
        this.clearTimer(agentId);
        return;
      }

      const ctx: ToolCallContext = {
        agent,
        cycleId,
        log: (phase, message, options = {}) => persistLog(agent.agent_id, cycleId, phase, message, options),
      };

      await ctx.log("cycle:start", `Starting ${agent.role} cycle`, {
        metadata: { reason, intervalSeconds: agent.execution_interval_seconds },
      });

      if (agent.role === "lender") {
        await this.runLenderCycle(agent, ctx);
      } else {
        await this.runBorrowerCycle(agent, ctx);
      }
    } catch (error: any) {
      await persistLog(agentId, cycleId, "cycle:error", error.message || "Unknown runtime error", {
        level: "error",
      });
    } finally {
      this.running.delete(agentId);
      const agent = await loadAgent(agentId);
      if (agent && agent.runtime_status === "active" && agent.status === "active") {
        const nextExecutionAt = new Date(Date.now() + Math.max(10, Number(agent.execution_interval_seconds || 60)) * 1000);
        await updateAgentRuntime(agentId, {
          next_execution_at: nextExecutionAt,
          updated_at: new Date(),
        });
        this.scheduleAgent(agentId, { ...agent, next_execution_at: nextExecutionAt.toISOString() });
      }
    }
  }

  private async runLenderCycle(agent: AgentRow, ctx: ToolCallContext) {
    const strategy = parseJson<Record<string, any>>(agent.strategy_json, {});
    const enabledTools = parseJson<string[]>(agent.enabled_tools, []);
    const ownOpenOffers = await db(
      `SELECT offer_id FROM lend_offers WHERE lender_agent_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      [agent.agent_id]
    );

    await ctx.log(
      "reasoning",
      `Loaded lender strategy template and ${enabledTools.length} enabled tools`,
      { metadata: { template: strategyTemplateFor("lender"), strategy } }
    );

    if (ownOpenOffers.rows.length) {
      await ctx.log("decision", "Skipping new offer because an open offer already exists", {
        metadata: { existingOfferId: ownOpenOffers.rows[0].offer_id },
      });
      await updateAgentRuntime(agent.agent_id, {
        last_execution_at: new Date(),
        last_result_summary: "Offer already open; cycle skipped",
        total_cycles: agent.total_cycles + 1,
        updated_at: new Date(),
      });
      return;
    }

    const maxAmountUsdc = Number(strategy.maxLoanAmount || 500);
    const minRepRequired = riskAdjustedRepThreshold(Number(strategy.minReputation || 25), agent.risk_tolerance);
    const ratePct = Number(strategy.interestRate || 2);

    await callTool(ctx, "fetch_open_offers", {
      minRep: minRepRequired,
      maxAmount: maxAmountUsdc,
    });

    const result = await callTool(ctx, "post_lend_offer", {
      lenderAgentId: agent.agent_id,
      maxAmountUsdc,
      minRepRequired,
      ratePct,
    });

    await ctx.log("decision", `Posted lend offer ${result.offerId}`, {
      metadata: { maxAmountUsdc, minRepRequired, ratePct },
    });

    await updateAgentRuntime(agent.agent_id, {
      last_execution_at: new Date(),
      last_result_summary: `Posted lend offer ${result.offerId}`,
      total_cycles: agent.total_cycles + 1,
      updated_at: new Date(),
    });
  }

  private async runBorrowerCycle(agent: AgentRow, ctx: ToolCallContext) {
    const strategy = parseJson<Record<string, any>>(agent.strategy_json, {});
    const enabledTools = parseJson<string[]>(agent.enabled_tools, []);
    const requestedAmountUsdc = Number(strategy.maxLoanAmount || 250);

    await ctx.log(
      "reasoning",
      `Loaded borrower strategy template and ${enabledTools.length} enabled tools`,
      { metadata: { template: strategyTemplateFor("borrower"), strategy } }
    );

    const offers = await callTool(ctx, "fetch_open_offers", {
      minRep: Number(strategy.minReputation || 0),
      maxAmount: requestedAmountUsdc,
    });

    if (!offers.offers?.length) {
      await ctx.log("decision", "No eligible offers found, waiting for next interval");
      await updateAgentRuntime(agent.agent_id, {
        last_execution_at: new Date(),
        last_result_summary: "No offers available",
        total_cycles: agent.total_cycles + 1,
        updated_at: new Date(),
      });
      return;
    }

    const quote = await callTool(ctx, "get_borrow_quote", {
      borrowerAgentId: agent.agent_id,
      amountUsdc: requestedAmountUsdc,
    });

    const expectedProfitPct = Number(agent.profit_target_pct || 4) * profitMultiplier(agent.risk_tolerance);
    if (expectedProfitPct <= Number(quote.ratePct || 0)) {
      await ctx.log("decision", "Skipping borrow because expected profit does not clear borrowing cost", {
        level: "warn",
        metadata: { expectedProfitPct, ratePct: quote.ratePct },
      });
      await updateAgentRuntime(agent.agent_id, {
        last_execution_at: new Date(),
        last_result_summary: "Borrow skipped due to low expected edge",
        total_cycles: agent.total_cycles + 1,
        updated_at: new Date(),
      });
      return;
    }

    const borrowResult = await callTool(ctx, "request_borrow", {
      borrowerAgentId: agent.agent_id,
      requestedAmountUsdc,
    });

    if (borrowResult.status !== "funded") {
      await ctx.log("decision", `Borrow result: ${borrowResult.status}`);
      await updateAgentRuntime(agent.agent_id, {
        last_execution_at: new Date(),
        last_result_summary: `Borrow result: ${borrowResult.status}`,
        total_cycles: agent.total_cycles + 1,
        updated_at: new Date(),
      });
      return;
    }

    const rawProfit = requestedAmountUsdc * (expectedProfitPct / 100);
    const realizedProfit = roundUsdc(Math.max(rawProfit, Number(quote.interestUsdc || 0) + 0.5));

    await ctx.log("trade", "Borrow funded; simulating strategy execution", {
      metadata: {
        matchId: borrowResult.matchId,
        loanId: borrowResult.loanId,
        principalUsdc: borrowResult.principalUsdc,
        expectedProfitPct,
        realizedProfit,
      },
    });

    const repayResult = await callTool(ctx, "repay_loan", {
      matchId: borrowResult.matchId,
      borrowerAgentId: agent.agent_id,
      profitGeneratedUsdc: realizedProfit,
    });

    const currentPositions = parseJson<Record<string, any>>(agent.current_positions_json, {});
    currentPositions.lastMatchId = borrowResult.matchId;
    currentPositions.lastLoanId = borrowResult.loanId;
    currentPositions.lastProfitUsdc = realizedProfit;
    currentPositions.lastActionAt = new Date().toISOString();

    await ctx.log("decision", `Borrowed, traded, and repaid with ${realizedProfit} USDC profit`, {
      metadata: { repayResult },
    });

    await updateAgentRuntime(agent.agent_id, {
      last_execution_at: new Date(),
      last_result_summary: `Repaid match ${borrowResult.matchId} with ${realizedProfit} USDC profit`,
      total_cycles: agent.total_cycles + 1,
      total_profit_usdc: Number(agent.total_profit_usdc || 0) + realizedProfit,
      total_borrowed_usdc: Number(agent.total_borrowed_usdc || 0) + requestedAmountUsdc,
      current_positions_json: JSON.stringify(currentPositions),
      updated_at: new Date(),
    });
  }
}

export const agentRuntimeManager = new AgentRuntimeManager();
