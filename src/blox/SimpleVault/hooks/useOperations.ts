import { useState, useCallback, useEffect } from 'react';
import { Address, Hex } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useChain } from '@/hooks/useChain';
import { useWorkflowManager } from '@/hooks/useWorkflowManager';
import { useTransactionManager } from '@/hooks/useTransactionManager';
import { convertBigIntsToStrings } from '@/lib/utils';
import SimpleVault from '../SimpleVault';
import { NotificationMessage } from '../lib/types';
import { VaultTxRecord } from '../lib/operations';
import { createVaultMetaTxParams, getStoredMetaTxSettings } from '../SimpleVault.ui';
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionOptions } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { ContractTransactions } from '@/services/TransactionManager';

// Operation types from operations.ts
export enum VaultOperationType {
  WITHDRAW_ETH = "WITHDRAW_ETH",
  WITHDRAW_TOKEN = "WITHDRAW_TOKEN"
}

interface WithdrawEthParams {
  to: Address;
  amount: bigint;
}

interface WithdrawTokenParams {
  token: Address;
  to: Address;
  amount: bigint;
}

// We need to define a specific type for the transactions object
interface TransactionRecord {
  signedData: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface TransactionStorage {
  [txId: string]: TransactionRecord;
}

interface UseOperationsReturn {
  // Operation request functions
  withdrawEth: (params: WithdrawEthParams) => Promise<void>;
  withdrawToken: (params: WithdrawTokenParams) => Promise<void>;
  
  // Timelock actions
  approveWithdrawal: (txId: number) => Promise<void>;
  cancelWithdrawal: (txId: number) => Promise<void>;
  
  // Meta transaction actions
  signWithdrawalApproval: (txId: number) => Promise<void>;
  signWithdrawalCancellation: (txId: number) => Promise<void>;
  broadcastMetaTx: (txId: number, type: 'approve' | 'cancel') => Promise<void>;
  
  // State tracking
  isLoading: boolean;
  loadingStates: {
    request: Record<string, boolean>;
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
    metaTxSign: Record<string, boolean>;
    metaTxBroadcast: Record<string, boolean>;
  };
  signedMetaTxStates: Record<string, { type: 'approve' | 'cancel' }>;
  error: Error | null;
}

export function useOperations(
  contractAddress: Address,
  onSuccess?: (message: NotificationMessage) => void,
  onError?: (message: NotificationMessage) => void,
  onRefresh?: () => void
): UseOperationsReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  
  // Initialize transaction manager for meta transaction handling
  const { 
    transactions, 
    storeTransaction, 
    removeTransaction,
    error: txManagerError 
  } = useTransactionManager(contractAddress);
  
  // Initialize workflow manager for standardized operation handling
  const { 
    manager, 
    isLoading: workflowLoading,
    canExecutePhase 
  } = useWorkflowManager(contractAddress, 'SimpleVault');
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [signedMetaTxStates, setSignedMetaTxStates] = useState<Record<string, { type: 'approve' | 'cancel' }>>({});
  const [loadingStates, setLoadingStates] = useState<{
    request: Record<string, boolean>;
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
    metaTxSign: Record<string, boolean>;
    metaTxBroadcast: Record<string, boolean>;
  }>({
    request: {},
    approval: {},
    cancellation: {},
    metaTxSign: {},
    metaTxBroadcast: {}
  });

  // Handle transaction manager errors
  useEffect(() => {
    if (txManagerError) {
      setError(txManagerError);
      onError?.({
        type: 'error',
        title: 'Transaction Manager Error',
        description: txManagerError.message
      });
    }
  }, [txManagerError, onError]);

  // Initialize the vault contract instance when needed
  const getVaultInstance = useCallback((): SimpleVault | null => {
    if (!walletClient || !publicClient || !chain || !address) {
      setError(new Error("Vault not initialized or wallet not connected"));
      return null;
    }
    
    try {
      return new SimpleVault(publicClient, walletClient, contractAddress, chain);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to initialize vault"));
      return null;
    }
  }, [walletClient, publicClient, chain, address, contractAddress]);

