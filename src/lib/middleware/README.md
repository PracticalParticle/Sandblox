# Middleware Components

## Solidity Middleware

The Solidity middleware is responsible for serving Solidity contract files during development. It allows the frontend to fetch Solidity source code directly from the filesystem.

### Usage

The middleware is automatically configured through the Vite plugin system. It handles any requests that start with `/contracts/` and serves the corresponding Solidity files from your project's root directory.

### Security Considerations

- The middleware only serves files during development
- Files are served with `text/plain` content type
- Only files under the `/contracts/` path are accessible
- Error handling is in place for missing or inaccessible files

### Example

```typescript
// The middleware will handle requests like:
fetch('/contracts/core/library/MultiPhaseSecureOperation.sol')
```

### Configuration

The middleware is configured through the Vite plugin in `src/lib/vite/solidity-plugin.ts`. If you need to modify the behavior, such as changing the base path or adding additional security measures, update the middleware configuration in `src/lib/middleware/solidity.ts`. 