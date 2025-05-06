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
- **DelegateCall Protection**: Blocks dangerous delegatecall operations by default to prevent wallet takeover attacks

## Security Layers in GuardianSafe

GuardianSafe implements a comprehensive multi-layered security approach that significantly enhances the standard Safe wallet:

### 1. Transaction Guard Layer

GuardianSafe acts as a transaction guard for the Safe wallet by implementing the `ITransactionGuard` interface:

- **DelegateCall Protection**: Blocks the dangerous `DelegateCall` operation by default, which could otherwise grant full control over the Safe wallet and completely alter its security logic
- **Execution Restriction**: Ensures all transactions must go through the GuardianSafe security extension module
- **Enhanced Validation**: Provides additional validation checks before any transaction execution
- **Opt-in Control**: Users can explicitly enable DelegateCall if required for specific advanced use cases

### 2. Broadcast Security Layer

In standard Safe wallets, once the multisig threshold is met, anyone can broadcast the transaction (not just the signers), creating a potential security gap:

- **Structured Broadcasting Logic**: GuardianSafe enforces a well-defined broadcasting policy for transactions
- **Controlled Broadcast Flow**: Only authorized roles can broadcast transactions after multisig approval
- **Custom Security Policies**: Supports additional security checks before broadcasting
- **Workflow-Based Broadcasting**: Different broadcasting approaches based on the chosen security workflow

### 3. Role-Based Access Control (RBAC) Layer

GuardianSafe implements strict role-based access control that applies regardless of the chosen workflow (multi-phase or single-phase):

- **Owner Role**: Primary administrator who must sign transaction requests that wrap the valid multisig Safe transactions
- **Broadcaster Role**: Entity responsible for broadcasting transactions to the blockchain with additional security verification
- **Recovery Role**: Provides backup access for emergency situations
- **Workflow Flexibility**: RBAC can be applied differently depending on the chosen security workflow
- **Separation of Duties**: Each role has distinct responsibilities, limiting the impact of any single compromise

### 4. Multi-Phase Workflow Layer

This workflow splits transactions into distinct phases with a time-delay security mechanism:

- **Request Phase**: Owner initiates a transaction request wrapping the multisig-approved Safe transaction
- **Time-Lock Period**: Mandatory waiting period between request and execution
- **Final Approval Phase**: Owner must explicitly approve the transaction after the time-lock period expires
- **External Monitoring**: The time-lock period enables external monitoring and intervention protocols
- **Flexible Approval Options**: Owner can use direct approvals or meta-transactions with the broadcaster during the time-lock period

### 5. Single-Phase Workflow Layer

For improved efficiency, GuardianSafe also supports a single-phase meta-transaction approach:

- **Meta-Transaction Signing**: Owner signs a meta-transaction that wraps the original Safe transaction
- **Broadcaster Execution**: Broadcaster role submits the signed transaction to the blockchain
- **Immutable Transaction Data**: Broadcaster cannot modify the transaction data, ensuring security
- **Gas Efficiency**: Owner doesn't need to directly pay gas fees
- **Quick Execution**: Bypasses time-lock for situations where speed is critical

### 6. Optional External Security Layer

GuardianSafe supports integration with external security providers:

- **Third-Party Broadcasting**: External security entities can serve as the broadcaster
- **Additional Security Policies**: External broadcasters can implement extra security checks
- **Immutable Transactions**: Broadcasters cannot modify signed transaction data
- **Enhanced Monitoring**: External entities can provide additional transaction monitoring

## How GuardianSafe Protects Your Assets

Traditional Safe wallets rely on multisig security, but still face risks from coordinated compromise or phishing. GuardianSafe adds multiple layers of protection by:

1. **Transaction Guard Protection**: Prevents dangerous operations and ensures all transactions follow the security model
2. **Controlled Broadcasting**: Ensures only properly authorized parties can submit transactions after multisig approval
3. **Time-Delayed Security**: All critical transactions require a mandatory waiting period after multisig approval before execution
4. **Role Separation**: Different keys for different functions limit the damage of any single compromise
5. **Meta-Transaction Options**: Signed operations that can be broadcasted by a separate entity
6. **DelegateCall Protection**: Blocks potentially dangerous delegatecall operations by default

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

2. **Choose Your Security Workflow**:
   - **Multi-Phase Workflow**: For maximum security with time-lock protection
   - **Single-Phase Workflow**: For efficiency when immediate execution is needed

3. **Multi-Phase Workflow**:
   - Owner initiates transaction requests through the GuardianSafe interface
   - Wait for the timelock period to expire
   - Owner approves the transaction after the timelock period
   - Alternatively, owner can sign a meta-transaction for approval during the time-lock period and broadcaster submits it

4. **Single-Phase Workflow**:
   - Owner signs a meta-transaction wrapping the multisig-approved transaction
   - Broadcaster submits the transaction to the blockchain

5. **Cancelling Transactions**: Cancel any pending transaction during the timelock period

### Security Best Practices

1. **Use Separate Devices** for owner, broadcaster, recovery keys, and multisig signers
2. **Monitor Pending Transactions** regularly to detect unauthorized requests
3. **Set Appropriate Timelock** periods based on your security needs
4. **Regularly Verify** owner and recovery addresses
5. **Test Recovery** procedures periodically
6. **Start with Small Amounts** when first using the module
7. **Distribute Signer Keys** across different security domains or team members
8. **Keep DelegateCall Disabled** unless absolutely necessary for specific advanced use cases

