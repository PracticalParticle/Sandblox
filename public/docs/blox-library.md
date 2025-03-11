---
title: Blox Library
description: Catalog of available blox components in SandBlox
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, components, Particle AA]
category: Components
---

## Blox Library

The SandBlox library provides a collection of pre-built, secure blockchain components that you can use to rapidly build your applications. Each blox is designed to be modular, reusable, and secure by default using Particle Account Abstraction.

## Core Blox

### SimpleVault

A secure vault for storing and managing ETH and ERC20 tokens.

**Features:**
- Secure storage for ETH and ERC20 tokens
- Two-phase withdrawal process with time-lock
- Meta-transaction support for delegated execution
- Complete frontend for managing vault assets

**Security Model:**
- Minimum timelock of 24 hours for all withdrawals
- Role separation for owner, broadcaster, and recovery
- Meta-transaction verification for delegated execution
- Cancellation window for pending withdrawals

**Installation:**
```bash
npm install @sand-blox/simple-vault
```

**Usage:**
```tsx
import { SimpleVault } from '@sand-blox/simple-vault';

function App() {
  return <SimpleVault contractAddress="0x..." />;
}
```

### MultiSigWallet

A secure multi-signature wallet requiring multiple approvals for transactions.

**Features:**
- Configurable number of required signatures
- Two-phase transaction execution with time-lock
- Comprehensive transaction history
- Role-based access control

**Security Model:**
- M-of-N signature requirement (configurable)
- Time-locked transactions for critical operations
- Transaction cancellation by any owner
- Detailed event logging for all operations

**Installation:**
```bash
npm install @sand-blox/multi-sig-wallet
```

### TokenVesting

A secure token vesting contract with time-based release schedules.

**Features:**
- Configurable vesting schedules
- Cliff and linear vesting support
- Emergency pause and revoke capabilities
- Detailed vesting dashboard

**Security Model:**
- Time-locked schedule modifications
- Role-based access for administrators
- Secure claim process for beneficiaries
- Comprehensive event logging

**Installation:**
```bash
npm install @sand-blox/token-vesting
```

## DeFi Blox

### LiquidityPool

A secure liquidity pool for token swapping and fee generation.

**Features:**
- Automated market maker functionality
- Fee collection and distribution
- Liquidity provider token minting
- Pool analytics dashboard

**Security Model:**
- Time-locked parameter updates
- Slippage protection for swaps
- Role-based access for administrators
- Price manipulation protection

**Installation:**
```bash
npm install @sand-blox/liquidity-pool
```

### StakingRewards

A secure staking contract with reward distribution.

**Features:**
- Flexible reward distribution
- Time-based staking periods
- Early withdrawal penalties
- Staking analytics dashboard

**Security Model:**
- Time-locked reward rate changes
- Secure reward calculation
- Role-based access for administrators
- Protection against reward manipulation

**Installation:**
```bash
npm install @sand-blox/staking-rewards
```

## NFT Blox

### NFTMarketplace

A secure NFT marketplace for buying, selling, and auctioning NFTs.

**Features:**
- Fixed price listings
- Timed auctions
- Bidding system
- Royalty distribution

**Security Model:**
- Secure escrow for transactions
- Time-locked parameter updates
- Role-based access for administrators
- Protection against front-running

**Installation:**
```bash
npm install @sand-blox/nft-marketplace
```

## Creating Custom Blox

If you need functionality not provided by the existing blox, you can create your own custom blox. Follow our [Blox Development Guide](/docs/blox-development) to learn how to create, test, and publish your own blox.

## Blox Security Audits

All blox in the SandBlox library undergo rigorous security audits before being published. You can view the audit reports for each blox in their respective documentation pages.

---

*Developed by Particle Crypto Security* 