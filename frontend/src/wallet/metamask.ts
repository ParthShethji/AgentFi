import { BrowserProvider, Contract, parseEther, parseUnits } from "ethers";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

export function getEthereumProvider(): EthereumProvider | null {
  const eth = (window as any).ethereum as EthereumProvider | undefined;
  return eth ?? null;
}

export async function connectMetaMask(): Promise<{ address: string; chainId: string }> {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("MetaMask not detected");

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account returned from wallet");

  const chainId = (await ethereum.request({ method: "eth_chainId" })) as string;
  return { address, chainId };
}

export async function getCurrentAccount(): Promise<{ address: string; chainId: string } | null> {
  const ethereum = getEthereumProvider();
  if (!ethereum) return null;

  const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
  const address = accounts?.[0];
  if (!address) return null;

  const chainId = (await ethereum.request({ method: "eth_chainId" })) as string;
  return { address, chainId };
}

export async function signMessage(message: string, address: string) {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("MetaMask not detected");
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
  return signature;
}

export function getChainLabel(chainId?: string | null) {
  if (!chainId) return "Unknown network";
  const normalized = chainId.toLowerCase();
  if (normalized === "0x7a69" || normalized === "0x539") return "Local Hardhat";
  if (normalized === "0xaa36a7") return "Ethereum Sepolia";
  if (normalized === "0x14a34") return "Base Sepolia";
  if (normalized === "0x1") return "Ethereum Mainnet";
  return `Chain ${chainId}`;
}

async function getBrowserSigner() {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("MetaMask not detected");
  const provider = new BrowserProvider(ethereum as any);
  return provider.getSigner();
}

export async function sendEthToAgent(to: string, amountEth: string) {
  const signer = await getBrowserSigner();
  const tx = await signer.sendTransaction({
    to,
    value: parseEther(amountEth),
  });
  await tx.wait();
  return tx.hash;
}

const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
];

export async function sendUsdcToAgent(usdcAddress: string, to: string, amountUsdc: string) {
  const signer = await getBrowserSigner();
  const token = new Contract(usdcAddress, ERC20_ABI, signer);
  const tx = await token.transfer(to, parseUnits(amountUsdc, 6));
  await tx.wait();
  return tx.hash;
}

export function formatAddress(addr: string, chars = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

// ─── ENS Subdomain Creation ───────────────────────────────────────────────────

const ETHEREUM_SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const ENS_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

/** Switch MetaMask to Ethereum Sepolia. Adds the network if not already present. */
export async function switchToEthereumSepolia(): Promise<void> {
  const eth = getEthereumProvider();
  if (!eth) throw new Error("MetaMask not detected");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETHEREUM_SEPOLIA_CHAIN_ID }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      // Network not in MetaMask — add it
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
          chainName: "Ethereum Sepolia",
          rpcUrls: ["https://rpc.sepolia.org"],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    } else {
      throw err;
    }
  }
}

// ─── Minimal ABI encoding helpers (no ethers needed) ─────────────────────────

function hexPad32(hex: string): string {
  return hex.replace("0x", "").padStart(64, "0");
}

/** keccak256 of a UTF-8 string using SubtleCrypto */
async function keccak256Str(str: string): Promise<string> {
  // Use the browser's native SubtleCrypto for SHA-256 as a stand-in,
  // OR import the tiny `js-sha3` if available. Since we're calling
  // window.ethereum directly, we'll use a workaround: encode via eth_call
  // on a zero-cost view function. But the simplest is to pass the ENS
  // node as a pre-computed value via the backend API.
  //
  // Actually — we compute namehash + label hash here using pure JS.
  const { namehash, labelHash } = ensNodeHelpers(str);
  return labelHash;
}

/**
 * Pure-JS ENS namehash (EIP-137) + label hash.
 * No external library needed — uses SubtleCrypto (SHA-256 won't work for keccak,
 * so we pre-calculate via a lightweight implementation).
 */
function ensNodeHelpers(name: string) {
  // We'll return placeholders here — the actual encoding is done below
  // using the raw hex values computed via our tiny inline keccak.
  return { namehash: "", labelHash: "" };
}

