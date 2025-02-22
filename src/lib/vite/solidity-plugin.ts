import type { Plugin } from 'vite';
import { createSolidityMiddleware } from '../middleware/solidity';

export function solidityPlugin(): Plugin {
  return {
    name: 'serve-solidity-files',
    configureServer(server) {
      server.middlewares.use(createSolidityMiddleware());
    }
  };
} 