  // Set loading state for a specific operation type
  const setOperationLoading = useCallback((
    operationType: keyof typeof loadingStates,
    key: string | number,
    isLoading: boolean
  ) => {
    setLoadingStates(prev => ({
      ...prev,
      [operationType]: { ...prev[operationType], [key]: isLoading }
    }));
  }, []);

  // OPERATION REQUEST FUNCTIONS

  // Request ETH withdrawal
  const withdrawEth = useCallback(async (params: WithdrawEthParams): Promise<void> => {
    const operationKey = `eth-${params.to}-${params.amount}`;
    setOperationLoading('request', operationKey, true);
    
    try {
      // First try using the workflow manager if available
      if (manager) {
        await manager.requestOperation(
          VaultOperationType.WITHDRAW_ETH,
          params,
          { from: address as Address }
        );
      } else {
        // Fallback to direct contract call
        const vault = getVaultInstance();
        if (!vault) throw new Error("Vault not initialized");
        
        const tx = await vault.withdrawEthRequest(
          params.to,
          params.amount,
          { from: address as Address }
        );
        
        await tx.wait();
      }
      
      onSuccess?.({
        type: 'success',
        title: 'ETH Withdrawal Requested',
        description: `Successfully requested ETH withdrawal of ${params.amount.toString()} to ${params.to}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to request ETH withdrawal');
      setError(error);
      onError?.({
        type: 'error',
        title: 'ETH Withdrawal Request Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('request', operationKey, false);
    }
  }, [manager, address, getVaultInstance, setOperationLoading, onSuccess, onError, onRefresh]);

  // Request token withdrawal
  const withdrawToken = useCallback(async (params: WithdrawTokenParams): Promise<void> => {
    const operationKey = `token-${params.token}-${params.to}-${params.amount}`;
    setOperationLoading('request', operationKey, true);
    
    try {
      // First try using the workflow manager if available
      if (manager) {
        await manager.requestOperation(
          VaultOperationType.WITHDRAW_TOKEN,
          params,
          { from: address as Address }
        );
      } else {
        // Fallback to direct contract call
        const vault = getVaultInstance();
        if (!vault) throw new Error("Vault not initialized");
        
        const tx = await vault.withdrawTokenRequest(
          params.token,
          params.to,
          params.amount,
          { from: address as Address }
        );
        
        await tx.wait();
      }
      
      onSuccess?.({
        type: 'success',
        title: 'Token Withdrawal Requested',
        description: `Successfully requested token withdrawal of ${params.amount.toString()} to ${params.to}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to request token withdrawal');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Token Withdrawal Request Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('request', operationKey, false);
    }
  }, [manager, address, getVaultInstance, setOperationLoading, onSuccess, onError, onRefresh]);

  // TIMELOCK ACTIONS

  // Approve withdrawal after timelock
  const approveWithdrawal = useCallback(async (txId: number): Promise<void> => {
    setOperationLoading('approval', txId, true);
    
    try {
      // Try using the workflow manager if available
      if (manager) {
        // First determine which operation type this withdrawal is for
        const tx = await manager.approveOperation(
          // Since we may not know the exact operation type, we use a more generic approach
          // Ideally we would get the exact operation type from the transaction data
          // For now we default to WITHDRAW_ETH as a fallback
          VaultOperationType.WITHDRAW_ETH,
          BigInt(txId),
          { from: address as Address }
        );
      } else {
        // Fallback to direct contract call
        const vault = getVaultInstance();
        if (!vault) throw new Error("Vault not initialized");
        
        const tx = await vault.approveWithdrawalAfterDelay(
          txId,
          { from: address as Address }
        );
        
        await tx.wait();
      }
      
      onSuccess?.({
        type: 'success',
        title: 'Withdrawal Approved',
        description: `Successfully approved withdrawal #${txId}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve withdrawal');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Approval Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('approval', txId, false);
    }
  }, [manager, address, getVaultInstance, setOperationLoading, onSuccess, onError, onRefresh]);

  // Cancel withdrawal
  const cancelWithdrawal = useCallback(async (txId: number): Promise<void> => {
    setOperationLoading('cancellation', txId, true);
    
    try {
      // Try using the workflow manager if available
      if (manager) {
        await manager.cancelOperation(
          // Same approach as with approval - using a fallback operation type
          VaultOperationType.WITHDRAW_ETH,
          BigInt(txId),
          { from: address as Address }
        );
      } else {
        // Fallback to direct contract call
        const vault = getVaultInstance();
        if (!vault) throw new Error("Vault not initialized");
        
        const tx = await vault.cancelWithdrawal(
          txId,
          { from: address as Address }
        );
        
        await tx.wait();
      }
      
      onSuccess?.({
        type: 'success',
        title: 'Withdrawal Cancelled',
        description: `Successfully cancelled withdrawal #${txId}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to cancel withdrawal');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Cancellation Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('cancellation', txId, false);
    }
  }, [manager, address, getVaultInstance, setOperationLoading, onSuccess, onError, onRefresh]);

  // META TRANSACTION ACTIONS

  // Prepare and sign a withdrawal approval meta-transaction
  const signWithdrawalApproval = useCallback(async (txId: number): Promise<void> => {
    const txIdStr = txId.toString();
    setOperationLoading('metaTxSign', `${txIdStr}-approve`, true);
    
    try {
      let signedMetaTx: string | undefined;
      
      // Try using the workflow manager if available
      if (manager && address) {
        // Create proper options object
        const options: TransactionOptions = { from: address };
        
        signedMetaTx = await manager.prepareAndSignApproval(
          VaultOperationType.WITHDRAW_ETH, // Using fallback operation type
          BigInt(txId),
          options
        );
      } else {
        // Fallback to direct method
        const vault = getVaultInstance();
        if (!vault || !walletClient) throw new Error("Vault not initialized or wallet not connected");
        
        // Get stored settings and create meta tx params
        const storedSettings = getStoredMetaTxSettings();
        const metaTxParams = createVaultMetaTxParams(storedSettings);
        
        // Generate unsigned meta transaction
        const unsignedMetaTx = await vault.generateUnsignedWithdrawalMetaTxApproval(
          BigInt(txId),
          metaTxParams
        );
        
        // Get the message hash and sign it
        const messageHash = unsignedMetaTx.message;
        const signature = await walletClient.signMessage({
          message: { raw: messageHash as Hex },
          account: address as Address
        });
        
        // Create the complete signed meta transaction
        const signedTx = {
          ...unsignedMetaTx,
          signature
        };
        
        // Convert BigInts to strings for storage
        const serializedTx = convertBigIntsToStrings(signedTx);
        signedMetaTx = JSON.stringify(serializedTx);
      }
      
      if (!signedMetaTx) {
        throw new Error("Failed to generate signed meta transaction");
      }
      
      // Store the signed meta transaction
      storeTransaction(
        txIdStr,
        signedMetaTx,
        {
          type: 'WITHDRAWAL_APPROVAL',
          timestamp: Date.now(),
          action: 'approve',
          broadcasted: false,
          status: 'PENDING'
        }
      );
      
      // Update signed state
      setSignedMetaTxStates(prev => ({
        ...prev,
        [`${txIdStr}-approve`]: { type: 'approve' }
      }));
      
      onSuccess?.({
        type: 'success',
        title: 'Meta Transaction Signed',
        description: `Successfully signed approval for withdrawal #${txId}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign withdrawal approval');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('metaTxSign', `${txIdStr}-approve`, false);
    }
  }, [manager, walletClient, address, getVaultInstance, storeTransaction, setOperationLoading, onSuccess, onError, onRefresh]);

  // Prepare and sign a withdrawal cancellation meta-transaction
  const signWithdrawalCancellation = useCallback(async (txId: number): Promise<void> => {
    const txIdStr = txId.toString();
    setOperationLoading('metaTxSign', `${txIdStr}-cancel`, true);
    
    try {
      let signedMetaTx: string | undefined;
      
      // Try using the workflow manager if available
      if (manager && address) {
        // Create proper options object
        const options: TransactionOptions = { from: address };
        
        signedMetaTx = await manager.prepareAndSignCancellation(
          VaultOperationType.WITHDRAW_ETH, // Using fallback operation type
          BigInt(txId),
          options
        );
      } else {
        // Currently SimpleVault doesn't directly support meta-transaction cancellation
        throw new Error("Meta-transaction cancellation not implemented for SimpleVault");
      }
      
      if (!signedMetaTx) {
        throw new Error("Failed to generate signed meta transaction");
      }
      
      // Store the signed meta transaction
      storeTransaction(
        txIdStr,
        signedMetaTx,
        {
          type: 'WITHDRAWAL_CANCELLATION',
          timestamp: Date.now(),
          action: 'cancel',
          broadcasted: false,
          status: 'PENDING'
        }
      );
      
      // Update signed state
      setSignedMetaTxStates(prev => ({
        ...prev,
        [`${txIdStr}-cancel`]: { type: 'cancel' }
      }));
      
      onSuccess?.({
        type: 'success',
        title: 'Meta Transaction Signed',
        description: `Successfully signed cancellation for withdrawal #${txId}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign withdrawal cancellation');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('metaTxSign', `${txIdStr}-cancel`, false);
    }
  }, [manager, address, getVaultInstance, storeTransaction, setOperationLoading, onSuccess, onError, onRefresh]);

  // Broadcast a signed meta-transaction
  const broadcastMetaTx = useCallback(async (txId: number, type: 'approve' | 'cancel'): Promise<void> => {
    const txIdStr = txId.toString();
    setOperationLoading('metaTxBroadcast', `${txIdStr}-${type}`, true);
    
    try {
      // Safer approach to check for the transaction without direct property access
      let signedMetaTxJson: string | undefined;
      
      // Look through transactions to find the one with the matching ID
      for (const key in transactions) {
        if (key === txIdStr) {
          const tx = transactions[key];
          if (tx && typeof tx === 'object' && 'signedData' in tx) {
            signedMetaTxJson = tx.signedData as string;
            break;
          }
        }
      }
      
      if (!signedMetaTxJson) {
        throw new Error('No signed transaction found');
      }
      
      // Try using the workflow manager if available
      if (manager) {
        await manager.executeMetaTransaction(
          signedMetaTxJson,
          VaultOperationType.WITHDRAW_ETH, // Using fallback operation type
          type,
          { from: address as Address }
        );
      } else {
        // Fallback to direct contract call
        const vault = getVaultInstance();
        if (!vault) throw new Error("Vault not initialized");
        
        if (type === 'approve') {
          const signedMetaTx = JSON.parse(signedMetaTxJson);
          const result = await vault.approveWithdrawalWithMetaTx(
            signedMetaTx,
            { from: address as Address }
          );
          
          await result.wait();
        } else {
          throw new Error("Meta-transaction cancellation not implemented for SimpleVault");
        }
      }
      
      // Remove the transaction from storage
      removeTransaction(txIdStr);
      
      // Remove from signed states
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[`${txIdStr}-${type}`];
        return newState;
      });
      
      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction for withdrawal #${txId}`
      });
      
      onRefresh?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to broadcast meta-transaction');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error.message
      });
      throw error;
    } finally {
      setOperationLoading('metaTxBroadcast', `${txIdStr}-${type}`, false);
    }
  }, [manager, address, getVaultInstance, transactions, removeTransaction, setOperationLoading, onSuccess, onError, onRefresh]);

  // Determine combined loading state
  useEffect(() => {
    const anyLoading = 
      Object.values(loadingStates.request).some(loading => loading) ||
      Object.values(loadingStates.approval).some(loading => loading) ||
      Object.values(loadingStates.cancellation).some(loading => loading) ||
      Object.values(loadingStates.metaTxSign).some(loading => loading) ||
      Object.values(loadingStates.metaTxBroadcast).some(loading => loading) ||
      workflowLoading;
    
    setIsLoading(anyLoading);
  }, [loadingStates, workflowLoading]);

  return {
    // Operation request functions
    withdrawEth,
    withdrawToken,
    
    // Timelock actions
    approveWithdrawal,
    cancelWithdrawal,
    
    // Meta transaction actions
    signWithdrawalApproval,
    signWithdrawalCancellation,
    broadcastMetaTx,
    
    // State tracking
    isLoading,
    loadingStates,
    signedMetaTxStates,
    error
  };
}
