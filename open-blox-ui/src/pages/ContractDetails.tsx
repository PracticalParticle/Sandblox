import { useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'

interface ContractDetails {
  id: string
  name: string
  description: string
  category: string
  securityLevel: 'Basic' | 'Advanced' | 'Enterprise'
  features: string[]
  requirements: string[]
  code: string
}

const MOCK_CONTRACT_DETAILS: Record<string, ContractDetails> = {
  'simple-vault': {
    id: 'simple-vault',
    name: 'Simple Vault',
    description: 'A secure vault contract for storing and managing assets with basic access controls.',
    category: 'Storage',
    securityLevel: 'Basic',
    features: [
      'Secure asset storage',
      'Owner-only withdrawals',
      'Emergency pause functionality',
      'Event logging',
    ],
    requirements: [
      'Ethereum wallet',
      'ETH for gas fees',
    ],
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleVault {
    address public owner;
    bool public paused;
    
    event Deposit(address indexed sender, uint amount);
    event Withdrawal(address indexed recipient, uint amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    receive() external payable notPaused {
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint _amount) external onlyOwner notPaused {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(_amount);
        emit Withdrawal(owner, _amount);
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
}`,
  },
}

export function ContractDetails() {
  const { contractId } = useParams<{ contractId: string }>()
  const { isConnected } = useAccount()

  const contract = contractId ? MOCK_CONTRACT_DETAILS[contractId] : null

  if (!contract) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Contract Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The contract you're looking for doesn't exist.
          </p>
          <a
            href="/blox-contracts"
            className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            ← Back to Blox Contracts
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-8">
        <div className="flex flex-col space-y-4">
          <a
            href="/blox-contracts"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            ← Back to Blox Contracts
          </a>
          <h1 className="text-3xl font-bold tracking-tight">{contract.name}</h1>
          <div className="flex space-x-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {contract.category}
            </span>
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              {contract.securityLevel}
            </span>
          </div>
          <p className="text-lg text-muted-foreground">{contract.description}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Features</h2>
            <ul className="list-inside list-disc space-y-2">
              {contract.features.map((feature) => (
                <li key={feature} className="text-muted-foreground">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Requirements</h2>
            <ul className="list-inside list-disc space-y-2">
              {contract.requirements.map((requirement) => (
                <li key={requirement} className="text-muted-foreground">
                  {requirement}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Contract Code</h2>
          <div className="rounded-lg border bg-muted p-4">
            <pre className="overflow-x-auto text-sm">
              <code>{contract.code}</code>
            </pre>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            disabled={!isConnected}
          >
            {isConnected ? 'Deploy Contract' : 'Connect Wallet to Deploy'}
          </button>
        </div>
      </div>
    </div>
  )
} 