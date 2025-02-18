import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';
import { http } from 'viem';

const wagmiConfig = getDefaultConfig({
  appName: 'Your App Name',
  projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
  },
});

interface CustomWagmiProviderProps {
  children: ReactNode;
}

export function CustomWagmiProvider({ children }: CustomWagmiProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <div className="rainbow-kit-scope">
        <RainbowKitProvider modalSize="compact">
          {children}
        </RainbowKitProvider>
      </div>
    </WagmiProvider>
  );
}
