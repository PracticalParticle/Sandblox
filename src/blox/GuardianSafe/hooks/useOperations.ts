import { useState, useCallback, useEffect, useMemo } from 'react';
import { Address, Hex } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useChain } from '@/hooks/useChain';
import { useMetaTransactionManager } from '@/hooks/useMetaTransactionManager';
import { useOperationHistory } from '@/hooks/useOperationHistory';
import { useOperationTypes } from '@/hooks/useOperationTypes';
import { useQueryInvalidation } from '@/hooks/useQueryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import { convertBigIntsToStrings } from '@/lib/utils';
import { NotificationMessage, SafeTxRecord, EnhancedSafeTx } from '../lib/types';
import { GuardianSafeService } from '../lib/services';
import GuardianSafe, { SafeTx } from '../GuardianSafe';


// Valid operation types for GuardianSafe
export const SAFE_OPERATIONS = {
  EXEC_SAFE_TX: "EXEC_SAFE_TX"
} as const;

export type SafeOperationType = typeof SAFE_OPERATIONS[keyof typeof SAFE_OPERATIONS];

// Type for the transactions record to match MetaTransactionManager
interface TransactionRecord {
  [key: string]: {
    signedData: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  };
}

interface UseOperationsProps {
  contractAddress: Address;
  onSuccess?: (message: NotificationMessage) => void;
  onError?: (message: NotificationMessage) => void;
  onRefresh?: () => void;
}

