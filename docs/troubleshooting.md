---
title: Troubleshooting
description: Common issues and solutions for SandBlox applications
author: Particle CS Team
lastUpdated: 2025-03-11
tags: [SandBlox, blockchain, troubleshooting, Guardian AA]
category: Support
---

## Troubleshooting SandBlox Applications

This guide provides solutions for common issues you might encounter when developing and deploying SandBlox applications.

## Development Environment Issues

### Installation Problems

#### npm/yarn Installation Failures

**Issue**: Package installation fails with dependency errors.

**Solution**:
1. Clear your npm/yarn cache:
   ```bash
   npm cache clean --force
   # or
   yarn cache clean
   ```
2. Delete the `node_modules` directory and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   # or
   yarn
   ```
3. Check for Node.js version compatibility. SandBlox requires Node.js v16 or higher.

#### Compiler Version Mismatches

**Issue**: Solidity compiler version conflicts.

**Solution**:
1. Check your `hardhat.config.js` or `foundry.toml` file for the correct compiler version.
2. Update your compiler version to match the SandBlox requirements (Solidity 0.8.x).
3. If using Hardhat, run:
   ```bash
   npx hardhat compile --force
   ```
4. If using Foundry, run:
   ```bash
   forge clean && forge build
   ```

### Project Setup Issues

#### Template Initialization Failures

**Issue**: SandBlox project template fails to initialize.

**Solution**:
1. Fork and clone the repository instead:
   ```bash
   git clone https://github.com/PracticalParticle/sand-blox.git my-project
   cd my-project
   npm install
   ```
2. Try starting with a fresh clone:
   ```bash
   git clone https://github.com/PracticalParticle/sand-blox.git my-new-project
   cd my-new-project
   npm install
   ```
3. Check your network connection and proxy settings.

#### Configuration Errors

**Issue**: Configuration errors when starting the development server.

**Solution**:
1. Verify your `.env` file contains all required variables.
2. Check for syntax errors in configuration files.
3. Ensure all paths in configuration files are correct.
4. Compare your configuration with the example in the documentation.

## Smart Contract Issues

### Compilation Errors

#### Solidity Syntax Errors

**Issue**: Solidity code fails to compile due to syntax errors.

**Solution**:
1. Check the error message for the specific line and file.
2. Verify that you're using compatible Solidity syntax for your compiler version.
3. Look for missing semicolons, brackets, or other syntax elements.
4. Ensure imported contracts and libraries are correctly referenced.

#### Type Errors

**Issue**: Type-related compilation errors.

**Solution**:
1. Check variable types and ensure they match function parameters.
2. Verify that you're not mixing incompatible types.
3. Add explicit type conversions where necessary.
4. Check for overflow/underflow in arithmetic operations.

### Deployment Issues

#### Gas Estimation Failures

**Issue**: Contract deployment fails due to gas estimation errors.

**Solution**:
1. Check if your contract's constructor is too complex or uses too much gas.
2. Simplify initialization logic or move it to a separate function.
3. Try deploying with a manual gas limit:
   ```bash
   npx hardhat run scripts/deploy.js --gas-limit 8000000
   ```
4. Verify that your contract size doesn't exceed the maximum limit (24KB).

#### Network Configuration Issues

**Issue**: Deployment fails due to network configuration problems.

**Solution**:
1. Verify your network configuration in `hardhat.config.js` or `foundry.toml`.
2. Check that you have sufficient funds in your deployment account.
3. Ensure you're targeting the correct network:
   ```bash
   npx hardhat run scripts/deploy.js --network goerli
   ```
4. Verify RPC endpoint availability and rate limits.

## Frontend Issues

### Connection Problems

#### Wallet Connection Failures

**Issue**: Unable to connect to wallet providers.

**Solution**:
1. Check browser console for specific error messages.
2. Verify that the wallet extension is installed and unlocked.
3. Ensure you're connecting to a supported network.
4. Try using a different wallet provider.
5. Check for conflicts with other wallet-related browser extensions.

#### RPC Connection Issues

**Issue**: Application cannot connect to blockchain RPC endpoints.

**Solution**:
1. Verify your RPC endpoint configuration.
2. Check if the RPC provider is operational.
3. Try using a different RPC provider.
4. Check for CORS issues if using a browser-based application.
5. Verify network ID matches the expected chain ID.

### Transaction Issues

#### Transaction Failures

**Issue**: Transactions fail to execute or get reverted.

**Solution**:
1. Check the transaction error message in the console or blockchain explorer.
2. Verify that you have sufficient funds for gas.
3. Check function parameters for correctness.
4. Ensure you have the necessary permissions to call the function.
5. Try increasing the gas limit for complex transactions.

#### Transaction Stuck Pending

**Issue**: Transactions remain in pending state for a long time.

**Solution**:
1. Check if the gas price is too low for current network conditions.
2. Try speeding up the transaction through your wallet.
3. If using a custom nonce, verify it's correct.
4. For development networks, try restarting the node.
5. Consider implementing a transaction monitoring and retry mechanism.

### Rendering Issues

#### Component Rendering Problems

**Issue**: UI components fail to render correctly.

**Solution**:
1. Check browser console for JavaScript errors.
2. Verify that all required props are passed to components.
3. Check for null or undefined values in your data.
4. Ensure you're handling loading and error states properly.
5. Verify CSS conflicts or styling issues.

#### Data Loading Issues

**Issue**: Data from blockchain fails to load or update.

**Solution**:
1. Check if your data fetching hooks are configured correctly.
2. Verify event listeners are set up properly.
3. Implement proper error handling for data fetching.
4. Check for race conditions in asynchronous data loading.
5. Implement retry mechanisms for failed data fetches.

## Guardian Account Abstraction Issues

### Account Creation Problems

#### Account Initialization Failures

**Issue**: Guardian AA account fails to initialize.

**Solution**:
1. Verify that you're using the latest version from the GitHub repository: https://github.com/PracticalParticle/sand-blox.
2. Check if the account factory contract is deployed on your target network.
3. Ensure you have sufficient funds for account creation.
4. Check browser console for specific error messages.
5. Verify that all required parameters are provided.

#### Recovery Setup Issues

**Issue**: Account recovery setup fails.

**Solution**:
1. Verify that recovery addresses are valid.
2. Check if the recovery threshold is valid (must be <= number of guardians).
3. Ensure all guardian signatures are correct.
4. Check for gas estimation issues during recovery setup.
5. Verify that the recovery module is correctly configured.

### Transaction Execution Issues

#### Meta-Transaction Failures

**Issue**: Meta-transactions fail to execute.

**Solution**:
1. Verify that the signature is valid and correctly formatted.
2. Check if the relayer has sufficient funds for gas.
3. Ensure the nonce is correct and not already used.
4. Verify that the transaction deadline hasn't expired.
5. Check if the relayer service is operational.

#### Time-Lock Operation Issues

**Issue**: Time-locked operations fail to execute.

**Solution**:
1. Verify that the time-lock period has elapsed.
2. Check if the operation was cancelled.
3. Ensure you're calling the correct execution function.
4. Verify that the operation parameters match the requested operation.
5. Check if the operation ID is correct.

## Testing Issues

### Test Failures

#### Unit Test Failures

**Issue**: Unit tests fail unexpectedly.

**Solution**:
1. Check the specific test failure message.
2. Verify that test fixtures are set up correctly.
3. Ensure test environment variables are configured.
4. Check for race conditions in asynchronous tests.
5. Verify that contract state is reset between tests.

#### Integration Test Issues

**Issue**: Integration tests fail or time out.

**Solution**:
1. Increase test timeout for complex operations.
2. Check if external services or networks are available.
3. Verify that test accounts have sufficient funds.
4. Check for environment-specific configuration issues.
5. Consider using mocks for external dependencies.

## Deployment and Production Issues

### Build Problems

#### Build Failures

**Issue**: Production build fails.

**Solution**:
1. Check build logs for specific error messages.
2. Verify that all dependencies are installed.
3. Check for environment-specific configuration issues.
4. Ensure all required environment variables are set.
5. Try clearing the build cache and rebuilding.

#### Performance Issues

**Issue**: Production application has performance problems.

**Solution**:
1. Implement code splitting to reduce bundle size.
2. Optimize images and assets.
3. Use memoization for expensive computations.
4. Implement efficient data fetching strategies.
5. Consider using a CDN for static assets.

### Monitoring and Debugging

#### Error Tracking

**Issue**: Difficulty tracking and diagnosing production errors.

**Solution**:
1. Implement error tracking services like Sentry.
2. Add detailed logging for critical operations.
3. Use unique error codes for different error types.
4. Implement structured error handling.
5. Set up alerts for critical errors.

#### Performance Monitoring

**Issue**: Need to monitor application performance.

**Solution**:
1. Implement analytics for key user flows.
2. Track transaction success rates and execution times.
3. Monitor RPC endpoint performance.
4. Set up alerts for performance degradation.
5. Collect user feedback on performance issues.

## Getting Additional Help

If you're still experiencing issues after trying these solutions, you can get additional help through:

1. **Discord Community**: Join our [Discord server](https://discord.gg/sandblox) to connect with other developers.
2. **GitHub Issues**: Submit a detailed issue on our [GitHub repository](https://github.com/PracticalParticle/sand-blox/issues).
3. **Stack Overflow**: Ask a question with the `sandblox` tag on Stack Overflow.
4. **Email Support**: Contact our support team at support@particle.security for critical issues.

When seeking help, always provide:
- Detailed description of the issue
- Steps to reproduce
- Error messages and logs
- Environment information (OS, browser, Node.js version)
- Code samples demonstrating the issue

---

*Developed by Particle Crypto Security* 