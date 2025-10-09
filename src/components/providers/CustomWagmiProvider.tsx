import { ReactNode } from 'react';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { injected } from 'wagmi/connectors';
import { getAllNetworks } from '@/lib/networkStorage';
import { Transport } from 'wagmi';
import type { Chain } from 'viem';

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

// Initialize transports dynamically based on available networks
function createTransports(): Record<number, Transport> {
  const transports: Record<number, Transport> = {};
  const networks = getAllNetworks();
  
  networks.forEach(network => {
    // Use the first RPC URL for each network
    const rpcUrl = network.rpcUrls.default.http[0];
    transports[network.id] = http(rpcUrl);
  });
  
  return transports;
}

// Get available chains dynamically
function getAvailableChains(): readonly [Chain, ...Chain[]] {
  const networks = getAllNetworks();
  if (networks.length === 0) {
    throw new Error('No networks available');
  }
  return networks as unknown as readonly [Chain, ...Chain[]];
}

// Always avoid WalletConnect to prevent relayer churn unless explicitly re-enabled later
const wagmiConfig = createConfig({
  chains: getAvailableChains(),
  transports: createTransports(),
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
