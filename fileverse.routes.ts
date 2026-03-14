import { Router } from "express";
import { getStrategyDoc, putStrategyDoc } from "./utils/strategyStore";
import { ingestStrategyFromFileverseUrl } from "./tools/fileverse.tool";

// @ts-ignore
const logger = process.env.NODE_ENV === "test" ? console : require("./utils/logger");

const router = Router();

router.get("/docs/:docId", (req, res) => {
  const doc = getStrategyDoc(req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: "doc not found" });
  }
  return res.json(doc);
});

router.put("/docs/:docId", (req, res) => {
  putStrategyDoc(req.params.docId, req.body || {});
  return res.json({ docId: req.params.docId, updated: true });
});

/**
 * POST /fileverse/ingest
 *
 * Ingests a strategy from a Fileverse dDoc secure URL and stores it in the
 * strategy store under the agent's docId. Useful for live strategy updates
 * without rebooting the agent process.
 *
 * Body: { url: string, agentId: string }
 *
 * The #key fragment in the URL is stripped and held in VM memory only.
 * The encrypted document is fetched from IPFS and decrypted locally.
 * The plaintext is never transmitted over the network.
 */
router.post("/ingest", async (req, res) => {
  const { url, agentId } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId is required" });
  }
  if (!url.startsWith("https://")) {
    return res.status(400).json({ error: "url must be a valid https:// Fileverse dDoc URL" });
  }

  try {
    logger.info(`[fileverse/ingest] ingesting strategy for agent=${agentId}`);
    const strategy = await ingestStrategyFromFileverseUrl(url);

    const docId = `doc-${agentId}`;
    putStrategyDoc(docId, strategy);

    logger.info(`[fileverse/ingest] strategy stored docId=${docId}`);
    return res.json({ agentId, docId, strategy });
  } catch (err: any) {
    logger.error(`[fileverse/ingest] failed: ${err.message}`);
    return res.status(500).json({ error: err.message || "Failed to ingest strategy from Fileverse" });
  }
});

export = router;
