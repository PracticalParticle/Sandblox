import type { Chain } from 'viem';
import { env } from './env';

export const devnet = {
  id: env.DEVNET_CHAIN_ID,
  name: env.DEVNET_NAME,
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [env.DEVNET_RPC_URL],
    },
    public: {
      http: [env.DEVNET_RPC_URL],
    },
  },
  blockExplorers: env.DEVNET_EXPLORER_URL ? {
    default: { name: env.DEVNET_NAME, url: env.DEVNET_EXPLORER_URL },
  } : undefined,
  testnet: true,
} as const satisfies Chain; 