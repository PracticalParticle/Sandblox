import { createContext, useContext, ReactNode } from 'react';
import { TransactionManager } from '../services/TransactionManager';

// Create singleton instance
const transactionManager = new TransactionManager();

// Create context
const TransactionManagerContext = createContext<TransactionManager | null>(null);

// Create provider component
export function TransactionManagerProvider({ children }: { children: ReactNode }) {
  return (
    <TransactionManagerContext.Provider value={transactionManager}>
      {children}
    </TransactionManagerContext.Provider>
  );
}

// Create hook
export function useTransactionManager(): TransactionManager {
  const context = useContext(TransactionManagerContext);
  if (!context) {
    throw new Error('useTransactionManager must be used within a TransactionManagerProvider');
  }
  return context;
} 