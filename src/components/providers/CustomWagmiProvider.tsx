import { ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
// import { sepolia, bscTestnet, zkSyncSepoliaTestnet, polygonAmoy, baseSepolia, arbitrumSepolia, optimismSepolia } from 'wagmi/chains';
import { devnet, sepolia, arbitrumSepolia, zksyncSepoliaTestnet } from '@/config/chains';
import { Transport } from 'wagmi';

// Create a new QueryClient instance
const queryClient = new QueryClient();

// Initialize transports based on available environment variables
const transports: Record<number, Transport> = {
  [sepolia.id]: http(),
  [arbitrumSepolia.id]: http(),
  [zksyncSepoliaTestnet.id]: http()
};

// Add devnet transport
transports[devnet.id] = http(devnet.rpcUrls.default.http[0]);

const availableChains = [devnet, sepolia, arbitrumSepolia, zksyncSepoliaTestnet] as const;

// Ensure projectId is properly initialized
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

const wagmiConfig = getDefaultConfig({
  appName: import.meta.env.VITE_APP_NAME || 'SandBlox',
  projectId,
  chains: availableChains,
  transports,
  ssr: false, // Disable SSR
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
            appName: import.meta.env.VITE_APP_NAME || 'SandBlox',
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
