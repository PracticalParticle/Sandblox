import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { mainnet } from 'viem/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const createTestConfig = () => {
  return getDefaultConfig({
    appName: 'Test App',
    projectId: 'test-project-id',
    chains: [mainnet],
  });
};

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export function renderWithProviders(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient() } = {}
) {
  const config = createTestConfig();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
  };
} 