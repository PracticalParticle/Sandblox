---
title: Frequently Asked Questions
description: Common questions about the SandBlox platform
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, FAQ, Guardian AA]
category: Support
---

## Frequently Asked Questions

This page answers common questions about the SandBlox platform and Guardian Account Abstraction.

## General Questions

### What is SandBlox?

SandBlox is a modular blockchain development platform that enables developers to build secure decentralized applications using pre-built, audited components called "blox." The platform is powered by Guardian Account Abstraction, providing enhanced security and user experience.

### Who is SandBlox for?

SandBlox is designed for blockchain developers of all experience levels:
- **Beginners**: Use pre-built blox to create applications without deep blockchain expertise
- **Intermediate**: Customize existing blox to meet specific requirements
- **Advanced**: Create custom blox and contribute to the ecosystem

### Is SandBlox open source?

Yes, SandBlox is open source and available under the MIT license. The core platform, blox library, and documentation are all open source and can be found on our GitHub repository.

### What blockchains does SandBlox support?

SandBlox currently supports Ethereum and Ethereum-compatible blockchains, including:
- Ethereum Mainnet
- Polygon
- Arbitrum
- Optimism
- Base
- Avalanche C-Chain
- BNB Smart Chain

Support for additional blockchains is planned for future releases.

## Technical Questions

### How does SandBlox relate to Guardian Account Abstraction?

SandBlox is built on top of Guardian Account Abstraction (Guardian AA), which provides the security infrastructure for all blox components. Guardian AA enables advanced security features like multi-signature control, time-locked operations, and meta-transactions.

### What programming languages are used in SandBlox?

SandBlox uses:
- **Smart Contracts**: Solidity
- **Frontend**: TypeScript, React
- **Testing**: JavaScript/TypeScript, Hardhat/Foundry

### Can I use SandBlox with my existing project?

Yes, SandBlox is designed to be modular and can be integrated with existing projects. You can:
- Add individual blox to your existing application
- Gradually migrate functionality to SandBlox components
- Use SandBlox utilities without adopting the entire framework

### How do I deploy a SandBlox application?

SandBlox applications can be deployed like any other web application. The frontend can be deployed to services like Vercel, Netlify, or AWS, while the smart contracts can be deployed to your blockchain of choice using the provided deployment scripts.

## Development Questions

### How do I get started with SandBlox?

The best way to get started is to follow our [Quick Start Guide](/docs/quick-start), which will walk you through setting up your development environment, creating a new project, and deploying your first application.

### How do I create a custom blox?

Creating a custom blox involves developing both the smart contract and frontend components. Our [Blox Development Guide](/docs/blox-development) provides detailed instructions on creating, testing, and publishing your own blox.

### How do I contribute to SandBlox?

We welcome contributions to the SandBlox ecosystem! You can contribute by:
- Creating and sharing custom blox
- Improving the documentation
- Fixing bugs and adding features to the core platform
- Providing feedback and suggestions

See our [Contributing Guide](https://github.com/PracticalParticle/sand-blox/blob/main/CONTRIBUTING.md) for more information.

### Are there templates available for common applications?

Yes, SandBlox provides several starter templates for common application types:
- DeFi applications
- NFT marketplaces
- DAO governance
- Token-based applications
- Multi-signature wallets

These templates can be found in our GitHub repository.

## Security Questions

### How secure are SandBlox components?

All core blox in the SandBlox library undergo rigorous security audits by independent security firms before being published. The platform is built on Guardian Account Abstraction, which implements industry-leading security practices.

### Has SandBlox been audited?

Yes, the SandBlox core platform and all official blox have been audited by leading blockchain security firms. Audit reports are available in our GitHub repository.

### How does SandBlox handle private keys?

SandBlox never has access to users' private keys. All key management is handled by the user's wallet provider. SandBlox uses Guardian Account Abstraction to enable advanced security features without requiring access to private keys.

### What security features does SandBlox provide?

SandBlox provides numerous security features, including:
- Two-phase operations with time-locks
- Multi-signature control
- Meta-transactions for gas-less operations
- Role-based access control
- Secure recovery mechanisms
- Comprehensive event logging

## Support and Community

### Where can I get help with SandBlox?

Support is available through several channels:
- [Documentation](https://docs.sandblox.dev)
- [Discord Community](https://discord.gg/sandblox)
- [GitHub Issues](https://github.com/PracticalParticle/sand-blox/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/sandblox)

### Is there a community around SandBlox?

Yes, SandBlox has an active community of developers, contributors, and users. You can join our Discord server to connect with other SandBlox developers, ask questions, and share your projects.

### How do I report a bug or request a feature?

Bugs and feature requests can be submitted through our [GitHub Issues](https://github.com/PracticalParticle/sand-blox/issues) page. Please use the provided templates to ensure your submission contains all necessary information.

### Is commercial support available?

Yes, Particle Crypto Security offers commercial support, training, and custom development services for SandBlox. Contact us at support@particle.security for more information.

## Licensing and Commercial Use

### Can I use SandBlox for commercial projects?

Yes, SandBlox is available under the MIT license, which allows for commercial use. You can use SandBlox to build and deploy commercial applications without restrictions.

### Do I need to attribute SandBlox in my project?

While not strictly required by the MIT license, we appreciate attribution in your project documentation or about page. This helps grow the SandBlox ecosystem and community.

### Are there any licensing restrictions for custom blox?

Custom blox you create can be licensed however you prefer. However, if you're building on top of existing SandBlox components, you must comply with their licenses (typically MIT).

---

*Developed by Particle Crypto Security* 