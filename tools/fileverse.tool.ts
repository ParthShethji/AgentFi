/**
 * tools/fileverse.tool.ts
 *
 * OpenClaw agent tool for ingesting encrypted Markdown strategy documents
 * from Fileverse dDoc secure URLs.
 *
 * Flow:
 *  1. User writes strategy in ddocs.new → browser encrypts → secure URL generated
 *  2. URL is fed to the agent (contains #key fragment — never sent to any server)
 *  3. This tool strips the key from the URL in VM memory
 *  4. Fetches the locked, encrypted payload from Fileverse's decentralised storage
 *  5. Decrypts the payload locally using @fileverse/crypto NaCl secretbox
 *  6. Parses the resulting Markdown into a structured strategy object
 */

import { ethers } from "ethers";
import { secretBoxDecrypt } from "@fileverse/crypto/nacl";
import { toBytes } from "@fileverse/crypto/utils";

// ─── Fileverse Portal ABI (minimal — only what we need) ───────────────────────
// The Portal contract stores an array of file metadata entries. Each entry has
// an IPFS content hash that points to the encrypted document payload.
const PORTAL_ABI = [
  "function getFiles(uint256 index) view returns (string metadataIpfsHash, string contentIpfsHash, address owner, uint8 fileType, uint8 status)",
  "function getFilesCount() view returns (uint256)",
];

// Fileverse Portal contracts are deployed on Ethereum Sepolia (chain ID 11155111),
// which is also where this project's ENS identity lives.
// Uses the same L1_SEPOLIA_RPC_URL already configured in .env.
const SEPOLIA_RPC = process.env.L1_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

// Public IPFS gateways — tried in order until one succeeds.
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedFileverseUrl {
  portalAddress: string;
  fileId: number;
  decryptionKey: string;
}

export interface StrategyDoc {
  maxLoanAmount: number;
  minReputation: number;
  interestRate: number;
  tradeAllocation: { ETH: number; stablecoin: number };
  repayAfterSeconds: number;
  signals: string[];
  raw: string;
}

// ─── 1. parseFileverseUrl ─────────────────────────────────────────────────────

/**
 * Parses a Fileverse dDoc secure URL into its constituent parts.
 *
 * Expected format:
 *   https://docs.fileverse.io/{portalAddress}/{fileId}#key={base64url_key}
 *
 * The #key fragment is held exclusively in the VM's active memory after this
 * call — it is never forwarded to any remote service.
 */
export function parseFileverseUrl(url: string): ParsedFileverseUrl {
  // Node's URL constructor does not expose the hash, so we split manually.
  const hashIdx = url.indexOf("#");
  const base = hashIdx !== -1 ? url.slice(0, hashIdx) : url;
  const fragment = hashIdx !== -1 ? url.slice(hashIdx + 1) : "";

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`[fileverse] Invalid URL: ${url}`);
  }

  // Extract key from fragment: "key=<value>"
  const keyMatch = fragment.match(/(?:^|&)key=([^&]+)/);
  if (!keyMatch) {
    throw new Error(
      "[fileverse] URL is missing the #key fragment. Make sure you copied the full secure URL."
    );
  }
  const decryptionKey = keyMatch[1];

  // Path format: /{portalAddress}/{fileId}
  const parts = parsed.pathname.replace(/^\//, "").split("/");
  if (parts.length < 2) {
    throw new Error(
      `[fileverse] URL path must be /{portalAddress}/{fileId}, got: ${parsed.pathname}`
    );
  }
  const portalAddress = parts[0];
  const fileId = parseInt(parts[1], 10);

  if (!ethers.isAddress(portalAddress)) {
    throw new Error(`[fileverse] Portal address is not a valid Ethereum address: ${portalAddress}`);
  }
  if (isNaN(fileId) || fileId < 0) {
    throw new Error(`[fileverse] File ID must be a non-negative integer, got: ${parts[1]}`);
  }

  return { portalAddress, fileId, decryptionKey };
}

// ─── 2. fetchEncryptedDoc ─────────────────────────────────────────────────────

/**
 * Fetches the raw encrypted document payload from Fileverse's decentralised
 * storage network (IPFS).
 *
 * Uses ethers.js to call the Portal contract on Gnosis chain to resolve the
 * file's IPFS content hash, then downloads the blob from a public gateway.
 * No decryption key is involved at this stage.
 */
