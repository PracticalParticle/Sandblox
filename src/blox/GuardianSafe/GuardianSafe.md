# GuardianSafe

GuardianSafe is a secure wrapper for Safe wallet functionality using the GuardianAccountAbstraction security framework. It enhances the security of multisig Safe wallets by adding a complementary layer of time-locked operations, meta-transaction support, and role-based security features.

## What is GuardianSafe?

GuardianSafe is a secure module that wraps around a Safe multisig wallet to add enhanced security features through Particle's account abstraction framework. It combines the existing multisig security with time-locked approvals, creating a dual-layer security system that prevents immediate fund loss even if multiple signers are compromised.

### Key Benefits

- **Dual-Layer Security**: Combines multisig security with multi-phase operations for maximum protection
- **Enhanced Security**: Multi-phase operations for critical transactions with mandatory time delays
- **Role-Based Protection**: Separate access roles (owner, broadcaster, recovery) complementing the multisig signers
- **Meta-Transaction Support**: Gas-efficient operations protected by the broadcaster entity
- **Transaction Guard Integration**: Functions as a guard to enforce transactions are only executed using the security module
- **Safe Compatibility**: Fully compatible with existing Safe wallets
- **Multiple Security Layers**: Provides defense-in-depth through the Guardian security framework

## How GuardianSafe Protects Your Assets

Traditional Safe wallets rely on multisig security, but still face risks from coordinated compromise or phishing. GuardianSafe adds another layer of protection by:

1. **Time-Delayed Security**: All critical transactions require a mandatory waiting period after multisig approval before execution
2. **Role Separation**: Different keys for different functions limit the damage of any single compromise
3. **Meta-Transaction Options**: Signed operations that can be broadcasted by a separate entity
4. **Transaction Guard**: Functions as a guard to enforce transactions are only executed using the security module.

## Security Roles and Workflow

GuardianSafe implements a comprehensive security workflow that combines multisig and multi-phase operation security:

1. **Multisig Signers**: The original Safe wallet signers who approve transactions through the standard multisig process
2. **Owner Role**: Acts as a manager layer after multisig approval, responsible for requesting and approving execution through the GuardianSafe module
3. **Broadcaster Role**: Functions as the final gatekeeper, ensuring that only properly approved transactions are executed
4. **Recovery Role**: Provides emergency access for security recovery operations

This layered approach ensures that even if multiple signers are compromised, funds remain secure behind the time-lock and role-based protections.

## How to Use GuardianSafe

### Setting Up Your Module

1. Deploy your GuardianSafe contract:
   - Link to an existing Safe wallet address
   - Set your owner address (main controller)
   - Set a broadcaster address (for meta operations)
   - Set a recovery address (for emergency access)
   - Choose your timelock period

2. Set GuardianSafe as a transaction guard on your Safe wallet

### Managing Your Transactions

1. **Multisig Approval**: Safe signers first approve transactions through the standard multisig process

2. **Requesting Transactions**: Owner initiates transaction requests through the GuardianSafe interface, referencing the multisig-approved transaction
  
3. **Approving Transactions**: After the timelock period, owner approves pending transactions

4. **Meta-Transactions**: Use meta-transactions to execute operations protected by the broadcaster entity

5. **Cancelling Transactions**: Cancel any pending transaction during the timelock period

### Security Best Practices

1. **Use Separate Devices** for owner, broadcaster, recovery keys, and multisig signers
2. **Monitor Pending Transactions** regularly to detect unauthorized requests
3. **Set Appropriate Timelock** periods based on your security needs
4. **Regularly Verify** owner and recovery addresses
5. **Test Recovery** procedures periodically
6. **Start with Small Amounts** when first using the module
7. **Distribute Signer Keys** across different security domains or team members

---

## For Developers: Technical Documentation

### Architecture

GuardianSafe extends the `GuardianAccountAbstraction` contract to implement a secure wrapper for Safe wallets with the following key features:

