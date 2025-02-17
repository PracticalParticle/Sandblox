/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome115',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'web3-vendor': ['viem', 'wagmi', '@rainbow-me/rainbowkit']
        }
      }
    }
  },
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.alchemyapi.io wss://*.alchemyapi.io https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org",
        "frame-src 'self' https://*.walletconnect.com",
        "worker-src 'self' blob:",
        "font-src 'self' data:"
      ].join('; '),
      'Permissions-Policy': 'interest-cohort=(), serial=()'
    }
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