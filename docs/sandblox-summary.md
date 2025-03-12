---
title: SandBlox Knowledge Base
description: Sandblox Summary
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, Knowladge Base]
category: Knowladge Base
---


## Introduction
SandBlox is a modern development platform that enables developers to rapidly prototype, build, and deploy blockchain applications using pre-built, encapsulated "blox" - reusable blockchain components powered by Particle's account abstraction technology. This platform combines the power of React, Vite, RainbowKit, and TypeScript with Particle's advanced account abstraction infrastructure to create a seamless development experience for secure blockchain applications.

The platform addresses critical challenges in blockchain development including:
- **Security**: Enhancing application security through Particle's account abstraction
- **Speed**: Accelerating development with pre-built, composable components
- **Accessibility**: Lowering the barrier to entry for creating secure blockchain applications
- **Integration**: Providing seamless integration between smart contracts and frontend UI

SandBlox's architecture is centered around the concept of "blox" - modular, self-contained blockchain application components that include everything needed from smart contracts to UI.

## Core Concepts

### Blox Architecture
The fundamental building block of SandBlox is the "blox" - a self-contained module that represents a complete blockchain application component. Each blox includes:

```
Blox/
├── Blox.sol                 # Smart contract implementation
├── Blox.tsx                 # Main React component
├── Blox.ui.tsx              # UI components
├── Blox.blox.json           # Blox metadata
├── Blox.abi.json            # Contract ABI
└── Blox.md                  # Blox Information
```

This architecture enables:
1. **Encapsulation**: Each blox contains everything needed for deployment and use
2. **Reusability**: Blox can be easily reused across different projects
3. **Composability**: Multiple blox can be combined to create complex applications
4. **Testability**: Each blox can be tested independently before integration

### Integration with Particle Account Abstraction
All blox in SandBlox are built on Particle's account abstraction technology, which provides:

1. **Multi-Phase Security Architecture**
   - Role-based access control with distinct roles (owner, broadcaster, recovery)
   - Time-delayed operations for critical actions
   - Meta-transaction support for delegated transaction execution
   - Secure ownership and recovery mechanisms

2. **Enhanced Security Model**
   - Decoupling of asset control from transaction authorization
   - Multiple security layers through separation of concerns
   - Time-locked operations for enhanced safety
   - Secure meta-transaction verification

## Platform Architecture

SandBlox follows a modular architecture designed for flexibility and extensibility:

```
sand-blox/
├── src/
│   ├── blox/              # Blockchain application implementations
│   ├── components/        # Shared React components
│   ├── contexts/          # React context providers
│   ├── hooks/             # Shared custom React hooks
│   ├── lib/               # Utility libraries
│   ├── pages/             # Application pages
│   ├── particle-core/     # Particle account abstraction core
│   │   └── contracts/     # Core smart contracts
│   ├── services/          # Service integrations
│   ├── styles/            # Global styles
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Application entry point
├── public/                # Static assets
└── ... configuration files
```

### Core Technology Stack
- **Solidity**: Smart contract development
- **TypeScript**: Type-safe frontend development
- **React**: UI component library
- **Vite**: Fast, modern build tool
- **RainbowKit**: Wallet connection and interaction
- **Tailwind CSS**: Utility-first styling

## Blox Technical Components

### Smart Contract Layer

#### SecureOwnable Base Contract
All SandBlox contracts extend from `SecureOwnable`, which provides:

- **Enhanced Ownership Management**: Secure ownership transfers with time-delays
- **Role-Based Access Control**: Owner, broadcaster, and recovery roles
- **Operation Types Support**: Registration of operation types with security constraints
- **Meta-Transaction Infrastructure**: Support for delegated transaction execution through the broadcaster role

Key operation types in `SecureOwnable`:
```solidity
bytes32 public constant OWNERSHIP_TRANSFER = keccak256("OWNERSHIP_TRANSFER");
bytes32 public constant BROADCASTER_UPDATE = keccak256("BROADCASTER_UPDATE");
bytes32 public constant RECOVERY_UPDATE = keccak256("RECOVERY_UPDATE");
bytes32 public constant TIMELOCK_UPDATE = keccak256("TIMELOCK_UPDATE");
```

