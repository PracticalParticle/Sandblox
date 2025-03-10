/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks')
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    modulePreload: {
      polyfill: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'web3-vendor': ['@rainbow-me/rainbowkit', 'wagmi', 'viem'],
          'ui-vendor': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
        format: 'es',
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
      },
      external: [/particle-core\/.*/]
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
    middlewareMode: false,
    cors: true,
    proxy: {
      '/local-node': {
        target: 'http://127.0.0.1:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-node/, '')
      }
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/javascript',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://rsms.me; connect-src 'self' http://127.0.0.1:8545/ ws://127.0.0.1:8545/ http://localhost:8545/ ws://localhost:8545/ http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:* https://*.walletconnect.org wss://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.com https://explorer-api.walletconnect.com https://remote-ganache-1.tailb0865.ts.net https://*.merkle.io; font-src 'self' data: https://fonts.googleapis.com https://rsms.me; img-src 'self' data: https: blob:; media-src 'self' blob:; worker-src 'self' blob:; frame-src 'self' https://*.walletconnect.org https://*.walletconnect.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
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