import { Router } from "express";
import { randomUUID, createHash } from "crypto";
import { ethers } from "ethers";
import * as blockchain from "./blockchain.service";
import { setAgentPrivateKey } from "./config/agentKeys";
import { putStrategyDoc } from "./utils/strategyStore";
// @ts-ignore
const db = require("./config/db");

const router = Router();

// Public: resolve ENS name to address (used by onboarding before user exists).
router.get("/ens/resolve", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const address = await blockchain.resolveEnsToAddress(name);
    return res.json({ address: address ?? null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "ENS resolution failed" });
  }
});

// Public: compute ENS node hashes for a subdomain.
// Frontend needs these to build the raw setSubnodeRecord + setAddr calldata
// without needing ethers in the browser.
// GET /platform/ens/nodes?parent=alice.eth&label=vault-1
router.get("/ens/nodes", (req, res) => {
  const parent = typeof req.query.parent === "string" ? req.query.parent.trim() : "";
  const label  = typeof req.query.label  === "string" ? req.query.label.trim()  : "";
  if (!parent || !label) {
    return res.status(400).json({ error: "parent and label are required" });
  }
  try {
    const parentNode    = ethers.namehash(parent);                                // namehash("alice.eth")
    const labelHash     = ethers.keccak256(ethers.toUtf8Bytes(label));            // keccak256("vault-1")
    const subdomainNode = ethers.namehash(`${label}.${parent}`);                  // namehash("vault-1.alice.eth")
    return res.json({ parentNode, labelHash, subdomainNode });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/users", async (req, res) => {
  const { email, walletAddress, zkProofData } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const userId = randomUUID();
  const userWallet = walletAddress || ethers.Wallet.createRandom().address;

  // Derive a deterministic human_id from the ZK proof (mock: hash of wallet address).
  // In production this would come from Reclaim Protocol's verified proof payload.
  let humanId: string | null = null;
  let zkStatus: "none" | "verified" = "none";
  if (zkProofData || walletAddress) {
    humanId = createHash("sha256")
      .update(zkProofData || walletAddress || "")
      .digest("hex");
    zkStatus = "verified";
  }

  try {
    if (humanId) {
      const { rows: existing } = await db.query(
        `SELECT 1 FROM users WHERE human_id = $1`,
        [humanId]
      );
      if (existing.length) {
        return res.status(409).json({ error: "This identity has already been registered. One human, one account." });
      }
    }

    await db.query(
      `INSERT INTO users (user_id, email, wallet_address, zk_proof_status, human_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, email, userWallet, zkStatus, humanId]
    );
    return res.json({ userId, email, walletAddress: userWallet, zkVerified: zkStatus === "verified" });
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

  if (!userId || !role || !ensName) {
    return res.status(400).json({ error: "userId, role, ensName are required" });
  }

  if (!["lender", "borrower"].includes(role)) {
    return res.status(400).json({ error: "role must be lender or borrower" });
  }

  if (!ensName.includes(".")) {
    return res.status(400).json({ error: "ensName must be a valid ENS name (e.g. alice.eth)" });
  }

  try {
    // Verify user is ZK-verified before allowing agent creation
    const { rows: userRows } = await db.query(
      `SELECT zk_proof_status FROM users WHERE user_id = $1`,
      [userId]
    );
    if (!userRows.length) {
      return res.status(404).json({ error: "user not found" });
    }
    if (userRows[0].zk_proof_status !== "verified") {
      return res.status(403).json({ error: "ZK human verification required before creating an agent" });
    }

    // Check ENS name not already taken
    const { rows: ensRows } = await db.query(
      `SELECT 1 FROM agents WHERE ens_name = $1`,
      [ensName]
    );
    if (ensRows.length) {
      return res.status(409).json({ error: "This ENS name is already registered on the platform" });
    }

    const agentId = randomUUID();
    const docId = `doc-${agentId}`;
    const agentWallet = ethers.Wallet.createRandom();

    setAgentPrivateKey(agentWallet.address, agentWallet.privateKey);
    putStrategyDoc(docId, strategy);

    const registerTx = await blockchain.registerAgent(agentWallet.address, Number(initialScore), ensName);

    // Auto-fund agent wallet with ETH for gas, then mint USDC and approve lending contract
    try {
      await blockchain.fundEth(agentWallet.address, "1.0");
      await blockchain.mintUsdc(agentWallet.address, 10000);
      await blockchain.approveUsdc(agentWallet.privateKey, 100000);
    } catch (mintErr: any) {
      console.warn(`[platform] auto-mint/approve failed (non-fatal): ${mintErr.message}`);
    }

    await db.query(
      `INSERT INTO agents (
         agent_id, user_id, ens_name, wallet_address, fileverse_doc_id, role, status, reputation_score, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())`,
      [agentId, userId, ensName, agentWallet.address, docId, role, Number(initialScore)]
    );

    return res.json({
      agentId,
      ensName,
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