#### MultiPhaseSecureOperation Library
This library powers the secure operation framework with:

- **Transaction State Management**: Clear state tracking for all operations
- **Time-Locked Operations**: Mandatory waiting periods between request and execution
- **Signature Verification**: Cryptographic verification for meta-transactions
- **Execution Options**: Support for both standard function calls and raw transaction data

Key components:
```solidity
enum TxStatus {
    UNDEFINED,
    PENDING,
    CANCELLED,
    COMPLETED,
    FAILED,
    REJECTED
}

enum ExecutionType {
    NONE,
    STANDARD,
    RAW
}

struct TxRecord {
    uint256 txId;
    uint256 releaseTime;
    TxStatus status;
    TxParams params;
    bytes result;
    PaymentDetails payment;
}
```

#### GuardianAccountAbstraction Contract
This contract serves as the foundation for all blox implementations, providing:

```solidity
contract GuardianAccountAbstraction is SecureOwnable {
    constructor(
        address initialOwner,
        address broadcaster,
        address recovery,
        uint256 timeLockPeriodInMinutes      
    ) SecureOwnable(
        initialOwner,
        broadcaster,
        recovery,
        timeLockPeriodInMinutes      
    ) {
        // Additional initialization logic
    }
    
    // Implementation methods
}
```

### TypeScript Integration Layer

SandBlox provides a comprehensive TypeScript SDK for interacting with blox smart contracts:

```typescript
export default class BloxBase extends SecureOwnable {
  // Core functionality
  async initialize(): Promise<void>
  async connect(signer: Signer): Promise<void>
  async getOperationHistory(): Promise<TxRecord[]>
  async getOperation(txId: bigint): Promise<TxRecord>
  
  // Meta-transaction support
  async createMetaTxParams(
    handlerContract: Address,
    handlerSelector: Hex,
    deadline: bigint,
    maxGasPrice: bigint,
    signer: Address
  ): Promise<MetaTxParams>
  
  async generateUnsignedMetaTransaction(
    txParams: TxParams,
    metaTxParams: MetaTxParams
  ): Promise<MetaTransaction>
  
  // Additional utility methods
}
```

### React Component Layer

Each blox provides React components for UI integration:

1. **Main Component (`Blox.tsx`)**: 
   - Manages blox state and contract interactions
   - Coordinates between UI and blockchain operations
   - Handles user authentication and permissions

2. **UI Components (`Blox.ui.tsx`)**:
   - Provides the visual interface for the blox
   - Handles user input and form validation
   - Displays operation status and feedback

3. **Custom Hooks**:
   - Contract interaction hooks
   - State management hooks
   - Authentication hooks

## Development Workflow

### Creating a New Blox

1. **Setup**: Create a new directory in `src/blox/` with your blox name
2. **Create Files**: Generate the required files based on BloxTemplate
3. **Smart Contract**: Implement the contract functionality extending GuardianAccountAbstraction
4. **TypeScript SDK**: Create interaction methods for your contract
5. **UI Components**: Build the user interface for your blox
6. **Testing**: Test all components individually and together
7. **Documentation**: Create comprehensive documentation in the Blox.md file

### Blox Configuration

Each blox requires a configuration file (`*.blox.json`) that defines:

```json
{
  "id": "blox-id",
  "name": "Blox Name",
  "description": "Description of your blox",
  "category": "Category",
  "securityLevel": "Basic|Advanced|Enterprise",
  "features": [
    "Feature 1",
    "Feature 2"
  ],
  "requirements": [
    "Requirement 1"
  ],
  "deployments": 0,
  "lastUpdated": "YYYY-MM-DD",
  "libraries": {
    "LibraryName": {
      "name": "LibraryName",
      "description": "Description of the library"
    }
  }
}
```

## Secure Operation Workflow Patterns

SandBlox supports two distinct workflow patterns for operations:

### Two-Phase Workflow
For critical operations requiring maximum security:

