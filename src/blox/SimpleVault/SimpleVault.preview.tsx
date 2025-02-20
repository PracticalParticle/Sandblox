import SimpleVaultUI from './SimpleVault.ui';
import { Address } from 'viem';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { mainnet } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { useState } from 'react';
import { ContractInfo } from '@/lib/verification/index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Component, type ReactNode } from 'react';

// Error boundary component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Something went wrong rendering the preview. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Mock contract address for preview
const MOCK_CONTRACT_ADDRESS = '0xe73F9B85b3a040F9AD6422C1Ea4864C2Db0c2cdD' as Address;
const MOCK_USER_ADDRESS = '0x2345678901234567890123456789012345678901' as Address;

// Mock data following .cursorrules web3-mocks guidelines
const mockVaultData = {
  ethBalance: BigInt(2000000000000000000), // 2 ETH
  pendingTransactions: [
    {
      txId: 1,
      to: '0x1234...5678' as Address,
      amount: BigInt(1000000000000000000), // 1 ETH
      type: 'ETH',
      releaseTime: Math.floor(Date.now() / 1000) + 43200, // 12h from now
      status: 0, // PENDING
      operationType: 'WITHDRAW_ETH'
    },
    {
      txId: 2,
      to: '0x5678...9012' as Address,
      amount: BigInt(500000000000000000), // 0.5 ETH
      type: 'ETH',
      releaseTime: Math.floor(Date.now() / 1000) - 3600, // 1h ago (ready)
      status: 1, // READY
      operationType: 'WITHDRAW_ETH'
    }
  ]
};

// Create wagmi config
const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http()
  }
});

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

// Mock component that overrides the web3 hooks
function MockedSimpleVaultUI() {
  const [contractInfo] = useState<ContractInfo>({
    address: MOCK_CONTRACT_ADDRESS,
    type: 'simple-vault',
    name: 'Simple Vault',
    category: 'Storage',
    description: 'A secure vault contract for storing and managing assets with basic access controls.',
    bloxId: 'simple-vault'
  });

  // Mock data and hooks
  const mockAccount = {
    address: MOCK_USER_ADDRESS,
    isConnected: true
  };

  const mockPublicClient = {
    getBalance: async () => mockVaultData.ethBalance,
    readContract: async ({ functionName, args = [] }: any) => {
      console.log('Reading contract:', functionName, args);
      switch (functionName) {
        case 'getPendingTransactions':
          return mockVaultData.pendingTransactions;
        case 'getOperationHistory':
          return mockVaultData.pendingTransactions.map(tx => ({
            ...tx,
            operationType: 'WITHDRAW_ETH',
            status: tx.status === 0 ? 'PENDING' : 'READY'
          }));
        default:
          return [];
      }
    },
    multicall: async ({ contracts }: any) => {
      return contracts.map((c: any) => {
        console.log('Multicall:', c.functionName, c.args);
        switch (c.functionName) {
          case 'getPendingTransactions':
            return { result: mockVaultData.pendingTransactions, status: 'success' };
          case 'getOperationHistory':
            return {
              result: mockVaultData.pendingTransactions.map(tx => ({
                ...tx,
                operationType: 'WITHDRAW_ETH',
                status: tx.status === 0 ? 'PENDING' : 'READY'
              })),
              status: 'success'
            };
          default:
            return { result: [], status: 'success' };
        }
      });
    }
  };

  const mockWalletClient = {
    data: {
      account: mockAccount,
      chain: {
        id: 1,
        name: 'Ethereum',
        network: 'mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [''] } },
        blockExplorers: { default: { url: '' } },
      },
      writeContract: async () => ({
        hash: '0x1234...5678',
        wait: async () => ({})
      })
    }
  };

  return (
    <div className="preview-container w-full bg-background p-6">
      <div className="scale-[0.85] origin-top">
        <SimpleVaultUI 
          contractAddress={MOCK_CONTRACT_ADDRESS}
          contractInfo={contractInfo}
          _mock={{
            account: mockAccount,
            publicClient: mockPublicClient,
            walletClient: mockWalletClient,
            chain: mockWalletClient.data.chain,
            initialData: {
              ethBalance: mockVaultData.ethBalance,
              pendingTransactions: mockVaultData.pendingTransactions
            }
          }}
          dashboardMode={true} // Use dashboard mode to avoid Tabs
        />
      </div>
    </div>
  );
}

// Wrap everything in a single component to ensure proper provider context
export default function SimpleVaultPreview() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <MockedSimpleVaultUI />
          </JotaiProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
