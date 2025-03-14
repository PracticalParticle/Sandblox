---
title: Blox Development Guide
description: Guide for developing custom blox components
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, development, Guardian AA]
category: Development
---

## Blox Development Guide

This guide provides a comprehensive overview of how to develop custom blox components for the SandBlox platform.

## Blox Structure

A complete blox consists of the following files:

```
MyBlox/
├── MyBlox.sol                 # Smart contract implementation
├── MyBlox.tsx                 # Main React component
├── MyBlox.ui.tsx              # UI components
├── MyBlox.blox.json           # Blox metadata
├── MyBlox.abi.json            # Contract ABI (generated)
└── MyBlox.md                  # Documentation
```

## Step 1: Smart Contract Development

Start by creating your smart contract that extends the `SecureOwnable` base contract from Guardian Account Abstraction:

```solidity
// MyBlox.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@sand-blox/core/contracts/SecureOwnable.sol";

contract MyBlox is SecureOwnable {
    // Define operation types as constants
    bytes32 public constant CUSTOM_OPERATION = keccak256("CUSTOM_OPERATION");
    
    // Function selector constants
    bytes4 private constant EXECUTE_CUSTOM_OPERATION_SELECTOR = 
        bytes4(keccak256("executeCustomOperation(address,uint256)"));
    
    // State variables
    mapping(address => uint256) private _userValues;
    
    // Events
    event CustomOperationExecuted(address user, uint256 value);
    
    // Constructor
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
    
    // Request phase of the two-phase operation
    function requestCustomOperation(address user, uint256 value) public onlyOwner {
        // Create execution options for the delayed operation
        bytes memory executionOptions = MultiPhaseSecureOperation.createStandardExecutionOptions(
            EXECUTE_CUSTOM_OPERATION_SELECTOR,
            abi.encode(user, value)
        );
        
        // Request the operation with time-lock
        MultiPhaseSecureOperation.TxRecord memory txRecord = _secureState.txRequest(
            msg.sender,
            address(this),
            0, // no value
            100000, // gas limit
            CUSTOM_OPERATION,
            MultiPhaseSecureOperation.ExecutionType.STANDARD,
            executionOptions
        );
    }
    
    // Approval phase of the two-phase operation
    function approveCustomOperation(uint256 txId) public onlyOwner {
        // Approve and execute the operation after time-lock expires
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = 
            _secureState.txDelayedApproval(txId);
            
        // Verify operation type
        require(updatedRecord.params.operationType == CUSTOM_OPERATION, 
            "Invalid operation type");
            
        // Decode parameters
        (address user, uint256 value) = abi.decode(
            updatedRecord.params.executionOptions.data,
            (address, uint256)
        );
        
        // Execute the operation
        executeCustomOperation(user, value);
    }
    
    // Actual execution function
    function executeCustomOperation(address user, uint256 value) internal {
        // Implement your operation logic
        _userValues[user] = value;
        
        // Emit event
        emit CustomOperationExecuted(user, value);
    }
    
    // Meta-transaction support for approval
    function approveCustomOperationWithMetaTx(
        MultiPhaseSecureOperation.MetaTransaction memory metaTx
    ) public onlyBroadcaster {
        // Verify permissions
        _secureState.checkPermission(bytes4(keccak256("approveCustomOperationWithMetaTx(MetaTransaction)")));
        
        // Process meta-transaction
        MultiPhaseSecureOperation.TxRecord memory updatedRecord = 
            _secureState.txApprovalWithMetaTx(metaTx);
            
        // Verify operation type
        require(updatedRecord.params.operationType == CUSTOM_OPERATION, 
            "Invalid operation type");
            
        // Decode parameters
        (address user, uint256 value) = abi.decode(
            updatedRecord.params.executionOptions.data,
            (address, uint256)
        );
        
        // Execute the operation
        executeCustomOperation(user, value);
    }
    
    // View function to get user value
    function getUserValue(address user) public view returns (uint256) {
        return _userValues[user];
    }
}
```

### Security Best Practices

1. **Operation Types**: Define unique operation types for each critical function
2. **Time-Locks**: Use appropriate time-lock periods for sensitive operations
3. **Access Control**: Implement proper role-based access control
4. **Event Emission**: Emit events for all important state changes
5. **Parameter Validation**: Validate all input parameters thoroughly

## Step 2: TypeScript Integration

Create a TypeScript class that extends `BloxBase` to interact with your smart contract:

