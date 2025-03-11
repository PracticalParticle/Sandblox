# BloxTemplate

A template for creating new blox implementations using Particle's Account Abstraction technology.

## Overview

This template demonstrates how to create a new blox for the SandBlox platform. It includes:

- Smart contract with Particle's Account Abstraction integration
- React components for UI
- Custom hooks for blockchain interactions
- Utility functions for common tasks
- Configuration files for deployment

## File Structure

```
BloxTemplate/
├── BloxTemplate.sol            # Smart contract implementation
├── BloxTemplate.tsx            # Main React component
├── BloxTemplate.ui.tsx         # UI components
├── BloxTemplate.blox.json      # Blox metadata
├── BloxTemplate.abi.json       # Contract ABI
├── BloxTemplate.md             # Blox Inforamtion
```

## Getting Started

### 1. Rename the Template

To create a new blox based on this template:

1. Copy the entire BloxTemplate folder
2. Rename the folder to your blox name (e.g., `CustomVault`)
3. Rename all files to match your blox name:
   - `BloxTemplate.sol` → `CustomVault.sol`
   - `BloxTemplate.tsx` → `CustomVault.tsx`
   - `BloxTemplate.ui.tsx` → `CustomVault.ui.tsx`
   - `BloxTemplate.blox.json` → `CustomVault.blox.json`
   - `BloxTemplate.abi.json` → `CustomVault.abi.json`
   - `BloxTemplate.md` → `CustomVault.md`

### 2. Update the Smart Contract

Modify `CustomVault.sol` to implement your desired functionality:

1. Update the contract name and comments
2. Add your custom state variables
3. Implement your contract's functions
4. Define events for important state changes
5. Override necessary functions from the ParticleAccountAbstraction contract

### 3. Configure the Blox

Update `CustomVault.blox.json` with your blox's metadata:

1. Set a unique ID for your blox
2. Provide a name and description
3. Specify the category and security level
4. List the features and requirements
5. Update the libraries section with any additional libraries used

### 4. Implement the UI

Customize the UI components in `CustomVault.ui.tsx`:

1. Update the component to match your contract's functionality
2. Add any additional UI elements needed
3. Ensure the UI reflects your contract's state and operations

### 5. Connect the Logic

Update the main component in `CustomVault.tsx`:

1. Import your custom components and hooks
2. Implement state management for your contract's variables
3. Create functions for contract interactions
4. Connect the UI to your contract functions

## Security Considerations

When creating a blox with Particle's Account Abstraction:

1. Ensure proper use of the role-based security model
2. Implement time-delayed operations for critical functions
3. Provide clear feedback to users about operation status
4. Support meta-transactions for gasless operations
5. Consider recovery mechanisms for user accounts

## Testing

Before deploying your blox:

1. Test all contract functions in a local environment
2. Verify that the UI correctly reflects contract state
3. Test role-based permissions and time-locked operations
4. Ensure proper error handling throughout the application
5. Verify that events are properly captured and displayed

## Deployment

To deploy your blox:

1. Configure deployment parameters for your contract
2. Deploy the contract to your desired network
3. Update the ABI file with the compiled contract ABI
4. Test the deployed contract with your UI

## Contributing

If you improve this template or create a new blox based on it, consider sharing it with the community by submitting a pull request to the SandBlox repository.

## License

This template is licensed under the Mozilla Public License 2.0. 