export async function fetchEncryptedDoc(
  portalAddress: string,
  fileId: number
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const portal = new ethers.Contract(portalAddress, PORTAL_ABI, provider);

  let contentIpfsHash: string;
  try {
    const fileEntry = await portal.getFiles(fileId);
    // fileEntry is a tuple: [metadataIpfsHash, contentIpfsHash, owner, fileType, status]
    contentIpfsHash = fileEntry[1] as string;
  } catch (err: any) {
    throw new Error(
      `[fileverse] Failed to read file #${fileId} from portal ${portalAddress}: ${err.message}`
    );
  }

  if (!contentIpfsHash) {
    throw new Error(`[fileverse] Portal returned an empty IPFS hash for file #${fileId}`);
  }

  // Strip leading "ipfs://" if present — gateways expect just the CID.
  const cid = contentIpfsHash.replace(/^ipfs:\/\//, "");

  let lastError: Error | null = null;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      return text;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(
    `[fileverse] All IPFS gateways failed for CID ${cid}. Last error: ${lastError?.message}`
  );
}

// ─── 3. decryptDoc ────────────────────────────────────────────────────────────

/**
 * Decrypts an encrypted Fileverse document payload entirely within this
 * process's memory.
 *
 * The dDoc browser app encrypts content with NaCl secretbox (TweetNaCl)
 * using a random 32-byte key encoded as URL-safe base64 in the #key fragment.
 *
 * At no point is the plaintext or the key transmitted over the network.
 */
export function decryptDoc(encryptedPayload: string, keyBase64url: string): string {
  // Convert URL-safe base64 → standard base64 → Uint8Array
  const standardB64 = keyBase64url.replace(/-/g, "+").replace(/_/g, "/");
  const keyBytes = toBytes(standardB64);

  if (keyBytes.length !== 32) {
    throw new Error(
      `[fileverse] Decryption key must be 32 bytes, got ${keyBytes.length}. ` +
      "Ensure the full URL (including #key fragment) was provided."
    );
  }

  let decrypted: Uint8Array;
  try {
    decrypted = secretBoxDecrypt(keyBytes, encryptedPayload);
  } catch (err: any) {
    throw new Error(
      `[fileverse] Local decryption failed — the key may not match this document: ${err.message}`
    );
  }

  return new TextDecoder().decode(decrypted);
}

// ─── 4. parseStrategyMarkdown ─────────────────────────────────────────────────

/**
 * Parses a Markdown strategy document into a structured StrategyDoc object.
 *
 * Recognises a set of common headings and bullet patterns that users naturally
 * write when describing a trading strategy. All fields fall back to safe
 * defaults so a partially-specified document still produces a valid strategy.
 *
 * Example Markdown patterns recognised:
 *   - "Maximum loan: 500 USDC"         → maxLoanAmount: 500
 *   - "Minimum reputation: 80"         → minReputation: 80
 *   - "Interest rate: 2.5%"            → interestRate: 2.5
 *   - "ETH allocation: 70%"            → tradeAllocation.ETH: 70
 *   - "Repay after: 60 seconds"        → repayAfterSeconds: 60
 *   - "Stop-loss at 5%"                → included in raw, logged
 */
export function parseStrategyMarkdown(markdown: string): StrategyDoc {
  const text = markdown;

  const extract = (patterns: RegExp[]): number | null => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return parseFloat(m[1]);
    }
    return null;
  };

  const maxLoanAmount = extract([
    /max(?:imum)?\s+(?:loan|single\s+loan|amount)[:\s]+(\d+(?:\.\d+)?)/i,
    /borrow\s+max(?:imum)?\s+(\d+(?:\.\d+)?)\s+USDC/i,
    /loan\s+cap[:\s]+(\d+(?:\.\d+)?)/i,
  ]) ?? 500;

  const minReputation = extract([
    /min(?:imum)?\s+rep(?:utation)?[:\s]+(\d+(?:\.\d+)?)/i,
    /reputation\s+above\s+(\d+(?:\.\d+)?)/i,
    /rep\s+score\s*[>≥]\s*(\d+(?:\.\d+)?)/i,
  ]) ?? 25;

  const interestRate = extract([
    /interest\s+rate[:\s]+(\d+(?:\.\d+)?)%?/i,
    /min(?:imum)?\s+interest[:\s]+(\d+(?:\.\d+)?)%?/i,
    /rate[:\s]+(\d+(?:\.\d+)?)%/i,
  ]) ?? 2.0;

  const ethAlloc = extract([
    /ETH\s+(?:allocation|weight)[:\s]+(\d+(?:\.\d+)?)%?/i,
    /(\d+(?:\.\d+)?)%?\s+ETH/i,
  ]) ?? 60;
  const tradeAllocation = {
    ETH: ethAlloc,
    stablecoin: Math.max(0, 100 - ethAlloc),
  };

  const repayAfterSeconds = extract([
    /repay\s+after[:\s]+(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i,
    /hold\s+(?:time|period|for)[:\s]+(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/i,
    /(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?\s+(?:hold|before\s+repay)/i,
  ]) ?? 30;

  // Extract any mentioned asset pairs / signal tickers as signals array
  const tickerMatches = text.match(/\b([A-Z]{2,6}\/[A-Z]{2,6})\b/g) || [];
  const signals = [...new Set(tickerMatches)];

  return {
    maxLoanAmount,
    minReputation,
    interestRate,
    tradeAllocation,
    repayAfterSeconds,
    signals,
    raw: markdown,
  };
}

// ─── 5. ingestStrategyFromFileverseUrl ────────────────────────────────────────

/**
 * Main entry point.
 *
 * Given a Fileverse dDoc secure URL (with #key fragment), performs the full
 * fetch-decrypt-parse pipeline and returns a strategy object ready for the
 * OpenClaw agent to consume.
 *
 * The decryption key is extracted from the URL hash, used in-memory, and
 * never logged or transmitted. The encrypted blob travels only from IPFS to
 * this process; the plaintext never leaves the VM.
 */
export async function ingestStrategyFromFileverseUrl(url: string): Promise<StrategyDoc> {
  // Step 1 — parse URL, extract key into memory only
  const { portalAddress, fileId, decryptionKey } = parseFileverseUrl(url);

  // Step 2 — fetch encrypted payload from decentralised storage
  const encryptedPayload = await fetchEncryptedDoc(portalAddress, fileId);

  // Step 3 — decrypt locally; key is held in this call frame only
  const markdownText = decryptDoc(encryptedPayload, decryptionKey);

  // Step 4 — parse Markdown into structured strategy fields
  const strategy = parseStrategyMarkdown(markdownText);

  return strategy;
}
