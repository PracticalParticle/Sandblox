---
title: Installing OpenBlox SDKs & Tools
description: Guide to installing OpenBlox development tools and SDKs
author:  Particle CS Team
lastUpdated: 2024-03-15
tags: [installation, setup, tools, sdk]
category: Getting Started
---

## Prerequisites

Before installing OpenBlox tools, ensure you have:
- Node.js 16+ installed
- npm or yarn package manager
- Git version control
- Basic blockchain development knowledge

## Installation Steps

### 1. Install Core SDK

First, install the OpenBlox core SDK using npm or yarn:

```bash
# Using npm
npm install @openblox/sdk

# Or using yarn
yarn add @openblox/sdk
```

### 2. Install Security Extensions

Install required security modules:

```bash
npm install @openblox/security @particle/paa-sdk
```

### 3. Install CLI Tools

Install the OpenBlox CLI globally:

```bash
npm install -g @openblox/cli
```

Verify the installation:

```bash
openblox --version
```

## Basic Configuration

Create a new OpenBlox project and configure the SDK:

```typescript
import { OpenBlox } from '@openblox/sdk';

// Initialize OpenBlox
const openblox = new OpenBlox({
  apiKey: 'your-api-key',
  environment: 'testnet',
  security: {
    mfa: true,
    monitoring: true
  }
});

// Configure security features
await openblox.security.configure({
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
  const status = await openblox.checkStatus();
  console.log('OpenBlox Status:', status);

  // Verify security features
  const securityStatus = await openblox.security.verify();
  console.log('Security Status:', securityStatus);
}
```

## Project Structure

After installation, your project structure should look like this:

```
my-openblox-project/
├── node_modules/
├── src/
│   ├── contracts/
│   ├── config/
│   └── index.ts
├── package.json
└── openblox.config.js
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

For additional help, visit our [support forum](https://forum.openblox.org) or [GitHub repository](https://github.com/openblox/sdk). 