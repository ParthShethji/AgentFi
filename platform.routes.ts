import { Router } from "express";
import { randomUUID } from "crypto";
import { ethers } from "ethers";
import * as blockchain from "./blockchain.service";
import { setAgentPrivateKey } from "./config/agentKeys";
import { putStrategyDoc } from "./utils/strategyStore";
// @ts-ignore
const db = require("./config/db");

const router = Router();

router.post("/users", async (req, res) => {
  const { email, walletAddress } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const userId = randomUUID();
  const userWallet = walletAddress || ethers.Wallet.createRandom().address;

  try {
    await db.query(
      `INSERT INTO users (user_id, email, wallet_address, zk_proof_status, created_at)
       VALUES ($1, $2, $3, 'verified', NOW())`,
      [userId, email, userWallet]
    );
    return res.json({ userId, email, walletAddress: userWallet });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "failed to create user" });
  }
});

router.post("/agents", async (req, res) => {
  const {
    userId,
    role,
    username,
    ensName,
    initialScore = 25,
    strategy = {
      maxLoanAmount: 500,
      minReputation: 25,
      interestRate: 2.0,
      tradeAllocation: { ETH: 60, stablecoin: 40 },
      repayAfterSeconds: 30,
      signals: [],
    },
  } = req.body || {};

  if (!userId || !role || !username) {
    return res.status(400).json({ error: "userId, role, username are required" });
  }

  if (!["lender", "borrower"].includes(role)) {
    return res.status(400).json({ error: "role must be lender or borrower" });
  }

  try {
    let resolvedEns = ensName;
    if (!resolvedEns) {
      let index = 1;
      while (true) {
        const candidate = `agent${index}.${username}.agentfi.eth`;
        const { rows } = await db.query(`SELECT 1 FROM agents WHERE ens_name = $1`, [candidate]);
        if (!rows.length) {
          resolvedEns = candidate;
          break;
        }
        index += 1;
      }
    }
    const agentId = randomUUID();
    const docId = `doc-${agentId}`;
    const agentWallet = ethers.Wallet.createRandom();

    setAgentPrivateKey(agentWallet.address, agentWallet.privateKey);
    putStrategyDoc(docId, strategy);

    const registerTx = await blockchain.registerAgent(agentWallet.address, Number(initialScore));

    // Auto-fund agent wallet with ETH for gas, then mint USDC and approve lending contract
    try {
      await blockchain.fundEth(agentWallet.address, "1.0");
      await blockchain.mintUsdc(agentWallet.address, 10000); // 10k USDC for demo
      await blockchain.approveUsdc(agentWallet.privateKey, 100000); // approve 100k
    } catch (mintErr: any) {
      console.warn(`[platform] auto-mint/approve failed (non-fatal): ${mintErr.message}`);
    }

    await db.query(
      `INSERT INTO agents (
         agent_id, user_id, ens_name, wallet_address, fileverse_doc_id, role, status, reputation_score, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())`,
      [agentId, userId, resolvedEns, agentWallet.address, docId, role, Number(initialScore)]
    );

    return res.json({
      agentId,
      ensName: resolvedEns,
      walletAddress: agentWallet.address,
      privateKey: agentWallet.privateKey,
      role,
      fileverseDocId: docId,
      registerTxHash: registerTx.txHash,
      initialScore: Number(initialScore),
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "failed to create agent" });
  }
});

router.put("/agents/:agentId/strategy", async (req, res) => {
  const { agentId } = req.params;
  const strategy = req.body || {};

  try {
    const { rows } = await db.query(`SELECT fileverse_doc_id FROM agents WHERE agent_id = $1`, [agentId]);
    if (!rows.length) {
      return res.status(404).json({ error: "agent not found" });
    }

    const docId = rows[0].fileverse_doc_id;
    putStrategyDoc(docId, strategy);
    return res.json({ agentId, fileverseDocId: docId, updated: true });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || "failed to update strategy" });
  }
});

export = router;
