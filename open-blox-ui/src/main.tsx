import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomWagmiProvider } from './components/providers/CustomWagmiProvider';

// Import styles in the correct order
import './styles/theme.css';        // Theme variables first
import './styles/globals.css';      // Global styles second
import '@rainbow-me/rainbowkit/styles.css'; // RainbowKit styles third
import './index.css';               // Your custom styles last

import App from './App';

// Initialize environment variables with defaults for development


const queryClient = new QueryClient();

// Custom theme for RainbowKit

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CustomWagmiProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </Router>
      </CustomWagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>
); 