```typescript
// MyBlox.ts
import { BloxBase, Address, Hex, MetaTxParams, TxParams, MetaTransaction } from '@sand-blox/core';
import MyBloxABI from './MyBlox.abi.json';

export class MyBlox extends BloxBase {
  constructor(contractAddress: Address) {
    super(contractAddress, MyBloxABI);
  }
  
  // Request a custom operation
  async requestCustomOperation(
    user: Address,
    value: bigint
  ): Promise<any> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract or signer not initialized');
    }
    
    const tx = await this.contract.requestCustomOperation(user, value);
    const receipt = await tx.wait();
    
    return this.parseOperationFromReceipt(receipt);
  }
  
  // Approve a custom operation
  async approveCustomOperation(txId: bigint): Promise<any> {
    if (!this.contract || !this.signer) {
      throw new Error('Contract or signer not initialized');
    }
    
    const tx = await this.contract.approveCustomOperation(txId);
    const receipt = await tx.wait();
    
    return this.parseOperationFromReceipt(receipt);
  }
  
  // Generate unsigned meta-transaction for existing operation
  async generateUnsignedMetaTransactionForApproval(
    txId: bigint,
    metaTxParams: MetaTxParams
  ): Promise<MetaTransaction> {
    return this.generateUnsignedMetaTransactionForExisting(
      txId,
      metaTxParams
    );
  }
  
  // Get user value
  async getUserValue(user: Address): Promise<bigint> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }
    
    return await this.contract.getUserValue(user);
  }
}
```

## Step 3: React Component Development

Create the main React component for your blox:

```tsx
// MyBlox.tsx
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { MyBlox as MyBloxContract } from './MyBlox';
import { MyBloxUI } from './MyBlox.ui';
import { useSandBlox } from '@sand-blox/core';

export interface MyBloxProps {
  contractAddress?: string;
}

export function MyBlox({ contractAddress }: MyBloxProps) {
  const { address } = useAccount();
  const { provider, signer } = useSandBlox();
  
  const [blox, setBlox] = useState<MyBloxContract | null>(null);
  const [userValue, setUserValue] = useState<bigint>(0n);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [operations, setOperations] = useState<any[]>([]);
  
  // Initialize the blox
  useEffect(() => {
    if (!contractAddress || !provider) return;
    
    const initBlox = async () => {
      try {
        const bloxInstance = new MyBloxContract(contractAddress as `0x${string}`);
        await bloxInstance.initialize();
        
        if (signer) {
          await bloxInstance.connect(signer);
        }
        
        setBlox(bloxInstance);
      } catch (err) {
        setError(`Failed to initialize blox: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    initBlox();
  }, [contractAddress, provider, signer]);
  
  // Load user value and operations
  useEffect(() => {
    if (!blox || !address) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        const value = await blox.getUserValue(address as `0x${string}`);
        const ops = await blox.getOperationHistory();
        
        setUserValue(value);
        setOperations(ops);
        setLoading(false);
      } catch (err) {
        setError(`Failed to load data: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    };
    
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [blox, address]);
  
  // Request custom operation
  const handleRequestOperation = async (value: bigint) => {
    if (!blox || !address) return;
    
    try {
      setLoading(true);
      await blox.requestCustomOperation(address as `0x${string}`, value);
      setLoading(false);
    } catch (err) {
      setError(`Failed to request operation: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };
  
  // Approve custom operation
  const handleApproveOperation = async (txId: bigint) => {
    if (!blox) return;
    
    try {
      setLoading(true);
      await blox.approveCustomOperation(txId);
      setLoading(false);
    } catch (err) {
      setError(`Failed to approve operation: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };
  
  return (
    <MyBloxUI
      userValue={userValue}
      operations={operations}
      loading={loading}
      error={error}
      onRequestOperation={handleRequestOperation}
      onApproveOperation={handleApproveOperation}
    />
  );
}
```

## Step 4: Blox Configuration

Create a metadata file for your blox:

```json
// MyBlox.blox.json
{
  "id": "my-custom-blox",
  "name": "My Custom Blox",
  "description": "A custom blox that demonstrates secure operation patterns",
  "category": "Demo",
  "securityLevel": "Basic",
  "features": [
    "Two-phase operations",
    "Meta-transaction support",
    "User value management"
  ],
  "requirements": [
    "SandBlox Core"
  ],
  "deployments": 0,
  "lastUpdated": "2025-03-11",
  "libraries": {
    "SandBloxCore": {
      "name": "SandBloxCore",
      "description": "Core libraries for SandBlox platform"
    }
  }
}
```

## Step 5: Documentation

Create comprehensive documentation for your blox:

```markdown
// MyBlox.md
# My Custom Blox

A demonstration blox that showcases secure operation patterns in SandBlox using Guardian Account Abstraction.

## Features

- Two-phase operations with time-lock security
- Meta-transaction support for gas-less approvals
- User value management with secure updates

## Usage

### Installation

```bash
npm install @sand-blox/my-custom-blox
```

### Integration

```tsx
import { MyBlox } from '@sand-blox/my-custom-blox';

function App() {
  return (
    <div>
      <h1>My App</h1>
      <MyBlox contractAddress="0x..." />
    </div>
  );
}
```

## Security Considerations

- All value updates require a two-phase operation with time-lock
- Operations can be approved via meta-transactions for enhanced UX
- Role separation ensures proper access control

## API Reference

### Smart Contract

- `requestCustomOperation(address user, uint256 value)`: Initiates a value update
- `approveCustomOperation(uint256 txId)`: Approves a pending operation
- `getUserValue(address user)`: Returns the current value for a user

### React Component

- `<MyBlox contractAddress="0x..." />`: Main component with all functionality


## Best Practices

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

---

By following this guide, you'll be able to create secure, reusable blox components that leverage the full power of the SandBlox platform and Guardian Account Abstraction. 