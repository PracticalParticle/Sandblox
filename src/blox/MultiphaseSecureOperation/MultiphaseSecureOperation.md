# MultiphaseSecureOperation Library

## Overview

The `MultiphaseSecureOperation` library is a comprehensive framework for implementing secure multi-phase operations in smart contracts. It provides a robust foundation for creating time-locked transactions, meta-transactions, and role-based access control systems.

## Key Features

- **Time-locked Operations**: Transactions that require a waiting period before execution
- **Meta-transactions**: Support for gasless approvals through signature-based transactions
- **Role-based Access Control**: Flexible permission system for different operation types
- **Multiple Execution Types**: Support for both standard function calls and raw transaction data
- **Payment Handling**: Built-in support for both native tokens and ERC20 tokens

## Core Data Structures

### Transaction Status (TxStatus)
```solidity
enum TxStatus {
    UNDEFINED,
    PENDING,
    CANCELLED,
    COMPLETED,
    FAILED,
    REJECTED
}
```

### Execution Types
```solidity
enum ExecutionType {
    NONE,
    STANDARD,
    RAW
}
```

### Transaction Record (TxRecord)
```solidity
struct TxRecord {
    uint256 txId;
    uint256 releaseTime;
    TxStatus status;
    TxParams params;
    bytes result;
    PaymentDetails payment;
}
```

### Meta Transaction Parameters
```solidity
struct MetaTxParams {
    uint256 chainId;
    uint256 nonce;
    address handlerContract;
    bytes4 handlerSelector;
    uint256 deadline;
    uint256 maxGasPrice;
    address signer;
}
```

### Secure Operation State
```solidity
struct SecureOperationState {
    mapping(uint256 => TxRecord) txRecords;
    mapping(bytes32 => address) roles;
    mapping(address => bool) authorizedSigners;
    mapping(bytes32 => bytes32[]) allowedRolesForFunction;
    mapping(bytes32 => bool) supportedOperationTypes;
    mapping(bytes32 => string) operationTypeNames;
    uint256 txCounter;
    uint256 ownerNonce;
    uint256 timeLockPeriodInMinutes;
    bytes32[] supportedOperationTypesList;
    mapping(uint256 => uint256) pendingTxNonces;
}
```

## Key Functions

### Transaction Management

#### Request Phase
```solidity
function txRequest(
    SecureOperationState storage self,
    address requester,
    address target,
    uint256 value,
    uint256 gasLimit,
    bytes32 operationType,
    ExecutionType executionType,
    bytes memory executionOptions
) public returns (TxRecord memory)
```
Initiates a new transaction request with the specified parameters.

#### Approval Phase
```solidity
function txDelayedApproval(
    SecureOperationState storage self,
    uint256 txId
) public returns (TxRecord memory)
```
Approves a transaction after the time-lock period has elapsed.

#### Meta-transaction Approval
```solidity
function txApprovalWithMetaTx(
    SecureOperationState storage self,
    MetaTransaction memory metaTx
) public returns (TxRecord memory)
```
Approves a transaction using a meta-transaction (gasless approval).

### Role Management

```solidity
function addRole(
    SecureOperationState storage self,
    bytes32 role,
    address account
) public
```
Assigns a role to an account.

```solidity
function removeRole(
    SecureOperationState storage self,
    bytes32 role
) public
```
Removes a role assignment.

### Signer Management

```solidity
function addAuthorizedSigner(
    SecureOperationState storage self,
    address signer
) public
```
Adds an authorized signer for meta-transactions.

```solidity
function removeAuthorizedSigner(
    SecureOperationState storage self,
    address signer
) public
```
Removes an authorized signer.

## Security Features

### Time-lock Protection
- Enforces a mandatory waiting period before transaction execution
- Configurable time-lock period per contract instance
- Protection against immediate execution of sensitive operations

### Meta-transaction Security
- EIP-712 compliant signatures
- Nonce-based replay protection
- Gas price limits for meta-transactions
- Deadline-based expiration for signatures

### Role-based Access Control
- Granular permission system
- Support for multiple roles per operation
- Role hierarchy capabilities
- Dynamic role assignment and revocation

## Integration Guide

### 1. State Initialization
```solidity
SecureOperationState private _secureState;
```

### 2. Operation Type Definition
```solidity
bytes32 public constant CUSTOM_OPERATION = keccak256("CUSTOM_OPERATION");
```

### 3. Request Implementation
```solidity
function requestOperation() public {
    bytes memory executionOptions = MultiPhaseSecureOperation.createStandardExecutionOptions(
        FUNCTION_SELECTOR,
        ENCODED_PARAMS
    );
    
    MultiPhaseSecureOperation.txRequest(
        _secureState,
        msg.sender,
        target,
        value,
        gasLimit,
        OPERATION_TYPE,
        ExecutionType.STANDARD,
        executionOptions
    );
}
```

### 4. Approval Implementation
```solidity
function approveOperation(uint256 txId) public {
    MultiPhaseSecureOperation.txDelayedApproval(
        _secureState,
        txId
    );
}
```

## Best Practices

1. **Time-lock Configuration**
   - Set appropriate time-lock periods based on operation sensitivity
   - Consider minimum and maximum bounds for time-lock periods

2. **Meta-transaction Usage**
   - Implement proper signature verification
   - Use appropriate gas price limits
   - Set reasonable deadlines for meta-transactions

3. **Role Management**
   - Define clear role hierarchies
   - Implement proper role validation
   - Use descriptive role names

4. **Error Handling**
   - Implement proper revert messages
   - Handle all possible transaction states
   - Validate inputs thoroughly

## Events and Logging

The library emits events for all significant state changes:
- Transaction requests
- Approvals
- Cancellations
- Role assignments
- Signer management
- Execution results

## Limitations and Considerations

1. **Gas Costs**
   - Meta-transactions require more gas than direct transactions
   - Complex operations may require higher gas limits

2. **Time Sensitivity**
   - Time-lock periods are based on block timestamps
   - Consider network congestion in time-critical operations

3. **Storage Costs**
   - Each transaction record consumes storage
   - Consider cleanup mechanisms for completed transactions

## Example Implementation

```solidity
contract SecureContract {
    using MultiPhaseSecureOperation for MultiPhaseSecureOperation.SecureOperationState;
    
    MultiPhaseSecureOperation.SecureOperationState private _secureState;
    
    bytes32 public constant WITHDRAW = keccak256("WITHDRAW");
    
    constructor(uint256 timeLockPeriodInMinutes) {
        _secureState.timeLockPeriodInMinutes = timeLockPeriodInMinutes;
        _secureState.addRole(OWNER_ROLE, msg.sender);
    }
    
    function requestWithdraw(uint256 amount) public {
        // Implementation
    }
    
    function approveWithdraw(uint256 txId) public {
        // Implementation
    }
}
```
