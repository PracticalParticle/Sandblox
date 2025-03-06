import React, { createContext, useContext, useCallback } from 'react';
import { TransactionManager } from '@/services/TransactionManager';

// Create a singleton instance
const transactionManager = new TransactionManager();

interface TransactionManagerContextType {
  storeTransaction: (txId: string, signedTx: string, metadata?: Record<string, unknown>) => void;
  removeTransaction: (txId: string) => void;
  clearTransactions: () => void;
}

const TransactionManagerContext = createContext<TransactionManagerContextType | null>(null);

export function TransactionManagerProvider({ children }: { children: React.ReactNode }) {
  const storeTransaction = useCallback((txId: string, signedTx: string, metadata?: Record<string, unknown>) => {
    transactionManager.storeSignedTransaction('global', txId, signedTx, metadata);
  }, []);

  const removeTransaction = useCallback((txId: string) => {
    transactionManager.removeSignedTransaction('global', txId);
  }, []);

  const clearTransactions = useCallback(() => {
    transactionManager.clearContractTransactions('global');
  }, []);

  return (
    <TransactionManagerContext.Provider value={{
      storeTransaction,
      removeTransaction,
      clearTransactions,
    }}>
      {children}
    </TransactionManagerContext.Provider>
  );
}

export function useTransactionManager() {
  const context = useContext(TransactionManagerContext);
  if (!context) {
    throw new Error('useTransactionManager must be used within a TransactionManagerProvider');
  }
  return context;
} 