import { useState, useCallback, useEffect } from 'react';
import { Address } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import SimpleVault from '../SimpleVault';
import { useChain } from '@/hooks/useChain';
import { useVaultMetaTx } from './useVaultMetaTx';
import { useTransactionManager } from '@/hooks/useTransactionManager';
import { convertBigIntsToStrings } from '@/lib/utils';
import { NotificationMessage } from '../lib/types';
import { VaultTxRecord } from '../components/PendingTransaction';

interface UseMetaTxActionsReturn {
  handleMetaTxSign: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  handleBroadcastMetaTx: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  signedMetaTxStates: Record<string, { type: 'approve' | 'cancel' }>;
  isLoading: boolean;
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
  const { signWithdrawalApproval, isLoading: isSigningMetaTx } = useVaultMetaTx(contractAddress);
  const { transactions, storeTransaction, error: txManagerError } = useTransactionManager(contractAddress);
  const [signedMetaTxStates, setSignedMetaTxStates] = useState<Record<string, { type: 'approve' | 'cancel' }>>({});
  const [isLoading, setIsLoading] = useState(false);

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

  const handleMetaTxSign = useCallback(async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    try {
      if (type === 'approve') {
        console.log('Starting meta transaction signing for txId:', tx.txId);
        
        const signedTx = await signWithdrawalApproval(Number(tx.txId));
        console.log('Received signed transaction:', signedTx);
        
        // Convert all BigInt values to strings recursively
        const serializedTx = convertBigIntsToStrings(signedTx);
        console.log('Serialized transaction:', serializedTx);

        // Create the correct transaction key
        const txKey = `metatx-${type}-${tx.txId}`;
        console.log('Storing with key:', txKey);

        storeTransaction(
          txKey,
          JSON.stringify(serializedTx),
          {
            type: 'WITHDRAWAL_APPROVAL',
            timestamp: Date.now()
          }
        );

        // Verify storage immediately after storing
        console.log('Stored transactions:', transactions);
        
        // Update signed state
        setSignedMetaTxStates(prev => ({
          ...prev,
          [`${tx.txId}-${type}`]: { type }
        }));

        onSuccess?.({
          type: 'success',
          title: 'Meta Transaction Signed',
          description: `Successfully signed approval for transaction #${tx.txId}`
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
      const txKey = `metatx-${type}-${tx.txId}`;
      console.log('Looking for transaction with key:', txKey);
      console.log('Available transactions:', transactions);
      
      const storedTx = transactions[txKey];
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
      const result = await vault.approveWithdrawalWithMetaTx(
        signedMetaTx,
        { from: account }
      );

      console.log('Broadcast result:', result);
      await result.wait();
      
      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction for withdrawal #${tx.txId}`
      });

      // Clear the signed state and refresh transactions
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[`${tx.txId}-${type}`];
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
    isLoading: isLoading || isSigningMetaTx
  };
} 