---
title: Secure Operation Patterns
description: Understanding secure operation workflows in SandBlox
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, security, Particle AA]
category: Security
---

## Secure Operation Patterns

SandBlox provides robust security patterns for blockchain operations through Particle's account abstraction architecture. This guide explains the secure operation patterns available in the platform.

## Security Architecture Overview

The security architecture in SandBlox is built on several key principles:

1. **Role Separation**: Distinct roles with specific permissions
2. **Time-Locked Operations**: Mandatory waiting periods for critical actions
3. **Meta-Transaction Support**: Delegated transaction execution
4. **Secure Recovery**: Robust account recovery mechanisms

## Two-Phase Operations

The two-phase operation pattern is designed for maximum security when performing critical actions.

### How It Works

1. **Request Phase**: The operation is initiated and recorded with a future release time
2. **Time-Delay Period**: Mandatory waiting period for security monitoring
3. **Approval Phase**: After the time-lock expires, the operation can be executed

### When to Use Two-Phase Operations

Use two-phase operations for:

- High-value asset transfers
- Critical configuration changes
- Security parameter updates
- Ownership transfers
- Any operation that benefits from a security review period

## Meta-Transaction Workflows

SandBlox supports two approaches for meta-transactions to accommodate different security requirements.

### 1. Single-Phase Workflow

For operations that can be executed in a single step, where the broadcaster executes the transaction on behalf of the owner.

#### When to Use Single-Phase Meta-Transactions

Use this approach when:
- The operation does not require the security of a time-delay
- You want to optimize user experience with a single transaction
- The owner wants to delegate transaction execution to the broadcaster
- The broadcaster is willing to handle the transaction gas costs

### 2. Multi-Phase Workflow

For secure approval of already-requested operations, allowing the broadcaster to execute the approval on behalf of the owner.

#### When to Use Multi-Phase Meta-Transactions

Use this approach when:
- The operation has already been requested and is in pending state
- The owner wants to delegate the approval execution to the broadcaster
- You need to maintain the security of multi-phase operations while enabling delegated execution
- Operation cancellations can also use this pattern

## Security Considerations

### Time-Lock Periods

Choose appropriate time-lock periods based on the security requirements:

- **Low-Risk Operations**: 1 hour to 1 day
- **Medium-Risk Operations**: 1 day to 3 days
- **High-Risk Operations**: 3 days to 7 days
- **Critical Operations**: 7+ days

### Role Management

Properly manage the different roles in your application:

- **Owner**: The primary controller of the contract
- **Broadcaster**: Responsible for executing meta-transactions
- **Recovery**: Able to recover access in emergency situations

## Best Practices

### Smart Contract Implementation

1. **Unique Operation Types**: Define unique operation types for each critical function
2. **Clear Status Tracking**: Maintain clear status for all operations
3. **Comprehensive Events**: Emit detailed events for all operation state changes
4. **Parameter Validation**: Validate all input parameters thoroughly
5. **Gas Optimization**: Optimize gas usage while maintaining security

### Frontend Implementation

1. **Clear User Feedback**: Provide clear feedback on operation status
2. **Time Remaining Indicators**: Show time remaining until time-locks expire
3. **Confirmation Dialogs**: Require explicit confirmation for critical actions
4. **Error Handling**: Implement comprehensive error handling
5. **Security Information**: Clearly communicate security features to users

## Conclusion

Secure operation patterns are a fundamental aspect of SandBlox's security architecture. By implementing these patterns correctly, you can create blockchain applications that provide both high security and excellent user experience.

---

*Developed by Particle Crypto Security* 