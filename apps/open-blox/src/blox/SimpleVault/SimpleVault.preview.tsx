import SimpleVaultUI from './SimpleVault.ui';
import { Address } from 'viem';
import { WagmiProvider, createConfig } from 'wagmi';
import { http } from 'viem';
import { mainnet } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';

// Mock contract address for preview
const MOCK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;
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
      status: 0 // PENDING
    },
    {
      txId: 2,
      to: '0x5678...9012' as Address,
      amount: BigInt(500000000000000000), // 0.5 ETH
      type: 'ETH',
      releaseTime: Math.floor(Date.now() / 1000) - 3600, // 1h ago (ready)
      status: 1 // READY
    }
  ]
};

// Create a mock wagmi config
const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http()
  }
});

// Create a new QueryClient instance
const queryClient = new QueryClient();

// Mock provider setup to override wagmi hooks
const PreviewProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <JotaiProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <div className="preview-container w-full bg-background p-6">
            {children}
          </div>
        </QueryClientProvider>
      </WagmiProvider>
    </JotaiProvider>
  );
};

// Mock component that overrides the web3 hooks
const MockedSimpleVaultUI = ({ contractAddress }: { contractAddress: Address }) => {
  // Override useAccount
  const mockAccount = {
    address: MOCK_USER_ADDRESS,
    isConnected: true
  };

  // Override usePublicClient
  const mockPublicClient = {
    getBalance: async () => mockVaultData.ethBalance,
    readContract: async ({ functionName }: any) => {
      switch (functionName) {
        case 'getPendingTransactions':
          return mockVaultData.pendingTransactions;
        default:
          return [];
      }
    }
  };

  // Override useWalletClient
  const mockWalletClient = {
    writeContract: async () => ({
      hash: '0x1234...5678',
      wait: async () => ({})
    })
  };

  // Mock chain data
  const mockChain = {
    id: 1,
    name: 'Ethereum',
    network: 'mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [''] } },
    blockExplorers: { default: { url: '' } },
  };

  // Return the UI with mocked context
  return (
    <div className="scale-[0.85] origin-top">
      <SimpleVaultUI 
        contractAddress={contractAddress}
        _mock={{
          account: mockAccount,
          publicClient: mockPublicClient,
          walletClient: { data: mockWalletClient },
          chain: mockChain,
          initialData: {
            ethBalance: mockVaultData.ethBalance,
            pendingTransactions: mockVaultData.pendingTransactions
          }
        }}
      />
    </div>
  );
};

export default function SimpleVaultPreview() {
  return (
    <PreviewProvider>
      <MockedSimpleVaultUI contractAddress={MOCK_CONTRACT_ADDRESS} />
    </PreviewProvider>
  );
}
