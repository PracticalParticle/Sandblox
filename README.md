# Open Blox UI

A modern Web3 UI application built with React, Vite, and RainbowKit for blockchain interactions.

## Project Structure

```
open-blox-ui/
├── src/
│   ├── test/
│   │   ├── test-utils.tsx    # Testing utilities and providers
│   │   └── setup.ts         # Test setup configuration
│   ├── polyfills.ts         # Web3 polyfills
│   ├── main.tsx             # Application entry point
│   ├── App.tsx              # Main application component
│   └── index.css            # Global styles
├── .github/
│   └── workflows/
│       └── main.yml         # CI/CD configuration
├── public/                  # Static assets
├── .env                     # Environment variables
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── tailwind.config.js      # Tailwind CSS configuration
```

## Environment Variables

The following environment variables are required:

- `VITE_WALLET_CONNECT_PROJECT_ID`: Your WalletConnect Cloud project ID

Create a `.env` file in the project root and add these variables:

```env
VITE_WALLET_CONNECT_PROJECT_ID=your-project-id
```

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Run tests:
   ```bash
   npm run test
   ```

4. Type checking:
   ```bash
   npm run typecheck
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Features

- 🌈 Modern React with TypeScript
- 🔒 Secure Web3 integration with RainbowKit
- 🎨 Beautiful UI with Tailwind CSS
- ⚡ Lightning-fast development with Vite
- 🧪 Comprehensive testing setup
- 🔄 Automated CI/CD pipeline
- 🛡️ Security best practices

## Security

This project implements several security measures:

- Content Security Policy (CSP) headers
- Strict environment variable typing
- Automated security scanning
- Dependency auditing

## Testing

The project uses Vitest and React Testing Library for testing. Run tests with:

```bash
npm run test
```

For coverage report:

```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MPL 2.0 
