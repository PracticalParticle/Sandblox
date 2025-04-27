# Workflow Architecture

## Overview

This architecture provides a centralized and structured approach to managing operations like ownership transfers, broadcaster updates, and other contract-level actions in SandBlox modules. It reduces code duplication, standardizes workflows, and improves the developer experience by providing a consistent API for all operations.

## Key Components

### Operation Registry

The Operation Registry serves as a central repository for all operation types. It provides methods for retrieving and registering operations:

- `getOperation(operationType: OperationType)`: Get operation details for a given operation type
- `registerOperation(operation: OperationRegistryEntry)`: Register a new operation
- `getAllOperations()`: Get all registered operations

### Operation Types

Operations are classified into two types:

1. **Multi-Phase Operations**: These require multiple steps (request, approval, cancellation)
   - Example: `OWNERSHIP_TRANSFER`, `BROADCASTER_UPDATE`

2. **Single-Phase Operations**: These are executed in a single step
   - Example: `RECOVERY_UPDATE`, `TIMELOCK_UPDATE`

Core operations are defined as human-readable strings in the `CoreOperationType` enum, while custom operations can be defined as string literals. This makes the code more readable and maintainable.

### Workflow Manager

The Workflow Manager provides a unified interface for executing operations, abstracting away the complexity of different contract implementations:

- `requestOperation(operationType, params, options)`: Request a multi-phase operation
- `approveOperation(operationType, txId, options)`: Approve a pending operation
- `cancelOperation(operationType, txId, options)`: Cancel a pending operation
- `executeOperation(operationType, params, options)`: Execute a single-phase operation
- `prepareAndSignApproval(operationType, txId, options)`: Prepare and sign a meta-transaction for approval
- `executeMetaTransaction(signedMetaTx, operationType, phase, options)`: Execute a meta-transaction

## How It Works

1. **Registration**: Operations are registered in the Operation Registry, specifying their type, workflow type, required roles, and functions.
2. **Consistent Patterns**: Each operation follows a consistent pattern for its workflow type.
3. **Abstraction**: The Workflow Manager abstracts away specific contract implementations, providing a unified interface.

## Usage

### Registering Core Operations

Core operations like ownership transfer and broadcaster updates are registered automatically:

```typescript
import { registerCoreOperations } from './registrations/CoreOperations';
import { secureOwnableContract } from './contracts';

// Initialize and register core operations
registerCoreOperations(secureOwnableContract);
```

### Adding Custom Operations

Modules can register their operations by following these steps:

1. Define the operation type as a human-readable string
2. Create a hash representation for contract-level use
3. Define function selectors for the operation
4. Implement the operation functions
5. Register the operation with the Operation Registry

Example for a vault module:

```typescript
// Define operation type as a human-readable string
export const VAULT_WITHDRAWAL_OPERATION = 'VAULT_WITHDRAWAL';

// Define the hash for contract-level use
export const VAULT_WITHDRAWAL_OPERATION_HASH = toHex(
  new TextEncoder().encode("VAULT_WITHDRAWAL"),
  { size: 32 }
) as Hex;

// Create and register the operation
const operationEntry: OperationRegistryEntry = {
  operationType: VAULT_WITHDRAWAL_OPERATION,
  operationTypeHash: VAULT_WITHDRAWAL_OPERATION_HASH,
  name: 'Vault Withdrawal',
  workflowType: WorkflowType.MULTI_PHASE,
  // ... other properties
};

operationRegistry.registerOperation(operationEntry);
```

### Executing Operations

Operations can be executed through the `WorkflowManager`:

```typescript
// Create and initialize the WorkflowManager
const workflowManager = new WorkflowManager(publicClient, walletClient, contractAddress, chain);
await workflowManager.initialize();

// Request an operation (multi-phase)
const hash = await workflowManager.requestOperation(
  CoreOperationType.OWNERSHIP_TRANSFER,  // Human-readable operation type
  { newOwner: "0x123..." },
  { from: ownerAddress }
);

// Approve an operation
const approvalHash = await workflowManager.approveOperation(
  CoreOperationType.OWNERSHIP_TRANSFER,
  txId,
  { from: ownerAddress }
);

// Execute a single-phase operation
const execHash = await workflowManager.executeOperation(
  CoreOperationType.TIMELOCK_UPDATE,
  { newTimelock: 86400 },
  { from: ownerAddress }
);
```

## Benefits

- **Consistency**: All operations follow the same patterns, making the codebase more maintainable.
- **Extensibility**: New modules can easily register their operations following the established patterns.
- **Type Safety**: TypeScript types ensure that operations are used correctly.
- **Separation of Concerns**: The registry separates operation definitions from their execution.
- **Reduced Duplication**: Common patterns are implemented once and reused across operations.
- **Developer Experience**: Clear, human-readable operation names improve code clarity and reduce errors.

## Migration Guide

To migrate existing code to the new architecture:

1. **Register Operations**: Register all operations with the Operation Registry.
2. **Replace Direct Contract Calls**: Replace direct contract calls with the Workflow Manager.
3. **Update UI Components**: Update UI components to use the Workflow Manager for executing operations.

## Future Improvements

- Add operation-specific validation rules
- Implement registry persistence
- Create UI components that adapt to operation types
- Add comprehensive testing framework for operations 