---

## For Developers: Technical Documentation

### Architecture

GuardianSafe extends the `GuardianAccountAbstraction` contract to implement a secure wrapper for Safe wallets with the following key features:

- **Combined Security Model**: Wraps the multisig security of Safe with the multi-phase security of the Guardian framework
- **Time-Delayed Operations**: Critical Safe transactions require a mandatory waiting period after multisig approval before execution
- **Role-Based Security**: Separation of multisig signers, owner, broadcaster, and recovery roles with distinct permissions
- **Meta-Transaction Support**: Delegated transaction capabilities while maintaining security guarantees
- **Transaction Guard Interface**: Implementation of the `ITransactionGuard` interface for Safe integration
- **DelegateCall Protection**: Default security mechanism to prevent dangerous delegatecall operations

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
    
    // DelegateCall flag
    bool public delegatedCallEnabled = false;
    
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

#### Transaction Guard Implementation

GuardianSafe implements the ITransactionGuard interface to protect the Safe wallet:

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
) external override {
    _validateInternal();
    
    // Check if this is a delegated call and validate if needed
    if (operation == Operation.DelegateCall) {
        _validateDelegation();
    }
}

function _validateDelegation() internal view {
    require(delegatedCallEnabled, "Delegated calls are not enabled");
}
```

This implementation:
1. Verifies that all transactions are processed through the GuardianSafe module
2. Blocks DelegateCall operations by default, requiring explicit opt-in
3. Provides a security gate between the multisig approval and execution

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

#### Single-Phase Meta-Transaction Operations

For situations where efficiency is needed, GuardianSafe provides a single-phase workflow:

```solidity
function requestAndApproveTransactionWithMetaTx(
    MultiPhaseSecureOperation.MetaTransaction memory metaTx
) public onlyBroadcaster returns (MultiPhaseSecureOperation.TxRecord memory) {
    MultiPhaseSecureOperation.checkPermission(_getSecureState(), REQUEST_AND_APPROVE_TX_META_SELECTOR);
    _validateHandlerSelector(metaTx.params.handlerSelector, REQUEST_AND_APPROVE_TX_META_SELECTOR);

    MultiPhaseSecureOperation.TxRecord memory txRecord = MultiPhaseSecureOperation.requestAndApprove(
        _getSecureState(),
        metaTx
    );
    _validateOperationType(txRecord.params.operationType, EXEC_SAFE_TX);

    addOperation(txRecord);
    finalizeOperation(txRecord);
    return txRecord;
}
```

This allows:
1. Owner to sign a meta-transaction wrapping the Safe transaction
2. Broadcaster to submit it directly without time-lock
3. Immutable execution of the signed transaction data

#### Role-Based Security

The security model includes multiple distinct roles with tiered responsibilities:

1. **Multisig Signers**: The original Safe wallet signers who approve the transaction initially
2. **Owner**: Secondary control layer, can request and approve transactions after multisig approval
3. **Broadcaster**: Final gatekeeper that can submit meta-transactions on behalf of the owner
4. **Recovery**: Backup access mechanism with limited permissions

### Operation Types

GuardianSafe supports the following operation type:

1. **Safe Transaction Execution (EXEC_SAFE_TX)**
   - **Multi-Phase Workflow**: Multisig approval → Owner request → time delay → Owner approval
   - **Single-Phase Workflow**: Multisig approval → Owner signs meta-tx → Broadcaster submits
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
    MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), APPROVE_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
    MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), CANCEL_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
    MultiPhaseSecureOperation.addRoleForFunction(_getSecureState(), REQUEST_AND_APPROVE_TX_META_SELECTOR, MultiPhaseSecureOperation.BROADCASTER_ROLE);
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

// Multi-Phase Workflow: Request a transaction (after multisig approval has been completed)
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

// Single-Phase Workflow: Create and submit a meta-transaction
const metaTxParams = {
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

// Generate unsigned meta-transaction
const unsignedMetaTx = await guardianSafe.generateUnsignedSafeMetaTxForNew(
  safeTx,
  metaTxParams
);

// Sign the meta-transaction with owner's wallet
const signature = await walletClient.signTypedData({
  account: ownerAddress,
  ...createEIP712TypedData(unsignedMetaTx)
});

// Add signature and broadcast via broadcaster
const signedMetaTx = {
  ...unsignedMetaTx,
  signature
};

await guardianSafe.requestAndApproveTransactionWithMetaTx(
  signedMetaTx,
  { from: broadcasterAddress }
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
7. **DelegateCall Control**: Keep DelegateCall disabled unless specifically required
8. **External Security**: Consider using a third-party security provider as the broadcaster for additional protection

## Real World Use Cases

1. **Enterprise Treasury Management**:
   - Secure corporate funds with combined multisig and time-locked transaction approvals
   - Role-based permissions for financial operations
   - Enhanced security audit trail for all transactions
   - Protection against insider threats through multi-phase security

2. **DAO Governance**:
   - Add time-lock security to DAO treasury operations
   - Create mandatory waiting periods for high-value transactions after multisig approval
   - Multi-layer security for governance decisions
   - Enable external monitoring of governance transactions

3. **High-Net-Worth Wallets**:
   - Secure large cryptocurrency holdings with enhanced dual-layer security
   - Time-delayed transactions to prevent immediate theft, even if multiple signers are compromised
   - Recovery options for emergency situations
   - Optional integration with professional security services
