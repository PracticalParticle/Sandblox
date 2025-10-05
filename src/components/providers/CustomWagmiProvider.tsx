import { ReactNode } from 'react';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { injected } from 'wagmi/connectors';
// import { sepolia, bscTestnet, zkSyncSepoliaTestnet, polygonAmoy, baseSepolia, arbitrumSepolia, optimismSepolia } from 'wagmi/chains';
import { devnet, sepolia, arbitrumSepolia, zksyncSepoliaTestnet } from '@/config/chains';
import { Transport } from 'wagmi';

// Create a new QueryClient instance with conservative defaults to avoid rate limits
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // cache results for 1 minute by default
      gcTime: 5 * 60_000, // keep in cache for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: false, // avoid hammering rate-limited public RPCs
    },
    mutations: {
      retry: false,
    },
  },
});

// Initialize transports (use chain defaults to allow internal batching where supported)
const transports: Record<number, Transport> = {
  [sepolia.id]: http(),
  [arbitrumSepolia.id]: http(),
  [zksyncSepoliaTestnet.id]: http(),
};

// Add devnet transport
transports[devnet.id] = http(devnet.rpcUrls.default.http[0]);

const availableChains = [devnet, sepolia, arbitrumSepolia, zksyncSepoliaTestnet] as const;

// Always avoid WalletConnect to prevent relayer churn unless explicitly re-enabled later
const wagmiConfig = createConfig({
  chains: availableChains,
  transports,
  ssr: false,
  connectors: [injected()],
});

interface CustomWagmiProviderProps {
  children: ReactNode;
}

export function CustomWagmiProvider({ children }: CustomWagmiProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
         // showRecentTransactions={true}
          appInfo={{
            appName: 'SandBlox',
            learnMoreUrl: 'https://sandblox.app/',
          }}
          theme={{
            lightMode: lightTheme(),
            darkMode: darkTheme(),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
