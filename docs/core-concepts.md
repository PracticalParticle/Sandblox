---
title: Core Concepts
description: Fundamental concepts and architecture of SandBlox
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, architecture, Particle AA]
category: Fundamentals
---

## Blox Architecture

The fundamental building block of SandBlox is the "blox" - a self-contained module that represents a complete blockchain application component. Each blox is designed to be modular, reusable, and secure by default.

### Blox Structure

A typical blox includes:

```
Blox/
├── Blox.sol                 # Smart contract implementation
├── Blox.tsx                 # Main React component
├── Blox.ui.tsx              # UI components
├── Blox.blox.json           # Blox metadata
├── Blox.abi.json            # Contract ABI
└── Blox.md                  # Blox documentation
```

This architecture provides several key advantages:

1. **Complete Encapsulation**: Each blox contains everything needed for deployment and use
2. **Seamless Reusability**: Blox can be easily reused across different projects
3. **Natural Composability**: Multiple blox can be combined to create complex applications
4. **Independent Testability**: Each blox can be tested independently before integration

## Particle Account Abstraction Security

All blox in SandBlox are built on Particle's account abstraction technology, which provides:

### Multi-Phase Security Architecture

- **Role-Based Access Control**: Distinct roles (owner, broadcaster, recovery) with specific permissions
- **Time-Delayed Operations**: Critical actions require a mandatory waiting period
- **Meta-Transaction Support**: Delegated transaction execution through the broadcaster role
- **Secure Recovery Mechanisms**: Robust account recovery options

### Enhanced Security Model

- **Separation of Concerns**: Decoupling of asset control from transaction authorization
- **Defense in Depth**: Multiple security layers through separation of concerns
- **Time-Locked Operations**: Enhanced safety through mandatory waiting periods
- **Secure Verification**: Cryptographic verification for all meta-transactions

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

## Core Technology Stack

SandBlox leverages a modern technology stack:

- **Solidity**: For secure smart contract development
- **TypeScript**: For type-safe frontend development
- **React**: For building interactive UI components
- **Vite**: For fast, modern build tooling
- **RainbowKit**: For wallet connection and interaction
- **Tailwind CSS**: For utility-first styling

## Secure Operation Workflow Patterns

SandBlox supports multiple workflow patterns for secure operations:

### Two-Phase Workflow

For critical operations requiring maximum security:

1. **Request Phase**: Initiates the operation with a future release time
2. **Time-Delay Period**: Mandatory waiting period for security monitoring
3. **Approval Phase**: After the time-lock expires, the operation can be executed

### Meta-Transaction Workflows

1. **Single-Phase Workflow**: For operations that can be executed in a single step
2. **Multi-Phase Workflow**: For secure approval of already-requested operations

These patterns provide flexibility while maintaining security, allowing developers to choose the appropriate level of security for each operation.

## Component Integration Layers

SandBlox provides three key integration layers:

### 1. Smart Contract Layer

Secure, audited smart contracts that implement the core functionality of each blox.

### 2. TypeScript Integration Layer

A comprehensive TypeScript SDK for interacting with blox smart contracts.

### 3. React Component Layer

Ready-to-use React components for UI integration, including:
- Main components for state management
- UI components for user interaction
- Custom hooks for blockchain integration

---

Understanding these core concepts will provide a solid foundation for developing with SandBlox. Next, explore our [Quick Start Guide](/docs/quick-start) to begin building your first application. 