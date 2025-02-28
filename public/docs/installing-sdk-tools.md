---
title: Installing SandBlox SDKs & Tools
description: Guide to installing SandBlox development tools and SDKs
author:  Particle CS Team
lastUpdated: 2024-03-15
tags: [installation, setup, tools, sdk]
category: Getting Started
---

## Prerequisites

Before installing SandBlox tools, ensure you have:
- Node.js 16+ installed
- npm or yarn package manager
- Git version control
- Basic blockchain development knowledge

## Installation Steps

### 1. Install Core SDK

First, install the SandBlox core SDK using npm or yarn:

```bash
# Using npm
npm install @sandblox/sdk

# Or using yarn
yarn add @sandblox/sdk
```

### 2. Install Security Extensions

Install required security modules:

```bash
npm install @sandblox/security @particle/paa-sdk
```

### 3. Install CLI Tools

Install the SandBlox CLI globally:

```bash
npm install -g @sandblox/cli
```

Verify the installation:

```bash
sandblox --version
```

## Basic Configuration

Create a new SandBlox project and configure the SDK:

```typescript
import { SandBlox } from '@sandblox/sdk';

// Initialize SandBlox
const sandblox = new SandBlox({
  apiKey: 'your-api-key',
  environment: 'testnet',
  security: {
    mfa: true,
    monitoring: true
  }
});

// Configure security features
await sandblox.security.configure({
  timelock: 24 * 60 * 60, // 24 hours
  approvals: {
    required: 2,
    timeout: 12 * 60 * 60
  }
});
```

## Verification

Test your installation with this simple verification:

```typescript
async function verifySetup() {
  // Check SDK status
  const status = await sandblox.checkStatus();
  console.log('SandBlox Status:', status);

  // Verify security features
  const securityStatus = await sandblox.security.verify();
  console.log('Security Status:', securityStatus);
}
```

## Project Structure

After installation, your project structure should look like this:

```
my-sandblox-project/
├── node_modules/
├── src/
│   ├── contracts/
│   ├── config/
│   └── index.ts
├── package.json
└── sandblox.config.js
```

## Next Steps

1. Configure your development environment
2. Set up your first blockchain project
3. Explore integration examples
4. Review security documentation

For detailed configuration options, see our [Configuration Guide](../configuration/config-options.md).

## Troubleshooting

Common installation issues and solutions:

| Issue | Solution |
|-------|----------|
| Version conflicts | Update Node.js to 16+ |
| Permission errors | Use sudo for global installs |
| Network issues | Check firewall settings |
| SDK conflicts | Clear npm cache and reinstall |

For additional help, visit our [support forum](https://forum.sandblox.org) or [GitHub repository](https://github.com/sandblox/sdk). 