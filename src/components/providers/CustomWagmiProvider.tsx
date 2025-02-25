import { ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';
import { localDevnet } from '@/config/chains';
import { Transport } from 'wagmi';

// Create a new QueryClient instance
const queryClient = new QueryClient();

// Initialize transports based on available environment variables
const transports: Record<number, Transport> = {
  [mainnet.id]: http(),
  [sepolia.id]: http()
};

// Always add local devnet transport
transports[localDevnet.id] = http(localDevnet.rpcUrls.default.http[0]);

const availableChains = [localDevnet, mainnet, sepolia] as const;

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
