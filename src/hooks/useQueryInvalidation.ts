import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Address } from 'viem';

/**
 * Hook for centralized query cache invalidation after blockchain transactions
 * Provides typed invalidation functions for different transaction types
 */
export function useQueryInvalidation() {
  const queryClient = useQueryClient();

  /**
   * Debug function to log current query cache state
   */
  const debugQueryCache = (chainId: number, contractAddress: Address) => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    console.log('🔍 Current query cache state:');
    queries.forEach(query => {
      const queryKey = query.queryKey;
      if (queryKey.includes(chainId.toString()) && queryKey.includes(contractAddress.toLowerCase())) {
        console.log('📋 Query:', queryKey, 'State:', query.state.status, 'Data:', query.state.data);
      }
    });
  };

  /**
   * Invalidate role-related queries after ownership/broadcaster/recovery changes
   */
  const invalidateRoles = (chainId: number, contractAddress: Address) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.contract.roles(chainId, contractAddress)
    });
  };

  /**
   * Invalidate pending transaction queries after request/approve/cancel operations
   */
  const invalidatePendingTransactions = (chainId: number, contractAddress: Address) => {
    console.log('🔄 Invalidating pending transactions for:', { chainId, contractAddress });
    
    // First invalidate the queries
    queryClient.invalidateQueries({
      queryKey: queryKeys.operations.pendingTxs(chainId, contractAddress)
    });
    
    // Also invalidate Safe-specific pending transactions if applicable
    queryClient.invalidateQueries({
      queryKey: queryKeys.contract.safe.pendingTxs(chainId, contractAddress)
    });
    
    // Force immediate refetch
    queryClient.refetchQueries({
      queryKey: queryKeys.operations.pendingTxs(chainId, contractAddress)
    });
    
    console.log('✅ Pending transactions invalidated and refetched');
  };

  /**
   * Invalidate operation history queries
   */
  const invalidateOperationHistory = (chainId: number, contractAddress: Address) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.operations.history(chainId, contractAddress)
    });
  };

  /**
   * Invalidate operation types queries
   */
  const invalidateOperationTypes = (chainId: number, contractAddress: Address) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.operations.types(chainId, contractAddress)
    });
  };

  /**
   * Invalidate wallet balance queries after token operations
   */
  const invalidateBalances = (walletAddress: Address, tokenAddresses: Address[] = []) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.wallet.balances(walletAddress, tokenAddresses)
    });
  };

  /**
   * Invalidate Safe info queries
   */
  const invalidateSafeInfo = (chainId: number, safeAddress: Address) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.contract.safe.info(chainId, safeAddress)
    });
  };

  /**
   * Comprehensive invalidation for all contract-related queries
   * Use after major contract state changes
   * Always includes operation history since blockchain state changes
   */
  const invalidateAllContractData = (chainId: number, contractAddress: Address) => {
    // Always invalidate operation history for any blockchain state change
    invalidateOperationHistory(chainId, contractAddress);
    
    // Invalidate all contract-related queries
    queryClient.invalidateQueries({
      queryKey: ['contract'],
      predicate: (query) => {
        const queryKey = query.queryKey;
        return queryKey.includes(chainId.toString()) && 
               queryKey.includes(contractAddress.toLowerCase());
      }
    });

    // Invalidate all operations-related queries
    queryClient.invalidateQueries({
      queryKey: ['operations'],
      predicate: (query) => {
        const queryKey = query.queryKey;
        return queryKey.includes(chainId.toString()) && 
               queryKey.includes(contractAddress.toLowerCase());
      }
    });
  };

  /**
   * Invalidate queries based on operation type
   * Smart invalidation that targets specific queries based on what changed
   * Always invalidates operation history since blockchain state changes
   */
  const invalidateByOperationType = (
    chainId: number, 
    contractAddress: Address, 
    operationType: string,
    walletAddress?: Address
  ) => {
    // Always invalidate pending transactions and operation history for any operation
    invalidatePendingTransactions(chainId, contractAddress);
    invalidateOperationHistory(chainId, contractAddress);

    // Invalidate based on specific operation types
    switch (operationType) {
      case 'OWNERSHIP_TRANSFER':
      case 'BROADCASTER_UPDATE':
      case 'RECOVERY_UPDATE':
        // Role changes affect role validation
        invalidateRoles(chainId, contractAddress);
        break;
      
      case 'MINT_TOKENS':
      case 'BURN_TOKENS':
        // Token operations affect balances
        if (walletAddress) {
          invalidateBalances(walletAddress);
        }
        break;
      
      case 'DEPOSIT':
      case 'WITHDRAW':
        // Vault operations affect balances
        if (walletAddress) {
          invalidateBalances(walletAddress);
        }
        break;
      
      case 'EXEC_SAFE_TX':
        // Safe transactions affect Safe info and pending transactions
        invalidateSafeInfo(chainId, contractAddress);
        break;
      
      default:
        // For unknown operations, do comprehensive invalidation
        invalidateAllContractData(chainId, contractAddress);
        break;
    }
  };

  /**
   * Invalidate queries after transaction confirmation
   * Generic function that can be used after any transaction
   * Always invalidates operation history since blockchain state changes
   */
  const invalidateAfterTransaction = (
    chainId: number,
    contractAddress: Address,
    options?: {
      operationType?: string;
      walletAddress?: Address;
      tokenAddresses?: Address[];
      invalidateRoles?: boolean;
      invalidateBalances?: boolean;
    }
  ) => {
    console.log('🚀 Starting transaction invalidation:', { chainId, contractAddress, options });
    
    // Debug current cache state before invalidation
    debugQueryCache(chainId, contractAddress);
    
    const {
      operationType,
      walletAddress,
      tokenAddresses = [],
      invalidateRoles: shouldInvalidateRoles = false,
      invalidateBalances: shouldInvalidateBalances = false
    } = options || {};

    // Always invalidate pending transactions and operation history for any blockchain state change
    console.log('📋 Invalidating pending transactions and operation history...');
    invalidatePendingTransactions(chainId, contractAddress);
    invalidateOperationHistory(chainId, contractAddress);

    // Invalidate roles if specified
    if (shouldInvalidateRoles) {
      console.log('👤 Invalidating roles...');
      invalidateRoles(chainId, contractAddress);
    }

    // Invalidate balances if specified
    if (shouldInvalidateBalances && walletAddress) {
      console.log('💰 Invalidating balances...');
      invalidateBalances(walletAddress, tokenAddresses);
    }

    // Use operation-specific invalidation if operation type is provided
    if (operationType) {
      console.log('🎯 Using operation-specific invalidation for:', operationType);
      invalidateByOperationType(chainId, contractAddress, operationType, walletAddress);
    }
    
    // Debug cache state after invalidation
    setTimeout(() => {
      console.log('🔍 Cache state after invalidation:');
      debugQueryCache(chainId, contractAddress);
    }, 100);
    
    console.log('✅ Transaction invalidation completed');
  };

  return {
    invalidateRoles,
    invalidatePendingTransactions,
    invalidateOperationHistory,
    invalidateOperationTypes,
    invalidateBalances,
    invalidateSafeInfo,
    invalidateAllContractData,
    invalidateByOperationType,
    invalidateAfterTransaction,
    debugQueryCache
  };
}
