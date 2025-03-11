# SandBlox

A fast prototyping platform for creating blockchain contracts and applications built on Particle's account abstraction technology.

![SandBlox](public/sandblox-logo.png)

## What is SandBlox?

SandBlox is a modern development platform that enables developers to rapidly prototype, build, and deploy blockchain applications using pre-built, encapsulated "blox" - reusable blockchain components powered by Particle's account abstraction technology.

The platform combines the power of React, Vite, RainbowKit, and TypeScript with Particle's advanced account abstraction technology to create a seamless development experience for blockchain applications.

## Core Technology: Particle Account Abstraction

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
