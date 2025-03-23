import { useState, useEffect, useCallback } from 'react';
import { TransactionManager, ContractTransactions } from '../services/TransactionManager';

// Create a singleton instance
const transactionManager = new TransactionManager();

export interface UseTransactionManagerReturn {
  transactions: ContractTransactions;
  storeTransaction: (txId: string, signedTx: string, metadata?: Record<string, unknown>) => void;
  removeTransaction: (txId: string) => void;
  clearTransactions: () => void;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing transactions for a specific contract
 * @param contractAddress The Ethereum contract address
 */
export function useTransactionManager(contractAddress: string): UseTransactionManagerReturn {
  const [transactions, setTransactions] = useState<ContractTransactions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load transactions on mount and when contract address changes
  useEffect(() => {
    try {
      const txs = transactionManager.getSignedTransactionsByContract(contractAddress);
      setTransactions(txs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load transactions'));
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress]);

  // Memoized functions to prevent unnecessary re-renders
  const storeTransaction = useCallback(
    (txId: string, signedTx: string, metadata?: Record<string, unknown>) => {
      try {
        transactionManager.storeSignedTransaction(contractAddress, txId, signedTx, metadata);
        setTransactions(prev => ({
          ...prev,
          [txId]: {
            signedData: signedTx,
            timestamp: Date.now(),
            metadata
          }
        }));
        setError(null);

        // Dispatch a storage event to notify listeners
        const event = new StorageEvent('storage', {
          key: `transactions-${contractAddress}`,
          newValue: JSON.stringify({}) // The value isn't important, just the key
        });
        window.dispatchEvent(event);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to store transaction'));
      }
    },
    [contractAddress]
  );

  const removeTransaction = useCallback(
    (txId: string) => {
      try {
        transactionManager.removeSignedTransaction(contractAddress, txId);
        setTransactions(prev => {
          const newTransactions = { ...prev };
          delete newTransactions[Number(txId)];
          return newTransactions;
        });
        setError(null);

        // Dispatch a storage event to notify listeners
        const event = new StorageEvent('storage', {
          key: `transactions-${contractAddress}`,
          newValue: JSON.stringify({}) // The value isn't important, just the key
        });
        window.dispatchEvent(event);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to remove transaction'));
      }
    },
    [contractAddress]
  );

  const clearTransactions = useCallback(() => {
    try {
      transactionManager.clearContractTransactions(contractAddress);
      setTransactions({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear transactions'));
    }
  }, [contractAddress]);

  return {
    transactions,
    storeTransaction,
    removeTransaction,
    clearTransactions,
    isLoading,
    error
  };
} 