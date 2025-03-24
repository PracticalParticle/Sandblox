import { ReactNode } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';
import { devnet } from '@/config/chains';
import { Transport } from 'wagmi';

// Create a new QueryClient instance
const queryClient = new QueryClient();

// Initialize transports based on available environment variables
const transports: Record<number, Transport> = {
  [mainnet.id]: http(),
  [sepolia.id]: http()
};

// Add devnet transport
transports[devnet.id] = http(devnet.rpcUrls.default.http[0]);

const availableChains = [devnet, mainnet, sepolia] as const;

// Ensure projectId is properly initialized
const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '';

const wagmiConfig = getDefaultConfig({
  appName: import.meta.env.VITE_APP_NAME || 'SandBlox UI',
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
          appInfo={{
            appName: import.meta.env.VITE_APP_NAME || 'SandBlox',
            learnMoreUrl: 'https://sandblox.app/',
          }}
          theme={{
            lightMode: lightTheme({
              overlayBlur: 'small',
            }),
            darkMode: darkTheme({
              overlayBlur: 'small',
            }),
          }}
          coolMode
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
