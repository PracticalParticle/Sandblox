# SandBlox

A fast prototyping platform for creating blockchain contracts and applications built on Particle's account abstraction technology.

![SandBlox](public/sandblox-logo.png)

## What is SandBlox?

SandBlox is a modern development platform that enables developers to rapidly prototype, build, and deploy blockchain applications using pre-built, encapsulated "blox" - reusable blockchain components powered by Particle's account abstraction technology.

The platform combines the power of React, Vite, RainbowKit, and TypeScript with Particle's advanced account abstraction technology to create a seamless development experience for blockchain applications.

## Core Technology: Guardian Account Abstraction

SandBlox leverages Particle's revolutionary account abstraction technology, which solves the critical private key security problem in blockchain applications through:

### Multi-Phase Security Architecture

- **Role-Based Security Model**: Distinct owner, broadcaster, and recovery roles with specific permissions
- **Time-Delayed Operations**: Mandatory waiting periods for critical actions, enabling intervention
- **Meta-Transaction Support**: Gasless transactions while maintaining security guarantees
- **Decentralized Control**: Preserves self-custody while enhancing security measures

Unlike traditional accounts where a single compromised key means complete asset loss, Particle's implementation distributes authority across specialized roles and introduces time-based security gates for critical operations.

## Blox Architecture

The heart of SandBlox is the `blox` folder, where each subfolder represents an encapsulated blockchain application:

```
sandblox/
└── src/
    └── blox/
        ├── SimpleVault/              # Example blox implementation
        │   ├── SimpleVault.sol       # Smart contract implementation
        │   ├── SimpleVault.tsx       # React component for integration
        │   ├── SimpleVault.ui.tsx    # UI components
        │   ├── SimpleVault.blox.json # Blox metadata
        │   ├── SimpleVault.abi.json  # Contract ABI
        │   ├── SimpleVault.md        # Blox Information
        └── ... other blox implementations
```

Each blox is a self-contained module that includes:
- Smart contract code
- React components for frontend integration
- Configuration files
- UI elements
- Custom hooks and utilities

## Project Structure

The project is organized as follows:

```
open-blox/
├── src/                  # Source code for the application
│   ├── blox/             # Blox implementations
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and libraries
│   ├── pages/            # Page components
│   ├── services/         # Service layer for API interactions
│   └── types/            # TypeScript type definitions
├── public/               # Static assets and Cloudflare Pages configuration
│   ├── _headers          # HTTP headers for Cloudflare Pages
│   ├── _redirects        # URL redirects for Cloudflare Pages
│   └── _routes.json      # Route configuration for Cloudflare Pages
├── docs/                 # Documentation markdown files
│   ├── introduction.md   # Introduction to the platform
│   ├── core-concepts.md  # Core concepts and architecture
│   ├── quick-start.md    # Getting started guide
│   └── ...               # Other documentation files
└── ...                   # Configuration files and other project files
```

### Documentation

The project documentation is stored in the `docs/` directory at the root of the project. These markdown files are served through the application and can be accessed via the `/docs/` routes.

The documentation is organized into categories:
- Getting Started (Introduction, Core Concepts, Quick Start)
- Core Features (Account Abstraction, Secure Operations, Blox Library)
- Development Guides (Blox Development, Best Practices, Security Guidelines)
- Support (FAQ, Troubleshooting, Reporting Issues)

### Deployment Configuration

The project is configured for deployment on Cloudflare Pages. The following files in the `public/` directory are used for Cloudflare Pages configuration:

- `_headers`: HTTP headers for security and caching
- `_redirects`: URL redirects for SPA routing
- `_routes.json`: Route configuration for Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Ethereum wallet (MetaMask, Rainbow, etc.)

### Environment Setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required environment variables:

```env
VITE_WALLET_CONNECT_PROJECT_ID=your-wallet-connect-project-id
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Development Workflow

### Creating a New Blox

1. Create a new folder in `src/blox/` with your blox name (e.g., `CustomVault`)
2. Create the following files:
   - `CustomVault.sol` - Smart contract
   - `CustomVault.tsx` - Main component
   - `CustomVault.ui.tsx` - UI components
   - `CustomVault.blox.json` - Metadata

### Blox Configuration

Each blox requires a configuration file (`*.blox.json`) that defines:

```json
{
  "id": "custom-vault",
  "name": "Custom Vault",
  "description": "A description of your blox",
  "category": "Category",
  "securityLevel": "Basic|Advanced|Enterprise",
  "features": [
    "Feature 1",
    "Feature 2"
  ],
  "requirements": [
    "Requirement 1"
  ],
  "deployments": 0,
  "lastUpdated": "YYYY-MM-DD",
  "libraries": {
    "LibraryName": {
      "name": "LibraryName",
      "description": "Description of the library"
    }
  }
}
```

## Available Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm run test
```

## Features

- 🧩 Modular "blox" architecture for rapid prototyping
- 🔒 Particle's advanced account abstraction for enhanced security
- 🌈 Modern React with TypeScript
- 🎨 Beautiful UI with Tailwind CSS
- ⚡ Lightning-fast development with Vite
- 🔄 Seamless blockchain integration with RainbowKit
- 📱 Responsive design for all devices

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Implement your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add some amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Particle Crypto Security team 