interface UseOperationsReturn {
  // Transaction Actions
  handleRequestTransaction: (safeTx: SafeTx) => Promise<void>;
  handleApproveTransaction: (txId: number) => Promise<void>;
  handleCancelTransaction: (txId: number) => Promise<void>;
  

  
  // Meta Transaction Actions
  handleMetaTxSign: (tx: SafeTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  handleSinglePhaseMetaTxSign: (safeTx: SafeTx, customId?: string) => Promise<void>;
  handleBroadcastMetaTx: (tx: SafeTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  handleBroadcastSinglePhaseMetaTx: (txId: string) => Promise<void>;
  signedMetaTxStates: Record<string, { type: 'approve' | 'cancel' | 'singlePhase' }>;
  
  // Safe-specific actions
  handleDelegatedCallToggle: (enabled: boolean) => Promise<void>;
  isDelegatedCallEnabled: boolean;
  
  // Loading states
  loadingStates: {
    request: boolean;
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
    metaTx: boolean;
    delegatedCall: boolean;
  };
  
  // Operation filtering
  safeOperations: SafeTxRecord[];
  statusFilter: string | null;
  operationTypeFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  setOperationTypeFilter: (filter: string | null) => void;
  getOperationName: (operationType: Hex) => string;
  operationTypes: Map<Hex, string>;
  isLoading: boolean;

  // Formatting
  formatSafeTxForDisplay: (safeTx: SafeTx) => EnhancedSafeTx;

  // Service instance
  safeService: GuardianSafeService | null;
}

export function useOperations({
  contractAddress,
  onSuccess,
  onError,
  onRefresh
}: UseOperationsProps): UseOperationsReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  const { getOperationType } = useOperationTypes(contractAddress);
  const { invalidateAfterTransaction } = useQueryInvalidation();
  
  // Meta transaction manager
  const { transactions, storeTransaction, error: txManagerError } = useMetaTransactionManager(contractAddress);
  
  // States
  const [safeService, setSafeService] = useState<GuardianSafeService | null>(null);
  const [safe, setSafe] = useState<GuardianSafe | null>(null);
  const [isDelegatedCallEnabled, setIsDelegatedCallEnabled] = useState(false);
  const [signedMetaTxStates, setSignedMetaTxStates] = useState<Record<string, { type: 'approve' | 'cancel' | 'singlePhase' }>>({});

  const [loadingStates, setLoadingStates] = useState<{
    request: boolean;
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
    metaTx: boolean;
    delegatedCall: boolean;
  }>({
    request: false,
    approval: {},
    cancellation: {},
    metaTx: false,
    delegatedCall: false
  });

  // Initialize services (guard against StrictMode double-invoke)
  useEffect(() => {
    if (!publicClient || !chain || !contractAddress) return;
    let didCancel = false;
    
    const initializeServices = async () => {
      try {
        const newSafe = new GuardianSafe(
          publicClient, 
          walletClient || undefined, 
          contractAddress, 
          chain
        );
        if (didCancel) return;
        setSafe(newSafe);

        const newService = new GuardianSafeService(
          publicClient,
          walletClient || undefined,
          contractAddress,
          chain
        );
        if (didCancel) return;
        setSafeService(newService);
        
        // Fetch delegated call status
        const delegatedCallEnabled = await newService.isDelegatedCallEnabled();
        if (didCancel) return;
        setIsDelegatedCallEnabled(delegatedCallEnabled);
      } catch (error) {
        console.error('Failed to initialize services:', error);
        onError?.({
          type: 'error',
          title: 'Initialization Failed',
          description: error instanceof Error ? error.message : 'Failed to initialize services'
        });
      } finally {
        if (didCancel) return;
      }
    };

    initializeServices();
    return () => {
      didCancel = true;
    };
  }, [publicClient, walletClient, contractAddress, chain, onError]);

  // Fetch operations using TanStack Query
  const { data: operations = [], isLoading: isLoadingOperations, error: operationsError, refetch: refetchOperations } = useQuery({
    queryKey: queryKeys.operations.pendingTxs(chain?.id || 0, contractAddress),
    queryFn: async () => {
      if (!safeService) {
        return [];
      }
      console.log("🔄 GuardianSafe: Fetching operation history...");
      const txs = await safeService.getPendingTransactions();
      console.log("✅ GuardianSafe: Fetched operations:", txs.length);
      return txs;
    },
    enabled: !!safeService && !!chain,
    refetchInterval: false, // Disable automatic refetch to avoid conflicts
    refetchIntervalInBackground: false,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Handle operations error
  useEffect(() => {
    if (operationsError) {
      onError?.({
        type: 'error',
        title: 'Operations Fetch Failed',
        description: operationsError.message
      });
    }
  }, [operationsError, onError]);

  // Add error handling for transaction manager
  useEffect(() => {
    if (txManagerError) {
      onError?.({
        type: 'error',
        title: 'Transaction Manager Error',
        description: txManagerError.message
      });
    }
  }, [txManagerError, onError]);

  // Refresh operations callback for manual refresh
  const refreshOperations = useCallback(() => {
    refetchOperations();
    onRefresh?.();
  }, [refetchOperations, onRefresh]);

  // Resolve GuardianSafe EXEC_SAFE_TX operation type (Hex) when available
  const execSafeOperationType: Hex | null = useMemo(() => {
    try {
      const op = getOperationType?.(SAFE_OPERATIONS.EXEC_SAFE_TX);
      return op ?? null;
    } catch {
      return null;
    }
  }, [getOperationType]);

  // Operation History hooks for filtering
  const {
    filteredOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    getOperationName,
    operationTypes,
    loadingTypes
  } = useOperationHistory({
    contractAddress,
    operations,
    isLoading: isLoadingOperations
  });

  // Filter for safe-specific operations
  const safeOperations = useMemo(() => {
    return filteredOperations.filter(op => {
      const operationType = getOperationName(op.params.operationType as Hex);
      return Object.values(SAFE_OPERATIONS).includes(operationType as SafeOperationType);
    }) as SafeTxRecord[];
  }, [filteredOperations, getOperationName]);

  // Filter operation types to only show safe operations
  const safeOperationTypes = useMemo(() => {
    const filteredTypes = new Map<Hex, string>();
    operationTypes.forEach((value, key) => {
      if (Object.values(SAFE_OPERATIONS).includes(value as SafeOperationType)) {
        filteredTypes.set(key, value);
      }
    });
    return filteredTypes;
  }, [operationTypes]);

  // DELEGATED CALL TOGGLE
  const handleDelegatedCallToggle = useCallback(async (enabled: boolean) => {
    if (!safeService || !address) {
      throw new Error("Services not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({ ...prev, delegatedCall: true }));

    try {
      const tx = await safeService.setDelegatedCallEnabled(enabled, { from: address });
      await tx.wait();

      // Update local state
      setIsDelegatedCallEnabled(enabled);

      onSuccess?.({
        type: 'success',
        title: 'Delegated Call Setting Updated',
        description: `Delegated calls are now ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error: any) {
      console.error('Delegated call toggle error:', error);
      onError?.({
        type: 'error',
        title: 'Setting Update Failed',
        description: error.message || 'Failed to update delegated call setting'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, delegatedCall: false }));
    }
  }, [safeService, address, onSuccess, onError]);

  // STANDARD TRANSACTION FUNCTIONS
  // Handle requesting a new transaction
  const handleRequestTransaction = useCallback(async (safeTx: SafeTx): Promise<void> => {
    if (!safeService || !address) {
      throw new Error("Services not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({ ...prev, request: true }));

    try {
      // Check if this is a delegated call and if it's enabled
      if (safeTx.operation === 1 && !isDelegatedCallEnabled) {
        throw new Error("Delegated calls are not enabled");
      }

      const tx = await safeService.requestTransaction(safeTx, { from: address });
      await tx.wait();

      onSuccess?.({
        type: 'success',
        title: 'Transaction Requested',
        description: `Successfully requested Safe transaction to ${safeTx.to}`
      });

      // Wait a bit for blockchain state to propagate before invalidating
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Invalidate query cache to trigger automatic refresh
      if (chain?.id) {
        invalidateAfterTransaction(chain.id, contractAddress, {
          operationType: 'EXEC_SAFE_TX',
          walletAddress: address
        });
      }
    } catch (error: any) {
      console.error('Transaction request error:', error);
      onError?.({
        type: 'error',
        title: 'Request Failed',
        description: error.message || 'Failed to request transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, request: false }));
    }
  }, [safeService, address, isDelegatedCallEnabled, refreshOperations, onSuccess, onError, chain?.id, contractAddress, invalidateAfterTransaction]);

  // Handle approving a transaction after timelock
  const handleApproveTransaction = useCallback(async (txId: number): Promise<void> => {
    if (!safeService || !address) {
      throw new Error("Services not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({
      ...prev,
      approval: { ...prev.approval, [txId]: true }
    }));

    try {
      const tx = await safeService.approveTransactionAfterDelay(txId, { from: address });
      await tx.wait();

      onSuccess?.({
        type: 'success',
        title: 'Transaction Approved',
        description: `Successfully approved transaction #${txId}`
      });

      // Wait a bit for blockchain state to propagate before invalidating
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Invalidate query cache to trigger automatic refresh
      if (chain?.id) {
        invalidateAfterTransaction(chain.id, contractAddress, {
          operationType: 'EXEC_SAFE_TX',
          walletAddress: address
        });
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      onError?.({
        type: 'error',
        title: 'Approval Failed',
        description: error.message || 'Failed to approve transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        approval: { ...prev.approval, [txId]: false }
      }));
    }
  }, [safeService, address, refreshOperations, onSuccess, onError, chain?.id, contractAddress, invalidateAfterTransaction]);

  // Handle canceling a transaction
  const handleCancelTransaction = useCallback(async (txId: number): Promise<void> => {
    if (!safeService || !address) {
      throw new Error("Services not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({
      ...prev,
      cancellation: { ...prev.cancellation, [txId]: true }
    }));

    try {
      const tx = await safeService.cancelTransaction(txId, { from: address });
      await tx.wait();

      onSuccess?.({
        type: 'success',
        title: 'Transaction Cancelled',
        description: `Successfully cancelled transaction #${txId}`
      });

      // Wait a bit for blockchain state to propagate before invalidating
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Invalidate query cache to trigger automatic refresh
      if (chain?.id) {
        invalidateAfterTransaction(chain.id, contractAddress, {
          operationType: 'EXEC_SAFE_TX',
          walletAddress: address
        });
      }
    } catch (error: any) {
      console.error('Cancellation error:', error);
      onError?.({
        type: 'error',
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        cancellation: { ...prev.cancellation, [txId]: false }
      }));
    }
  }, [safeService, address, refreshOperations, onSuccess, onError, chain?.id, contractAddress, invalidateAfterTransaction]);

  // META TRANSACTION FUNCTIONS
  // Handle meta transaction signing for existing transactions
  const handleMetaTxSign = useCallback(async (tx: SafeTxRecord, type: 'approve' | 'cancel') => {
    try {
      if (!safeService || !address) {
        throw new Error("Services not initialized or wallet not connected");
      }

      setLoadingStates(prev => ({ ...prev, metaTx: true }));

      // Generate signed meta transaction based on type
      let signedTxString;
      if (type === 'approve') {
        signedTxString = await safeService.generateSignedApproveMetaTx(Number(tx.txId), { from: address });
      } else {
        signedTxString = await safeService.generateSignedCancelMetaTx(Number(tx.txId), { from: address });
      }
      
      const txId = tx.txId.toString();
      const signatureKey = `${txId}-${type}`;

      // Store the signed transaction
      storeTransaction(
        txId,
        signedTxString,
        {
          // GuardianSafe meta: always EXEC_SAFE_TX for safe operations
          type: SAFE_OPERATIONS.EXEC_SAFE_TX,
          operationType: (execSafeOperationType as unknown as string) || undefined,
          timestamp: Date.now(),
          action: type,
          broadcasted: false,
          status: 'PENDING'
        }
      );

      // Update signed state
      setSignedMetaTxStates(prev => ({
        ...prev,
        [signatureKey]: { type }
      }));

      // Force refresh by dispatching a storage event
      const event = new StorageEvent('storage', {
        key: `transactions-${contractAddress}`,
        newValue: JSON.stringify({})
      });
      window.dispatchEvent(event);

      onSuccess?.({
        type: 'success',
        title: 'Meta Transaction Signed',
        description: `Successfully signed ${type} meta-transaction for transaction #${txId}`
      });
    } catch (error) {
      console.error('Failed to sign meta transaction:', error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, metaTx: false }));
    }
  }, [safeService, address, contractAddress, storeTransaction, onSuccess, onError, execSafeOperationType]);

  // Handle meta transaction signing for new transactions (single-phase)
  const handleSinglePhaseMetaTxSign = useCallback(async (safeTx: SafeTx, customId?: string) => {
    try {
      if (!safeService || !address) {
        throw new Error("Services not initialized or wallet not connected");
      }

      setLoadingStates(prev => ({ ...prev, metaTx: true }));

      // Check if this is a delegated call and if it's enabled
      if (safeTx.operation === 1 && !isDelegatedCallEnabled) {
        throw new Error("Delegated calls are not enabled");
      }

      // Generate signed meta transaction for a new transaction
      const signedTxString = await safeService.generateSignedNewTransactionMetaTx(safeTx, { from: address });
      
      // Generate a temporary ID for the transaction
      // For Safe pending transactions, we can use a custom ID, otherwise use timestamp
      const tempId = customId || `temp_${Date.now()}`;

      // Store the signed transaction
      storeTransaction(
        tempId,
        signedTxString,
        {
          // GuardianSafe meta: always EXEC_SAFE_TX for safe operations
          type: SAFE_OPERATIONS.EXEC_SAFE_TX,
          operationType: (execSafeOperationType as unknown as string) || undefined,
          timestamp: Date.now(),
          action: 'singlePhase',
          broadcasted: false,
          status: 'PENDING',
          safeTx: convertBigIntsToStrings(safeTx) // Store the original safeTx for reference
        }
      );

      // Update signed state
      setSignedMetaTxStates(prev => ({
        ...prev,
        [tempId]: { type: 'singlePhase' }
      }));

      // Force refresh by dispatching a storage event
      const event = new StorageEvent('storage', {
        key: `transactions-${contractAddress}`,
        newValue: JSON.stringify({})
      });
      window.dispatchEvent(event);

      onSuccess?.({
        type: 'success',
        title: 'Meta Transaction Signed',
        description: `Successfully signed meta-transaction for new Safe transaction`
      });
    } catch (error) {
      console.error('Failed to sign single-phase meta transaction:', error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, metaTx: false }));
    }
  }, [safeService, address, isDelegatedCallEnabled, contractAddress, storeTransaction, onSuccess, onError, execSafeOperationType]);

  // Handle meta transaction broadcasting for existing transactions
  const handleBroadcastMetaTx = useCallback(async (tx: SafeTxRecord, type: 'approve' | 'cancel') => {
    if (!walletClient || !safe || !address) {
      throw new Error('Wallet not connected or services not initialized');
    }

    setLoadingStates(prev => ({ ...prev, metaTx: true }));

    try {
      const txId = tx.txId.toString();
      const signatureKey = `${txId}-${type}`;
      const storedTx = (transactions as TransactionRecord)[txId];
      
      if (!storedTx) {
        throw new Error('No signed transaction found');
      }

      // Parse the signed transaction data
      const signedMetaTx = JSON.parse(storedTx.signedData);

      // Broadcast the meta transaction based on type
      let result;
      if (type === 'approve') {
        result = await safe.approveTransactionWithMetaTx(
          signedMetaTx,
          { from: address }
        );
      } else {
        result = await safe.cancelTransactionWithMetaTx(
          signedMetaTx,
          { from: address }
        );
      }

      await result.wait();
      
      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction for #${txId}`
      });

      // Clear the signed state and refresh transactions
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[signatureKey];
        return newState;
      });
      
      // Remove the transaction from storage
      storeTransaction(txId, '', { remove: true });
      
      // Wait a bit for blockchain state to propagate before invalidating
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh operations list
      refreshOperations();
      
      // Invalidate query cache to trigger automatic refresh
      if (chain?.id) {
        invalidateAfterTransaction(chain.id, contractAddress, {
          operationType: 'EXEC_SAFE_TX',
          walletAddress: address
        });
      }
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      onError?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, metaTx: false }));
    }
  }, [safe, walletClient, address, transactions, refreshOperations, onSuccess, onError, storeTransaction, chain?.id, contractAddress, invalidateAfterTransaction]);

  // Handle broadcasting single-phase meta transactions
  const handleBroadcastSinglePhaseMetaTx = useCallback(async (txId: string) => {
    if (!walletClient || !safe || !address) {
      throw new Error('Wallet not connected or services not initialized');
    }

    setLoadingStates(prev => ({ ...prev, metaTx: true }));

    try {
      const storedTx = (transactions as TransactionRecord)[txId];
      
      if (!storedTx) {
        throw new Error('No signed transaction found');
      }

      // Parse the signed transaction data
      const signedMetaTx = JSON.parse(storedTx.signedData);

      // Broadcast the single-phase meta transaction
      const result = await safe.requestAndApproveTransactionWithMetaTx(
        signedMetaTx,
        { from: address }
      );

      await result.wait();
      
      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: 'Successfully broadcasted single-phase transaction'
      });

      // Clear the signed state
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[txId];
        return newState;
      });
      
      // Remove the transaction from storage
      storeTransaction(txId, '', { remove: true });
      
      // Wait a bit for blockchain state to propagate before invalidating
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh operations list
      refreshOperations();
      
      // Invalidate query cache to trigger automatic refresh
      if (chain?.id) {
        invalidateAfterTransaction(chain.id, contractAddress, {
          operationType: 'EXEC_SAFE_TX',
          walletAddress: address
        });
      }
    } catch (error) {
      console.error('Failed to broadcast single-phase transaction:', error);
      onError?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, metaTx: false }));
    }
  }, [safe, walletClient, address, transactions, refreshOperations, onSuccess, onError, storeTransaction, chain?.id, contractAddress, invalidateAfterTransaction]);

  // Format a SafeTx for display
  const formatSafeTxForDisplay = useCallback((safeTx: SafeTx): EnhancedSafeTx => {
    if (!safeService) {
      return {
        ...safeTx,
        description: "Unknown transaction"
      };
    }
    return safeService.formatSafeTxForDisplay(safeTx);
  }, [safeService]);

  // Fix the type mismatch by creating wrapper functions
  const setStatusFilterWrapper = useCallback((filter: string | null) => {
    // Pass empty string when null is provided to match the expected type
    setStatusFilter(filter === null ? "" : filter);
  }, [setStatusFilter]);

  const setOperationTypeFilterWrapper = useCallback((filter: string | null) => {
    // Pass empty string when null is provided to match the expected type
    setOperationTypeFilter(filter === null ? "" : filter);
  }, [setOperationTypeFilter]);



  return {
    // Transaction actions
    handleRequestTransaction,
    handleApproveTransaction,
    handleCancelTransaction,
    

    
    // Meta transaction actions
    handleMetaTxSign,
    handleSinglePhaseMetaTxSign,
    handleBroadcastMetaTx,
    handleBroadcastSinglePhaseMetaTx,
    signedMetaTxStates,
    
    // Safe-specific actions
    handleDelegatedCallToggle,
    isDelegatedCallEnabled,
    
    // Loading states
    loadingStates,
    
    // Operation filtering
    safeOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter: setStatusFilterWrapper,
    setOperationTypeFilter: setOperationTypeFilterWrapper,
    getOperationName,
    operationTypes: safeOperationTypes,
    isLoading: isLoadingOperations || loadingTypes,

    // Formatting
    formatSafeTxForDisplay,

    // Service instance
    safeService
  };
}
