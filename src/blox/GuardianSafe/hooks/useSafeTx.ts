import { useCallback, useEffect, useState } from 'react';
import { Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { SafeTxService, SafePendingTx } from '../lib/safe/SafeTxService';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

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
  autoRefresh?: boolean; // Deprecated - TanStack Query handles all refetching
}

/**
 * Hook for managing Safe pending transactions
 */
export function useSafeTx({
  safeAddress,
  chainId,
  autoRefresh = true // Deprecated - kept for backward compatibility
}: UseSafeTxProps): UseSafeTxReturn {
  const publicClient = usePublicClient();
  const [safeTxService, setSafeTxService] = useState<SafeTxService | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<SafePendingTx[]>([]);
  const [safeInfo, setSafeInfo] = useState<UseSafeTxReturn['safeInfo']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize SafeTxService when dependencies change (guard against StrictMode double-invoke)
  useEffect(() => {
    if (!safeAddress || !chainId || !publicClient) {
      setSafeTxService(null);
      setIsInitialized(false);
      return;
    }
    let didCancel = false;

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
        
        if (didCancel) return;
        setSafeTxService(service);
        setIsInitialized(true);
        
        console.log('✅ SafeTxService initialized successfully');
      } catch (err) {
        console.error('❌ Failed to initialize SafeTxService:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize SafeTxService'));
        setIsInitialized(false);
      } finally {
        if (didCancel) return;
        setIsLoading(false);
      }
    };

    initializeService();
    return () => { didCancel = true; };
  }, [safeAddress, chainId, publicClient]);

  // Fetch pending transactions via TanStack Query
  const { data: queriedPendingTxs } = useQuery({
    enabled: Boolean(isInitialized && safeTxService && safeAddress && chainId),
    queryKey: queryKeys.contract.safe.pendingTxs(chainId || 0, (safeAddress || '').toString()),
    queryFn: async () => {
      return await safeTxService!.getPendingTransactions();
    },
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchInterval: false, // Let TanStack Query handle all refetching via invalidation
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  useEffect(() => {
    if (queriedPendingTxs) setPendingTransactions(queriedPendingTxs);
  }, [queriedPendingTxs]);

  // Fetch Safe info via TanStack Query
  const { data: queriedSafeInfo } = useQuery({
    enabled: Boolean(isInitialized && safeTxService && safeAddress && chainId),
    queryKey: queryKeys.contract.safe.info(chainId || 0, (safeAddress || '').toString()),
    queryFn: async () => {
      return await safeTxService!.getSafeInfo();
    },
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchInterval: false, // Let TanStack Query handle all refetching via invalidation
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  useEffect(() => {
    if (queriedSafeInfo) setSafeInfo(queriedSafeInfo);
  }, [queriedSafeInfo]);

  // Remove manual interval; handled by TanStack Query's refetchInterval

  // Refresh function for manual use
  const refreshPendingTransactions = useCallback(async () => {
    // TanStack Query will refetch on demand via invalidation at call sites if needed
  }, []);

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