- **Combined Security Model**: Wraps the multisig security of Safe with the multi-phase security of the Guardian framework
- **Time-Delayed Operations**: Critical Safe transactions require a mandatory waiting period after multisig approval before execution
- **Role-Based Security**: Separation of multisig signers, owner, broadcaster, and recovery roles with distinct permissions
- **Meta-Transaction Support**: Delegated transaction capabilities while maintaining security guarantees
- **Transaction Guard Interface**: Implementation of the `ITransactionGuard` interface for Safe integration

### Smart Contract Architecture

The GuardianSafe contract is implemented in Solidity and extends the GuardianAccountAbstraction base contract:

```solidity
contract GuardianSafe is GuardianAccountAbstraction, ITransactionGuard {
    // Operation types
    bytes32 public constant EXEC_SAFE_TX = keccak256("EXEC_SAFE_TX");
    
    // Function selectors
    bytes4 private constant EXEC_SAFE_TX_SELECTOR = bytes4(keccak256("executeTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)"));
    
    // Meta-transaction function selectors
    bytes4 private constant APPROVE_TX_META_SELECTOR = bytes4(keccak256("approveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    bytes4 private constant CANCEL_TX_META_SELECTOR = bytes4(keccak256("cancelTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    bytes4 private constant REQUEST_AND_APPROVE_TX_META_SELECTOR = bytes4(keccak256("requestAndApproveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    
    // Safe transaction structure
    struct SafeTx {
        address to;             // Destination address
        uint256 value;          // Ether value
        bytes data;             // Data payload
        uint8 operation;        // Operation type (0=Call, 1=DelegateCall)
        uint256 safeTxGas;      // Gas for Safe transaction
        uint256 baseGas;        // Gas costs for data
        uint256 gasPrice;       // Maximum gas price
        address gasToken;       // Token for gas payment (0 for ETH)
        address payable refundReceiver;  // Refund receiver address
        bytes signatures;       // Packed signature data
    }
    
    // Safe instance
    ISafe private immutable safe;
    
    // Implementation...
}
```

### Security Model Implementation

#### Dual-Layer Security System

GuardianSafe implements a dual-layer security system:

1. **Multisig Layer**: The original Safe wallet multisig security with threshold signatures
2. **Multi-Phase Layer**: The Guardian account abstraction security with time-locked operations

This creates an enhanced security model where both systems must be bypassed to compromise funds.

#### Multi-Phase Secured Operations

After multisig approval, GuardianSafe implements a two-phase security model for Safe transactions:

1. **Request Phase**: Owner initiates transaction request with the multisig-approved transaction data
   ```solidity
   function requestTransaction(SafeTx calldata safeTx) external onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory)
   ```

2. **Approval Phase**: After the time-lock delay, owner must approve to execute
   ```solidity
   function approveTransactionAfterDelay(uint256 txId) external onlyOwner returns (MultiPhaseSecureOperation.TxRecord memory)
   ```

This creates a security window between multisig approval, request, and execution, allowing for monitoring and intervention if needed.

#### Role-Based Security

The security model includes multiple distinct roles with tiered responsibilities:

1. **Multisig Signers**: The original Safe wallet signers who approve the transaction initially
2. **Owner**: Secondary control layer, can request and approve transactions after multisig approval
3. **Broadcaster**: Final gatekeeper that can submit meta-transactions on behalf of the owner
4. **Recovery**: Backup access mechanism with limited permissions

#### Transaction Guard Integration

GuardianSafe implements the ITransactionGuard interface to function as a transaction guard for Safe wallets:

```solidity
function checkTransaction(
    address to,
    uint256 value,
    bytes memory data,
    Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address payable refundReceiver,
    bytes memory signatures,
    address msgSender
) external override
```

This allows the module to enforce transactions are only broadcasted and executed using the module itself.

### Operation Types

GuardianSafe supports the following operation type:

