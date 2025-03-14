---
title: Quick Start Guide
description: Get started with SandBlox quickly
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, tutorial, Guardian AA]
category: Getting Started
---

## Quick Start Guide

This guide will help you set up your first SandBlox project and start building secure blockchain applications.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) (v7 or later) or [yarn](https://yarnpkg.com/) (v1.22 or later)
- [Git](https://git-scm.com/)

## Installation

1. Create a new SandBlox project using our starter template:

```bash
# Using npm
npx create-sand-blox my-blox-app

# Using yarn
yarn create sand-blox my-blox-app
```

2. Navigate to your project directory:

```bash
cd my-blox-app
```

3. Install dependencies:

```bash
# Using npm
npm install

# Using yarn
yarn install
```

4. Start the development server:

```bash
# Using npm
npm run dev

# Using yarn
yarn dev
```

Your application should now be running at `http://localhost:5173`.

## Project Structure

After installation, your project will have the following structure:

```
my-blox-app/
├── public/                # Static assets
├── src/
│   ├── blox/             # Blox components
│   ├── components/       # Shared React components
│   ├── contexts/         # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Application pages
│   ├── styles/           # Global styles
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main application component
│   └── main.tsx          # Application entry point
├── .env                  # Environment variables
├── index.html            # HTML entry point
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── README.md             # Project documentation
```

## Adding Your First Blox

1. Import a blox from the SandBlox library:

```bash
# Using npm
npm install @sand-blox/simple-vault

# Using yarn
yarn add @sand-blox/simple-vault
```

2. Add the blox to your application:

```tsx
// src/pages/Home.tsx
import { SimpleVault } from '@sand-blox/simple-vault';

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My First SandBlox App</h1>
      <SimpleVault />
    </div>
  );
}
```

3. Configure the blox in your application:

```tsx
// src/App.tsx
import { SandBloxProvider } from '@sand-blox/core';
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import Home from './pages/Home';

const { chains, publicClient } = configureChains(
  [mainnet, sepolia],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: 'My SandBlox App',
  projectId: 'YOUR_PROJECT_ID',
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export default function App() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <SandBloxProvider>
          <Home />
        </SandBloxProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
```

## Creating a Custom Blox

To create your own custom blox:

1. Create a new directory in the `src/blox` folder:

```bash
mkdir -p src/blox/my-custom-blox
```

2. Create the necessary files for your blox:

```bash
touch src/blox/my-custom-blox/MyCustomBlox.sol
touch src/blox/my-custom-blox/MyCustomBlox.tsx
touch src/blox/my-custom-blox/MyCustomBlox.ui.tsx
touch src/blox/my-custom-blox/MyCustomBlox.blox.json
touch src/blox/my-custom-blox/MyCustomBlox.md
```

3. Implement your blox following the [Blox Development Guide](/docs/blox-development).

## Deploying Your Application

To deploy your SandBlox application:

1. Build your application:

```bash
# Using npm
npm run build

# Using yarn
yarn build
```

2. Deploy the generated `dist` folder to your preferred hosting service.

## Next Steps

Now that you have your first SandBlox application running, you can:

- Explore the [Blox Library](/docs/blox-library) to discover available components
- Learn about [Secure Operation Patterns](/docs/secure-operations) to implement secure workflows
- Understand [Guardian Account Abstraction](/docs/account-abstraction) to leverage advanced security features
- Follow the [Blox Development Guide](/docs/blox-development) to create custom blox

---

Need help? Join our [Discord community](https://discord.gg/sandblox) or check out our [GitHub repository](https://github.com/particle-cs/sand-blox). 