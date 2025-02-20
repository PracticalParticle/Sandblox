import SimpleVaultUI from './SimpleVault.ui';
import { Address } from 'viem';
import { WagmiProvider, createConfig } from 'wagmi';
import { http } from 'viem';
import { mainnet } from 'viem/chains';

// Mock contract address for preview
const MOCK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;
const MOCK_USER_ADDRESS = '0x2345678901234567890123456789012345678901' as Address;

// Mock data following .cursorrules web3-mocks guidelines
const mockData = {
  ethBalance: BigInt(2000000000000000000), // 2 ETH
  pendingTransactions: [
    {
      txId: 1,
      to: '0x1234...5678' as Address,
      amount: BigInt(1000000000000000000), // 1 ETH
      type: 'ETH',
      releaseTime: Math.floor(Date.now() / 1000) + 86400, // 24h from now
      status: 0 // PENDING
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

// Mock provider setup to override wagmi hooks
const PreviewProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <div className="preview-container w-full bg-background">
        {children}
      </div>
    </WagmiProvider>
  );
};

// Override the actual component's hooks with mock data
const MockedSimpleVaultUI = ({ contractAddress }: { contractAddress: Address }) => {
  // Return the UI with mocked props
  return (
    <div className="scale-[0.85] origin-top">
      <SimpleVaultUI contractAddress={contractAddress} />
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
