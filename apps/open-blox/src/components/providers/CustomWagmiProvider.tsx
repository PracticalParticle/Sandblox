import { ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';
import { Chain } from 'viem';
import { localDevnet } from '@/config/chains';

// Create a new QueryClient instance
const queryClient = new QueryClient();

// Initialize transports based on available environment variables
const transports: Record<number, ReturnType<typeof http>> = {};

// Add mainnet transport if API key is available
if (import.meta.env.VITE_ALCHEMY_API_KEY) {
  transports[mainnet.id] = http(`https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`);
  transports[sepolia.id] = http(`https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`);
}

// Always add local devnet transport
transports[localDevnet.id] = http(localDevnet.rpcUrls.default.http[0]);

// Get available chains based on transports
const availableChains = import.meta.env.VITE_ALCHEMY_API_KEY 
  ? [localDevnet, mainnet, sepolia] as const
  : [localDevnet] as const;

const wagmiConfig = getDefaultConfig({
  appName: import.meta.env.VITE_APP_NAME || 'OpenBlox UI',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '',
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
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
