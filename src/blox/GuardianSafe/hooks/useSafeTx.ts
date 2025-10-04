import { useCallback, useEffect, useState } from 'react';
import { Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { SafeTxService, SafePendingTx } from '../lib/safe/SafeTxService';

export interface UseSafeTxReturn {
  // Data
  pendingTransactions: SafePendingTx[];
  safeInfo: {
    address: Address | null;
    owners: Address[];
    threshold: number;
    nonce: number;
    version: string;
  } | null;
  
  // State
  isLoading: boolean;
  error: Error | null;
  isInitialized: boolean;
  
  // Actions
  refreshPendingTransactions: () => Promise<void>;
  getTransactionDetails: (safeTxHash: string) => Promise<SafePendingTx | null>;
  isOwner: (address: Address) => Promise<boolean>;
  
  // Service instance
  safeTxService: SafeTxService | null;
}

export interface UseSafeTxProps {
  safeAddress?: Address;
  chainId?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

/**
 * Hook for managing Safe pending transactions
 */
export function useSafeTx({
  safeAddress,
  chainId,
  autoRefresh = true,
  refreshInterval = 60000 // 60 seconds default
}: UseSafeTxProps): UseSafeTxReturn {
  const publicClient = usePublicClient();
  const [safeTxService, setSafeTxService] = useState<SafeTxService | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<SafePendingTx[]>([]);
  const [safeInfo, setSafeInfo] = useState<UseSafeTxReturn['safeInfo']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize SafeTxService when dependencies change
  useEffect(() => {
    if (!safeAddress || !chainId || !publicClient) {
      setSafeTxService(null);
      setIsInitialized(false);
      return;
    }

    const initializeService = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const service = new SafeTxService(
          {
            safeAddress,
            chainId
          },
          publicClient
        );

        // Initialize the service
        await service.init();
        
        setSafeTxService(service);
        setIsInitialized(true);
        
        console.log('✅ SafeTxService initialized successfully');
      } catch (err) {
        console.error('❌ Failed to initialize SafeTxService:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize SafeTxService'));
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeService();
  }, [safeAddress, chainId, publicClient]);

  // Fetch pending transactions
  const fetchPendingTransactions = useCallback(async () => {
    if (!safeTxService || !isInitialized) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const transactions = await safeTxService.getPendingTransactions();
      setPendingTransactions(transactions);
      
      console.log(`📋 Fetched ${transactions.length} pending transactions`);
    } catch (err) {
      console.error('❌ Failed to fetch pending transactions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch pending transactions'));
    } finally {
      setIsLoading(false);
    }
  }, [safeTxService, isInitialized]);

  // Fetch Safe info
  const fetchSafeInfo = useCallback(async () => {
    if (!safeTxService || !isInitialized) {
      return;
    }

    try {
      const info = await safeTxService.getSafeInfo();
      setSafeInfo(info);
      
      console.log('📋 Fetched Safe info:', info);
    } catch (err) {
      console.error('❌ Failed to fetch Safe info:', err);
      // Don't set error for Safe info as it's not critical
    }
  }, [safeTxService, isInitialized]);

  // Initial data fetch
  useEffect(() => {
    if (isInitialized) {
      fetchPendingTransactions();
      fetchSafeInfo();
    }
  }, [isInitialized, fetchPendingTransactions, fetchSafeInfo]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !isInitialized || !safeTxService) {
      return;
    }

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing Safe pending transactions...');
      fetchPendingTransactions();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, isInitialized, safeTxService, refreshInterval, fetchPendingTransactions]);

  // Refresh function for manual use
  const refreshPendingTransactions = useCallback(async () => {
    await fetchPendingTransactions();
  }, [fetchPendingTransactions]);

  // Get transaction details
  const getTransactionDetails = useCallback(async (safeTxHash: string): Promise<SafePendingTx | null> => {
    if (!safeTxService || !isInitialized) {
      throw new Error('SafeTxService not initialized');
    }

    try {
      return await safeTxService.getTransactionDetails(safeTxHash);
    } catch (err) {
      console.error('Failed to get transaction details:', err);
      throw err;
    }
  }, [safeTxService, isInitialized]);

  // Check if address is owner
  const isOwner = useCallback(async (address: Address): Promise<boolean> => {
    if (!safeTxService || !isInitialized) {
      throw new Error('SafeTxService not initialized');
    }

    try {
      return await safeTxService.isOwner(address);
    } catch (err) {
      console.error('Failed to check if address is owner:', err);
      throw err;
    }
  }, [safeTxService, isInitialized]);

  return {
    // Data
    pendingTransactions,
    safeInfo,
    
    // State
    isLoading,
    error,
    isInitialized,
    
    // Actions
    refreshPendingTransactions,
    getTransactionDetails,
    isOwner,
    
    // Service instance
    safeTxService
  };
}

/**
 * Hook for getting Safe owners specifically
 */
export function useSafeOwners(safeAddress?: Address, chainId?: number) {
  const { safeInfo, isLoading, error, isInitialized } = useSafeTx({
    safeAddress,
    chainId,
    autoRefresh: false // Don't auto-refresh for owners
  });

  return {
    owners: safeInfo?.owners || [],
    threshold: safeInfo?.threshold || 0,
    nonce: safeInfo?.nonce || 0,
    version: safeInfo?.version || '',
    isLoading,
    error,
    isInitialized
  };
}
