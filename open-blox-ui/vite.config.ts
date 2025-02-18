/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'web3-vendor': ['@rainbow-me/rainbowkit', 'wagmi', 'viem'],
          'ui-vendor': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: true,
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' https://rsms.me;
        font-src 'self' data: https://rsms.me;
        img-src 'self' data: https:;
        connect-src 'self' 
          https://*.alchemyapi.io 
          wss://*.alchemyapi.io 
          https://*.walletconnect.com 
          wss://*.walletconnect.com
          https://eth-mainnet.g.alchemy.com
          https://eth-sepolia.g.alchemy.com;
      `.replace(/\s+/g, ' ').trim()
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ]
    }
  }
}); 