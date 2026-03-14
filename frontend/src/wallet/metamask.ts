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

export function formatAddress(addr: string, chars = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

