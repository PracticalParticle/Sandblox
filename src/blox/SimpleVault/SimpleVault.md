# SimpleVault

SimpleVault is a secure digital asset vault for safely storing and managing your ETH and ERC20 tokens. Unlike traditional wallets that rely on a single private key, SimpleVault provides multiple layers of protection for your digital assets.

## What is SimpleVault?

SimpleVault is your personal crypto bank vault. It's designed to keep your digital assets secure by adding a time-delay to critical operations like withdrawals, giving you time to detect and stop unauthorized transactions.

### Key Benefits

- **Enhanced Security**: Time-delayed withdrawals create a security window to identify and stop suspicious activities
- **Self-Custody**: Maintain full control of your assets while adding extra security layers
- **Role-Based Protection**: Separate access roles limit damage if any single key is compromised
- **Multiple Asset Support**: Store both ETH and any ERC20 tokens in a single vault
- **2FA Approvals Support**: Owner role approve tx and broadcaster role broadcast approved tx.
- **User-Friendly Interface**: Simple React UI for easy asset management

## How SimpleVault Protects Your Assets

Traditional wallets are vulnerable because a single compromised key means immediate loss of all assets. SimpleVault solves this by:

1. **Time-Delayed Security**: All withdrawals require a mandatory waiting period before funds can be moved
2. **Role Separation**: Different keys for different functions limit the damage of any single compromise
3. **Recovery Options**: Dedicated recovery address for emergency access to your vault

## How to Use SimpleVault

### Setting Up Your Vault

1. Deploy your SimpleVault:
   - Set your owner address (main controller)
   - Set a broadcaster address (for meta operations)
   - Set a recovery address (for emergency access)
   - Choose your timelock period (minimum 24 hours)

2. Deposit assets by simply sending ETH to your vault address or using the deposit function for tokens

### Managing Your Assets

1. **Viewing Balances**: See all your ETH and token balances in one place

2. **Withdrawing Funds**: The secure two-step process:
   - Request a withdrawal (specifying recipient and amount)
   - Approve the withdrawal after the timelock period has passed

3. **Meta Operations**: Use meta-transactions to approve withdrawals without paying gas fees

### Security Best Practices

1. **Use Separate Devices** for owner, broadcaster, and recovery keys
2. **Monitor Pending Transactions** regularly to detect unauthorized requests
3. **Set Appropriate Timelock** periods based on your security needs
4. **Regularly Verify** owner and recovery addresses
5. **Test Recovery** procedures periodically
6. **Start with Small Amounts** when first using the vault

---

## For Developers: Technical Documentation

### Architecture

SimpleVault extends the `SecureOwnable` contract to implement a secure vault for ETH and ERC20 tokens with the following key features:

- **Time-Delayed Operations**: Critical withdrawal operations require a mandatory waiting period before execution
- **Role-Based Security**: Separation of owner, broadcaster, and recovery roles with distinct permissions
- **Meta-Transaction Support**: delegated transaction capabilities while maintaining security guarantees
- **Multi-Phase Security**: Two-phase operations (request → delayed approval) for withdrawals

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

### Security Model Implementation

#### Multi-Phase Secured Operations

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

#### Role-Based Security

The security model includes three distinct roles:

1. **Owner**: Primary control over the vault, can request and approve withdrawals
2. **Broadcaster**: Can submit meta-transactions on behalf of the owner
3. **Recovery**: Backup access mechanism with limited permissions

#### Time-Lock Security

All withdrawals are subject to a mandatory waiting period:
- Minimum timelock: 24 hours (1440 minutes)
- Maximum timelock: 90 days (129600 minutes)

This time delay provides a critical security window during which suspicious operations can be detected and cancelled.

### Operation Types

SimpleVault supports the following operation types:

1. **ETH Withdrawals**
   - Request → time delay → approval workflow
   - Meta-transaction support for delegated approvals
   
2. **Token Withdrawals**
   - Support for any ERC20 token
   - Same security model as ETH withdrawals
   
3. **Core Operations**
   - Ownership transfers
   - Broadcaster updates
   - Recovery updates
   - Timelock period updates

### Meta-Transaction Support

SimpleVault fully supports meta-transactions for delegated operations:

```typescript
async generateUnsignedWithdrawalMetaTxApproval(
  txId: bigint,
  metaTxParams: VaultMetaTxParams
): Promise<MetaTransaction>
```

This allows vault owners to approve withdrawals without paying gas fees, while maintaining the security guarantees of the system.

### Integration Examples

#### Contract Deployment

SimpleVault requires initialization with critical security parameters:

```solidity
constructor(
    address initialOwner,
    address broadcaster,
    address recovery,
    uint256 timeLockPeriodInMinutes     
) SecureOwnable(initialOwner, broadcaster, recovery, timeLockPeriodInMinutes)
```

#### TypeScript Integration

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

#### React UI Integration

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

### Developer Best Practices

1. **Security Parameters**: Set appropriate timelock periods based on security requirements
2. **Role Separation**: Use different addresses for owner, broadcaster, and recovery roles
3. **Regular Monitoring**: Implement monitoring for withdrawal requests
4. **Meta-Transaction Security**: Verify meta-transaction signatures and parameters before broadcasting
5. **Transaction Lifecycle**: Understand the complete lifecycle of transactions, from request to execution