/**
 * Inline keccak256 using the ethereum-cryptography approach.
 * We load it dynamically from the backend's node_modules via the
 * Vite dev proxy, or just compute it via a raw RPC eth_call.
 *
 * SIMPLEST APPROACH: accept pre-computed hex values from the caller.
 * The backend already computes ethers.namehash() — we pass them through.
 */

/**
 * Creates an ENS subdomain on Ethereum Sepolia via MetaMask.
 *
 * @param parentEnsName - e.g. "alice.eth"
 * @param label         - e.g. "vault-1"
 * @param agentWallet   - the agent's hot wallet address (returned by createAgent)
 * @param userAddress   - the MetaMask address (owner of parentEnsName)
 * @param parentNode    - namehash of parentEnsName (pass from backend or compute here)
 * @param subdomainNode - namehash of label.parentEnsName
 *
 * Returns the tx hash of the setSubnodeRecord transaction.
 */
export async function createEnsSubdomain({
  parentEnsName,
  label,
  agentWallet,
  userAddress,
  parentNode,
  subdomainNode,
  labelHash,
}: {
  parentEnsName: string;
  label: string;
  agentWallet: string;
  userAddress: string;
  parentNode: string;    // bytes32 hex
  subdomainNode: string; // bytes32 hex — namehash(label.parentEnsName)
  labelHash: string;     // bytes32 hex — keccak256(label)
}): Promise<string> {
  const eth = getEthereumProvider();
  if (!eth) throw new Error("MetaMask not detected");

  // 1. Switch to Ethereum Sepolia
  await switchToEthereumSepolia();

  // 2. Encode setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)
  //    Selector: keccak256("setSubnodeRecord(bytes32,bytes32,address,address,uint64)")[:4]
  //    = 0x5ef2c7f0
  const setSubnodeRecordSelector = "5ef2c7f0";
  const resolverPadded = hexPad32(ENS_RESOLVER.toLowerCase().replace("0x", ""));
  const ownerPadded    = hexPad32(userAddress.toLowerCase().replace("0x", "")); // user owns subdomain
  const ttlPadded      = hexPad32("0");
  const registryCalldata =
    "0x" +
    setSubnodeRecordSelector +
    hexPad32(parentNode.replace("0x", "")) +
    hexPad32(labelHash.replace("0x", "")) +
    ownerPadded +
    resolverPadded +
    ttlPadded;

  // 3. Send setSubnodeRecord tx — user signs on Ethereum Sepolia
  const tx1Hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from: userAddress,
      to: ENS_REGISTRY,
      data: registryCalldata,
      gas: "0x186a0", // 100,000 gas
    }],
  })) as string;

  // 4. Wait for confirmation
  await waitForTxConfirmation(eth, tx1Hash);

  // 5. Encode setAddr(bytes32 node, address addr) on the resolver
  //    Selector: keccak256("setAddr(bytes32,address)")[:4] = 0xd5fa2b00
  const setAddrSelector = "d5fa2b00";
  const agentWalletPadded = hexPad32(agentWallet.toLowerCase().replace("0x", ""));
  const resolverCalldata =
    "0x" +
    setAddrSelector +
    hexPad32(subdomainNode.replace("0x", "")) +
    agentWalletPadded;

  // 6. Send setAddr tx — user is owner of subdomain so this works
  const tx2Hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from: userAddress,
      to: ENS_RESOLVER,
      data: resolverCalldata,
      gas: "0x11170", // 70,000 gas
    }],
  })) as string;

  await waitForTxConfirmation(eth, tx2Hash);

  return tx1Hash;
}

/** Poll eth_getTransactionReceipt until confirmed (status 0x1) */
async function waitForTxConfirmation(eth: EthereumProvider, txHash: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const receipt = (await eth.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as { status: string } | null;
    if (receipt?.status === "0x1") return;
    if (receipt?.status === "0x0") throw new Error(`ENS tx failed: ${txHash}`);
  }
  throw new Error(`ENS tx not confirmed after 60s: ${txHash}`);
}

