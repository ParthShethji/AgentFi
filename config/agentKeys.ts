const keyByWallet = new Map<string, string>();

export function setAgentPrivateKey(walletAddress: string, privateKey: string) {
  keyByWallet.set(walletAddress.toLowerCase(), privateKey);
}

export function getAgentPrivateKey(walletAddress: string): string | null {
  return keyByWallet.get(walletAddress.toLowerCase()) || null;
}
