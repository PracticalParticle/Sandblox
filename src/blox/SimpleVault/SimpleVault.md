# SimpleVault Technical Documentation

## Overview

SimpleVault is a secure digital asset vault built on Particle's Account Abstraction framework. It provides enhanced security for storing ETH and ERC20 tokens through a multi-phase security model featuring time-delayed operations, role-based access control, and meta-transaction support.

## Architecture

SimpleVault extends the `SecureOwnable` contract to implement a secure vault for ETH and ERC20 tokens with the following key features:

- **Time-Delayed Operations**: Critical withdrawal operations require a mandatory waiting period before execution
- **Role-Based Security**: Separation of owner, broadcaster, and recovery roles with distinct permissions
- **Meta-Transaction Support**: Gasless transaction capabilities while maintaining security guarantees
- **Multi-Phase Security**: Two-phase operations (request → delayed approval) for withdrawals

## Core Components

### Smart Contract Architecture

The SimpleVault contract is implemented in Solidity and extends the SecureOwnable base contract:

```solidity
contract SimpleVault is SecureOwnable {
    // Operation types
    bytes32 public constant WITHDRAW_ETH = keccak256("WITHDRAW_ETH");
    bytes32 public constant WITHDRAW_TOKEN = keccak256("WITHDRAW_TOKEN");
    
    // Function selectors
    bytes4 private constant WITHDRAW_ETH_SELECTOR = bytes4(keccak256("executeWithdrawEth(address,uint256)"));
    bytes4 private constant WITHDRAW_TOKEN_SELECTOR = bytes4(keccak256("executeWithdrawToken(address,address,uint256)"));
    
    // Timelock constraints
    uint256 private constant MIN_TIMELOCK_PERIOD = 24 * 60; // 1 day
    uint256 private constant MAX_TIMELOCK_PERIOD = 90 * 24 * 60; // 90 days
    
    // Events
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EthReceived(address indexed from, uint256 amount);
    
    // Implementation...
}
```

### TypeScript SDK

The SimpleVault TypeScript SDK provides a client-side interface for interacting with the smart contract:

```typescript
export default class SimpleVault extends SecureOwnable {
  // Constants
  static readonly WITHDRAW_ETH = "WITHDRAW_ETH";
  static readonly WITHDRAW_TOKEN = "WITHDRAW_TOKEN";
  
  // Core functionality
  async getEthBalance(): Promise<bigint>
  async getTokenBalance(token: Address): Promise<bigint>
  async withdrawEthRequest(to: Address, amount: bigint, options: TransactionOptions): Promise<TransactionResult>
  async withdrawTokenRequest(token: Address, to: Address, amount: bigint, options: TransactionOptions): Promise<TransactionResult>
  async approveWithdrawalAfterDelay(txId: number, options: TransactionOptions): Promise<TransactionResult>
  async cancelWithdrawal(txId: number, options: TransactionOptions): Promise<TransactionResult>
  async approveWithdrawalWithMetaTx(metaTx: MetaTransaction, options: TransactionOptions): Promise<TransactionResult>
  // Additional methods...
}
```

### UI Components

The vault includes a React-based UI for easy interaction, supporting:
- Asset balance display
- Withdrawal requests and approvals
- Deposit functionality
- Transaction history
- Meta-transaction signing
- Token management

## Security Model

### Multi-Phase Secured Operations

SimpleVault implements a two-phase security model for withdrawals:

1. **Request Phase**: Owner initiates withdrawal request
   ```solidity
   function withdrawEthRequest(address to, uint256 amount) public onlyOwner
   ```

2. **Approval Phase**: After the time-lock delay, owner must approve to execute
   ```solidity
   function approveWithdrawalAfterDelay(uint256 txId) public onlyOwner
   ```

This creates a security window between request and execution, allowing for monitoring and intervention if needed.

### Role-Based Security

The security model includes three distinct roles:

1. **Owner**: Primary control over the vault, can request and approve withdrawals
2. **Broadcaster**: Can submit meta-transactions on behalf of the owner
3. **Recovery**: Backup access mechanism with limited permissions

### Time-Lock Security

All withdrawals are subject to a mandatory waiting period:
- Minimum timelock: 24 hours (1440 minutes)
- Maximum timelock: 90 days (129600 minutes)

This time delay provides a critical security window during which suspicious operations can be detected and cancelled.

## Operation Types

SimpleVault supports the following operation types:

1. **ETH Withdrawals**
   - Request → time delay → approval workflow
   - Meta-transaction support for gasless approvals
   
2. **Token Withdrawals**
   - Support for any ERC20 token
   - Same security model as ETH withdrawals
   
3. **Core Operations**
   - Ownership transfers
   - Broadcaster updates
   - Recovery updates
   - Timelock period updates

## Meta-Transaction Support

SimpleVault fully supports meta-transactions for gasless operations:

```typescript
async generateUnsignedWithdrawalMetaTxApproval(
  txId: bigint,
  metaTxParams: VaultMetaTxParams
): Promise<MetaTransaction>
```

This allows vault owners to approve withdrawals without paying gas fees, while maintaining the security guarantees of the system.

## Integration

### Contract Deployment

SimpleVault requires initialization with critical security parameters:

```solidity
constructor(
    address initialOwner,
    address broadcaster,
    address recovery,
    uint256 timeLockPeriodInMinutes     
) SecureOwnable(initialOwner, broadcaster, recovery, timeLockPeriodInMinutes)
```

### TypeScript Integration

To integrate SimpleVault in a TypeScript application:

```typescript
import { SimpleVault } from 'particle-abstraction-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';

// Initialize clients
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

const walletClient = createWalletClient({
  chain: mainnet,
  transport: http()
});

// Create SimpleVault instance
const vault = new SimpleVault(
  publicClient,
  walletClient,
  '0xVaultContractAddress',
  mainnet
);

// Request a withdrawal
await vault.withdrawEthRequest(
  recipientAddress,
  amount,
  { from: ownerAddress }
);
```

### React UI Integration

The SimpleVault UI can be integrated into any React application:

```tsx
import SimpleVaultUI from './SimpleVault.ui';

function App() {
  return (
    <SimpleVaultUI 
      contractAddress={vaultAddress}
      onError={(error) => console.error(error)}
    />
  );
}
```

## Best Practices

1. **Security Parameters**: Set appropriate timelock periods based on security requirements
2. **Role Separation**: Use different addresses for owner, broadcaster, and recovery roles
3. **Regular Monitoring**: Implement monitoring for withdrawal requests
4. **Meta-Transaction Security**: Verify meta-transaction signatures and parameters before broadcasting
5. **Transaction Lifecycle**: Understand the complete lifecycle of transactions, from request to execution