1. **Request Phase**: Initiates the operation and records it with a future release time
   ```solidity
   function operationRequest(...) public onlyOwner {
       bytes memory executionOptions = MultiPhaseSecureOperation.createStandardExecutionOptions(
           OPERATION_SELECTOR, 
           abi.encode(...)
       );

       MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.txRequest(
           msg.sender,
           address(this),
           0, // no value
           gasLimit,
           OPERATION_TYPE,
           MultiPhaseSecureOperation.ExecutionType.STANDARD,
           executionOptions
       );
   }
   ```

2. **Time-Delay Period**: Mandatory waiting period for security monitoring

3. **Approval Phase**: After the time-lock expires, the operation can be executed
   ```solidity
   function operationDelayedApproval(uint256 txId) public onlyOwner {
       MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txDelayedApproval(txId);
       require(updatedRecord.params.operationType == OPERATION_TYPE, "Invalid operation type");
       // Execution logic
   }
   ```

### Meta-Transaction Workflow
SandBlox supports two approaches for meta-transactions to accommodate different security requirements:

#### 1. Single-Phase Workflow with New Meta-Transactions
For operations that can be executed in a single step, where the broadcaster executes the transaction on behalf of the owner:

```typescript
// 1. Generate an unsigned meta-transaction for a NEW operation (request + approval in one step)
const metaTx = await blox.generateUnsignedMetaTransactionForNew(
  requester,
  target,
  value,
  gasLimit,
  OPERATION_TYPE,
  ExecutionType.STANDARD,
  executionOptions,
  metaTxParams
);

// 2. Sign the meta-transaction
const signature = await signer.signMessage(metaTx.message);
metaTx.signature = signature;

// 3. Submit the meta-transaction to be executed by the broadcaster
// Note: The broadcaster will pay for the transaction gas
await blox.operationRequestAndApproveWithMetaTx(metaTx);
```

This approach is used when:
- The operation does not require the security of a time-delay
- You want to optimize user experience with a single transaction
- The owner wants to delegate transaction execution to the broadcaster
- The broadcaster is willing to handle the transaction gas costs

The contract side implements this as:
```solidity
function operationRequestAndApproveWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster {
    _secureState.checkPermission(META_TX_REQUEST_AND_APPROVE_SELECTOR);
    MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.requestAndApprove(metaTx);
    // Execution logic
}
```

#### 2. Multi-Phase Workflow with Existing Meta-Transactions
For secure approval of already-requested operations, allowing the broadcaster to execute the approval on behalf of the owner:

```typescript
// 1. First, request the operation normally (this creates a time-locked pending operation)
const txRecord = await blox.operationRequest(...);
const txId = txRecord.txId;

// 2. Later, generate an unsigned meta-transaction for the EXISTING pending operation
const metaTx = await blox.generateUnsignedMetaTransactionForExisting(
  txId,
  metaTxParams
);

// 3. Sign the meta-transaction
const signature = await signer.signMessage(metaTx.message);
metaTx.signature = signature;

// 4. Submit the meta-transaction to be executed by the broadcaster
// Note: The broadcaster will pay for the transaction gas
await blox.operationApprovalWithMetaTx(metaTx);
```

This approach is used when:
- The operation has already been requested and is in pending state
- The owner wants to delegate the approval execution to the broadcaster
- You need to maintain the security of multi-phase operations while enabling delegated execution
- Operation cancellations can also use this pattern
- The broadcaster is willing to handle the transaction gas costs

The contract implements this pattern as:
```solidity
function operationApprovalWithMetaTx(MultiPhaseSecureOperation.MetaTransaction memory metaTx) public onlyBroadcaster {
    _secureState.checkPermission(OPERATION_META_SELECTOR);
    MultiPhaseSecureOperation.TxRecord memory updatedRecord = _secureState.txApprovalWithMetaTx(metaTx);
    require(updatedRecord.params.operationType == OPERATION_TYPE, "Invalid operation type");
    // Execution logic
}
```

## Example Blox: SimpleVault

The SimpleVault blox demonstrates a secure vault for storing and managing ETH and ERC20 tokens, with the following features:

### Contract Structure
```solidity
contract SimpleVault is SecureOwnable {
    bytes32 public constant WITHDRAW_ETH = keccak256("WITHDRAW_ETH");
    bytes32 public constant WITHDRAW_TOKEN = keccak256("WITHDRAW_TOKEN");

    // Function selector constants
    bytes4 private constant WITHDRAW_ETH_SELECTOR = bytes4(keccak256("executeWithdrawEth(address,uint256)"));
    bytes4 private constant WITHDRAW_TOKEN_SELECTOR = bytes4(keccak256("executeWithdrawToken(address,address,uint256)"));

    // Timelock period constants
    uint256 private constant MIN_TIMELOCK_PERIOD = 24 * 60; // 1 day
    uint256 private constant MAX_TIMELOCK_PERIOD = 90 * 24 * 60; // 90 days
    
    // Implementation...
}
```

### Key Features
1. **Asset Storage**: Secure storage for ETH and ERC20 tokens
2. **Secure Withdrawals**: Two-phase withdrawal process with time-lock
3. **Meta-Transaction Support**: Delegated transaction execution through the broadcaster role
4. **UI Integration**: Complete frontend for managing vault assets

### Security Model
- Minimum timelock of 24 hours for all withdrawals
- Role separation for owner, broadcaster, and recovery
- Meta-transaction verification for delegated execution
- Cancellation window for pending withdrawals

## Best Practices for Blox Development

### Smart Contract Development
1. **Security First**: Always prioritize security in your contract design
2. **Proper Roles**: Use the role-based security model effectively
3. **Time-Locks**: Set appropriate time-lock periods for critical operations
4. **Event Emission**: Emit events for all important state changes
5. **Parameter Validation**: Validate all input parameters thoroughly

### TypeScript Integration
1. **Type Safety**: Leverage TypeScript's type system for robust code
2. **Error Handling**: Implement comprehensive error handling
3. **MetaTx Support**: Always provide meta-transaction options for delegated execution
4. **Transaction Status**: Track and report operation status clearly

### UI Development
1. **User Feedback**: Provide clear feedback on operation status and time-locks
2. **Responsive Design**: Ensure your UI works on all devices
3. **Error Messaging**: Display user-friendly error messages
4. **Loading States**: Handle loading states gracefully
5. **Security Information**: Clearly communicate security features to users

## Tools and Utilities

SandBlox provides a set of utilities to simplify blox development:

### Contract Deployment
```typescript
import { deployBlox } from 'sandblox/utils/deployment';

const deployedContract = await deployBlox({
  bloxId: 'custom-vault',
  initialOwner: ownerAddress,
  broadcaster: broadcasterAddress,
  recovery: recoveryAddress,
  timeLockPeriodInMinutes: 1440, // 1 day
  // Additional parameters specific to your blox
});
```

### Transaction Monitoring
```typescript
import { useOperationHistory } from 'sandblox/hooks/useOperationHistory';

const { operations, pendingOperations, completedOperations, failedOperations } = 
  useOperationHistory(contractAddress);
```

### Meta-Transaction Generation
```typescript
import { createMetaTxParams, signMetaTx } from 'sandblox/utils/meta-transactions';

const metaTxParams = await createMetaTxParams({
  handlerContract: broadcasterAddress,
  handlerSelector: 'approvalWithMetaTx',
  deadline: Date.now() + 3600, // 1 hour deadline
  maxGasPrice: 100000000000n, // 100 gwei (paid by broadcaster)
  signer: ownerAddress
});

const metaTx = await generateUnsignedMetaTransaction(...);
const signedMetaTx = await signMetaTx(metaTx, signer);
```

## Conclusion

SandBlox represents a significant advancement in blockchain application development by combining the security benefits of Particle's account abstraction with the development speed of modular, reusable components. By leveraging the blox architecture, developers can quickly create secure, user-friendly blockchain applications with reduced development time and enhanced security guarantees.

The platform's focus on security, usability, and developer experience makes it an ideal choice for creating everything from simple dApps to complex enterprise blockchain applications, all while maintaining the highest standards of security and user experience.

---

Created by Particle Crypto Security  
Copyright © 2025 Particle Crypto Security. All rights reserved. 