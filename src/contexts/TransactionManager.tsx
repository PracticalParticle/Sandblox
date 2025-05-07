import { createContext, useContext, ReactNode } from 'react';
import { MetaTransactionManager } from '../services/MetaTransactionManager';

// Create singleton instance
const transactionManager = new MetaTransactionManager();

// Create context
const TransactionManagerContext = createContext<MetaTransactionManager | null>(null);

// Create provider component
export function TransactionManagerProvider({ children }: { children: ReactNode }) {
  return (
    <TransactionManagerContext.Provider value={transactionManager}>
      {children}
    </TransactionManagerContext.Provider>
  );
}

// Create hook
export function useMetaTransactionManager(): MetaTransactionManager {
  const context = useContext(TransactionManagerContext);
  if (!context) {
    throw new Error('useMetaTransactionManager must be used within a TransactionManagerProvider');
  }
  return context;
} 