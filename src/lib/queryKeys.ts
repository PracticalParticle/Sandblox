export const queryKeys = {
  contract: {
    roles: (chainId: number, address: string) => ['contract', 'roles', chainId, address.toLowerCase()] as const,
    safe: {
      pendingTxs: (chainId: number, safeAddress: string) => ['safe', 'pendingTxs', chainId, safeAddress.toLowerCase()] as const,
      info: (chainId: number, safeAddress: string) => ['safe', 'info', chainId, safeAddress.toLowerCase()] as const,
    },
  },
  wallet: {
    balances: (address: string, tokenAddresses: string[]) => ['wallet', 'balances', address.toLowerCase(), tokenAddresses.sort()] as const,
  },
  operations: {
    history: (chainId: number, contractAddress: string) => ['operations', 'history', chainId, contractAddress.toLowerCase()] as const,
    pendingTxs: (chainId: number, contractAddress: string) => ['operations', 'pendingTxs', chainId, contractAddress.toLowerCase()] as const,
    types: (chainId: number, contractAddress: string) => ['operations', 'types', chainId, contractAddress.toLowerCase()] as const,
  },
};


