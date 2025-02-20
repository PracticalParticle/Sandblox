import { Chain } from 'viem';

export const localDevnet = {
  id: Number(import.meta.env.VITE_LOCAL_DEVNET_CHAIN_ID),
  name: import.meta.env.VITE_LOCAL_DEVNET_NAME,
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_LOCAL_DEVNET_RPC_URL],
    },
    public: {
      http: [import.meta.env.VITE_LOCAL_DEVNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: { name: 'Local Explorer', url: '#' },
  },
  testnet: true,
} as const satisfies Chain; 