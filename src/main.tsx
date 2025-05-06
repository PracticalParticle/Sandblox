import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { CustomWagmiProvider } from './components/providers/CustomWagmiProvider';
import { initializeBloxOperations } from './registrations/BloxOperations';

// Initialize theme
const initializeTheme = () => {
  if (typeof window !== 'undefined') {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.body.classList.toggle('dark', theme === 'dark'); // Ensure body also reflects the theme
  }
};

// Initialize BloxOperations system
const initializeOperations = async () => {
  try {
    console.log('Initializing BloxOperations system...');
    await initializeBloxOperations();
    console.log('BloxOperations system initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize BloxOperations system:', error);
  }
};

// Run initializations
initializeTheme();
initializeOperations();

// Import styles in correct order
import './styles/theme.css';        // Theme variables first
import './styles/globals.css';      // Global styles second
import '@rainbow-me/rainbowkit/styles.css'; // RainbowKit styles third
import './index.css';                // Your app styles last

import App from './App';

// Initialize environment variables with defaults for development

// Custom theme for RainbowKit

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <CustomWagmiProvider>
      <Router>
        <App />
      </Router>
    </CustomWagmiProvider>
  </React.StrictMode>
);
