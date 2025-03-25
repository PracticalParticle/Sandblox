import { useState, useCallback, useEffect } from 'react';
import { Address, Hex } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import SimpleVault from '../SimpleVault';
import { useChain } from '@/hooks/useChain';
import { useTransactionManager } from '@/hooks/useTransactionManager';
import { convertBigIntsToStrings } from '@/lib/utils';
import { NotificationMessage } from '../lib/types';
import { VaultTxRecord } from '../components/PendingTransaction';
import { createVaultMetaTxParams, getStoredMetaTxSettings } from '../SimpleVault.ui';
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';

interface UseMetaTxActionsReturn {
  handleMetaTxSign: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  handleBroadcastMetaTx: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  signedMetaTxStates: Record<string, { type: 'approve' | 'cancel' }>;
  isLoading: boolean;
  error: Error | null;
}

// Type for the transactions record to match TransactionManager
interface TransactionRecord {
  [key: string]: {
    signedData: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  };
}

export function useMetaTxActions(
  contractAddress: Address,
  onSuccess?: (message: NotificationMessage) => void,
  onError?: (message: NotificationMessage) => void,
  onRefresh?: () => void
): UseMetaTxActionsReturn {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  const { transactions, storeTransaction, error: txManagerError } = useTransactionManager(contractAddress);
  const [signedMetaTxStates, setSignedMetaTxStates] = useState<Record<string, { type: 'approve' | 'cancel' }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  const signWithdrawalApproval = useCallback(async (txId: string): Promise<MetaTransaction> => {
    if (!walletClient || !publicClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get chain from wallet client
      const chain = walletClient.chain;
      if (!chain) throw new Error('Chain not found');

      // Create vault instance
      const vault = new SimpleVault(publicClient, walletClient, contractAddress, chain);

      // Get stored settings and create meta tx params
      const storedSettings = getStoredMetaTxSettings();
      const metaTxParams = createVaultMetaTxParams(storedSettings);

      console.log('Using meta tx params:', {
        storedSettings,
        metaTxParams
      });

      // Generate unsigned meta transaction
      const unsignedMetaTx = await vault.generateUnsignedWithdrawalMetaTxApproval(
        BigInt(txId),
        metaTxParams
      );

      // Get the signer's address
      const [address] = await walletClient.getAddresses();
      console.log('unsignedMetaTx', unsignedMetaTx);
      // Get the message hash and sign it
      const messageHash = unsignedMetaTx.message;
      console.log('messageHash', messageHash);
       // Sign the message hash from the meta transaction
      const signature = await walletClient.signMessage({
        message: { raw: messageHash as Hex },
        account: address
      });
      unsignedMetaTx.signature=signature as Hex;    
      // Return the signed meta transaction with the correct structure
      return {
        ...unsignedMetaTx, // Spread the properties of unsignedMetaTx
        signature: unsignedMetaTx.signature // Ensure signature is included
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign meta transaction');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, publicClient, walletClient]);

  const handleMetaTxSign = useCallback(async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    try {
      if (type === 'approve') {
        console.log('Starting meta transaction signing for txId:', tx.txId);
        
        const signedTx = await signWithdrawalApproval(tx.txId.toString());
        console.log('Received signed transaction:', signedTx);
        
        // Convert all BigInt values to strings recursively
        const serializedTx = convertBigIntsToStrings(signedTx);
        console.log('Serialized transaction:', serializedTx);

        // Store using string transaction ID
        const txId = tx.txId.toString();
        console.log('Storing with ID:', txId);

        storeTransaction(
          txId,
          JSON.stringify(serializedTx),
          {
            type: 'WITHDRAWAL_APPROVAL',
            timestamp: Date.now(),
            action: type,
            broadcasted: false,
            status: 'PENDING'
          }
        );

        // Verify storage immediately after storing
        console.log('Stored transactions:', transactions);
        
        // Update signed state
        setSignedMetaTxStates(prev => ({
          ...prev,
          [`${txId}-${type}`]: { type }
        }));

        // Force refresh by dispatching a storage event that our listener will pick up
        const event = new StorageEvent('storage', {
          key: `transactions-${contractAddress}`,
          newValue: JSON.stringify({}) // The actual value isn't important, just the key
        });
        window.dispatchEvent(event);

        onSuccess?.({
          type: 'success',
          title: 'Meta Transaction Signed',
          description: `Successfully signed approval for transaction #${txId}`
        });
      }
    } catch (error) {
      console.error('Failed to sign meta transaction:', error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
      });
      throw error;
    }
  }, [signWithdrawalApproval, transactions, storeTransaction, onSuccess, onError]);

  const handleBroadcastMetaTx = useCallback(async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    if (!walletClient || !publicClient || !chain) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);

    try {
      const txId = tx.txId.toString();
      console.log('Looking for transaction with ID:', txId);
      console.log('Available transactions:', transactions);
      
      const storedTx = (transactions as TransactionRecord)[txId];
      console.log('Found stored transaction:', storedTx);
      
      if (!storedTx) {
        throw new Error('No signed transaction found');
      }

      // Parse the signed transaction data
      const signedMetaTx = JSON.parse(storedTx.signedData);
      console.log('Parsed meta transaction:', signedMetaTx);

      // Get the account from the wallet client
      const [account] = await walletClient.getAddresses();
      
      if (!account) {
        throw new Error('No account found in wallet');
      }

      console.log('Broadcasting with account:', account);
      console.log('Creating vault instance with:', {
        contractAddress,
        chain: walletClient.chain,
        account
      });

      const vault = new SimpleVault(
        publicClient, 
        walletClient, 
        contractAddress, 
        chain
      );

      // Broadcast the meta transaction
      console.log('Broadcasting meta transaction...');
      console.log('from', account);
      const result = await vault.approveWithdrawalWithMetaTx(
        signedMetaTx,
        { from: account }
      );

      console.log('Broadcast result:', result);
      await result.wait();
      
      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction for withdrawal #${txId}`
      });

      // Clear the signed state and refresh transactions
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[`${txId}-${type}`];
        return newState;
      });
      
      onRefresh?.();
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      onError?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, publicClient, chain, contractAddress, transactions, onSuccess, onError, onRefresh]);

  return {
    handleMetaTxSign,
    handleBroadcastMetaTx,
    signedMetaTxStates,
    isLoading: isLoading,
    error: error
  };
} 