1. **Safe Transaction Execution (EXEC_SAFE_TX)**
   - Multisig approval → Owner request → time delay → Owner approval workflow
   - Meta-transaction support for delegated approvals
   - Complete support for all Safe transaction parameters

### Meta-Transaction Support

GuardianSafe fully supports meta-transactions for delegated operations:

```typescript
async generateUnsignedSafeMetaTxForNew(
  safeTx: SafeTx,
  params: SafeMetaTxParams
): Promise<MetaTransaction>

async generateUnsignedSafeMetaTxForExisting(
  txId: bigint,
  params: SafeMetaTxParams,
  isApproval: boolean
): Promise<MetaTransaction>
```

This allows module owners to initiate and approve transactions without paying gas fees, with the broadcaster entity ensuring final security validation.

### Integration Examples

#### Contract Deployment

GuardianSafe requires initialization with critical security parameters:

```solidity
constructor(
    address _safe,
    address initialOwner,
    address broadcaster,
    address recovery,
    uint256 timeLockPeriodInMinutes
) GuardianAccountAbstraction(
    initialOwner,
    broadcaster,
    recovery,
    timeLockPeriodInMinutes
) {
    _validateNotZeroAddress(_safe);
    safe = ISafe(_safe);
    
    // Initialize operation type
    MultiPhaseSecureOperation.addOperationType(_getSecureState(), MultiPhaseSecureOperation.ReadableOperationType({
        operationType: EXEC_SAFE_TX,
        name: "EXEC_SAFE_TX"
    }));
    
    // Add meta-transaction function selector permissions
    // ...
}
```

#### TypeScript Integration

To integrate GuardianSafe in a TypeScript application:

```typescript
import { GuardianSafe } from 'particle-abstraction-sdk';
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

// Create GuardianSafe instance
const guardianSafe = new GuardianSafe(
  publicClient,
  walletClient,
  '0xGuardianSafeAddress',
  mainnet
);

// Request a transaction (after multisig approval has been completed)
const safeTx = {
  to: recipientAddress,
  value: ethers.parseEther("1.0"),
  data: "0x",
  operation: 0, // Call
  safeTxGas: 0,
  baseGas: 0,
  gasPrice: 0,
  gasToken: "0x0000000000000000000000000000000000000000",
  refundReceiver: "0x0000000000000000000000000000000000000000",
  signatures: "0x" // Includes signatures from multisig signers
};

await guardianSafe.requestTransaction(
  safeTx,
  { from: ownerAddress }
);
```

#### React UI Integration

The GuardianSafe UI can be integrated into any React application:

```tsx
import GuardianSafeUI from './GuardianSafe.ui';

function App() {
  return (
    <GuardianSafeUI 
      contractAddress={guardianSafeAddress}
      safeAddress={safeAddress}
      onError={(error) => console.error(error)}
    />
  );
}
```

### Developer Best Practices

1. **Security Parameters**: Set appropriate timelock periods based on security requirements
2. **Role Separation**: Use different addresses for multisig signers, owner, broadcaster, and recovery roles
3. **Regular Monitoring**: Implement monitoring for transaction requests
4. **Meta-Transaction Security**: Verify meta-transaction signatures and parameters before broadcasting
5. **Transaction Lifecycle**: Understand the complete lifecycle of transactions, from multisig approval to final execution
6. **Safe Integration**: Set up GuardianSafe as a transaction guard in the Safe settings

## Real World Use Cases

1. **Enterprise Treasury Management**:
   - Secure corporate funds with combined multisig and time-locked transaction approvals
   - Role-based permissions for financial operations
   - Enhanced security audit trail for all transactions

2. **DAO Governance**:
   - Add time-lock security to DAO treasury operations
   - Create mandatory waiting periods for high-value transactions after multisig approval
   - Multi-layer security for governance decisions

3. **High-Net-Worth Wallets**:
   - Secure large cryptocurrency holdings with enhanced dual-layer security
   - Time-delayed transactions to prevent immediate theft, even if multiple signers are compromised
   - Recovery options for emergency situations
