import { useState, useCallback } from 'react';
import { Address, Hex } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useChain } from '@/hooks/useChain';
import { useTransactionManager } from '@/hooks/useTransactionManager';
import { convertBigIntsToStrings } from '@/lib/utils';
import SimpleRWA20 from '../SimpleRWA20';
import { useOperationTypes } from '@/hooks/useOperationTypes';

type NotificationMessage = {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
};

interface UseMetaTxActionsReturn {
  handleMetaTxSign: (to: Address, amount: bigint, type: 'mint' | 'burn') => Promise<void>;
  handleBroadcastMetaTx: (txId: string, type: 'mint' | 'burn') => Promise<void>;
  signedMetaTxStates: Record<string, { type: 'mint' | 'burn' }>;
  isLoading: boolean;
  error: Error | null;
}

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
  const [signedMetaTxStates, setSignedMetaTxStates] = useState<Record<string, { type: 'mint' | 'burn' }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { operationTypes } = useOperationTypes(contractAddress);

  const signMetaTransaction = useCallback(async (
    to: Address,
    amount: bigint,
    type: 'mint' | 'burn'
  ): Promise<void> => {
    if (!walletClient || !publicClient || !chain) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create token instance
      const token = new SimpleRWA20(publicClient, walletClient, contractAddress, chain);

      // Get the signer's address
      const [address] = await walletClient.getAddresses();

      // Generate unsigned meta transaction
      const metaTxParams = {
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        maxGasPrice: BigInt(50000000000) // 50 gwei
      };

      const unsignedMetaTx = type === 'mint' 
        ? await token.generateUnsignedMintMetaTx(to, amount, metaTxParams)
        : await token.generateUnsignedBurnMetaTx(to, amount, metaTxParams);

      // Sign the message hash
      const messageHash = unsignedMetaTx.message;
      const signature = await walletClient.signMessage({
        message: { raw: messageHash as Hex },
        account: address
      });

      // Create the complete signed meta transaction
      const signedMetaTx = {
        ...unsignedMetaTx,
        signature: signature as Hex
      };

      // Store the signed transaction
      const txId = unsignedMetaTx.txRecord.txId.toString();
      const serializedTx = convertBigIntsToStrings(signedMetaTx);

      // Get operation type name from contract
      const operationType = unsignedMetaTx.txRecord.params.operationType as Hex;
      const operationName = operationTypes.get(operationType) || (type === 'mint' ? SimpleRWA20.MINT_TOKENS : SimpleRWA20.BURN_TOKENS);

      storeTransaction(
        txId,
        JSON.stringify(serializedTx),
        {
          type: operationName,
          timestamp: Date.now(),
          broadcasted: false,
          status: 'PENDING'
        }
      );

      // Update signed state
      setSignedMetaTxStates(prev => ({
        ...prev,
        [txId]: { type }
      }));

      onSuccess?.({
        type: 'success',
        title: 'Meta Transaction Signed',
        description: `Successfully signed ${type} meta-transaction`
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign meta transaction');
      setError(error);
      onError?.({
        type: 'error',
        title: 'Signing Failed',
        description: error.message
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, publicClient, walletClient, chain, storeTransaction, operationTypes, onSuccess, onError]);

  const handleMetaTxSign = useCallback(async (
    to: Address,
    amount: bigint,
    type: 'mint' | 'burn'
  ) => {
    try {
      await signMetaTransaction(to, amount, type);
    } catch (error) {
      console.error('Failed to sign meta transaction:', error);
      throw error;
    }
  }, [signMetaTransaction]);

  const handleBroadcastMetaTx = useCallback(async (
    txId: string,
    type: 'mint' | 'burn'
  ) => {
    if (!walletClient || !publicClient || !chain) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);

    try {
      const storedTx = (transactions as TransactionRecord)[txId];
      if (!storedTx) {
        throw new Error('No signed transaction found');
      }

      // Parse the signed transaction data
      const signedMetaTx = JSON.parse(storedTx.signedData);

      // Get the account from the wallet client
      const [account] = await walletClient.getAddresses();
      if (!account) {
        throw new Error('No account found in wallet');
      }

      const token = new SimpleRWA20(
        publicClient,
        walletClient,
        contractAddress,
        chain
      );

      // Broadcast the meta transaction
      const result = type === 'mint'
        ? await token.mintWithMetaTx(signedMetaTx, { from: account })
        : await token.burnWithMetaTx(signedMetaTx, { from: account });

      await result.wait();

      onSuccess?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction`
      });

      // Clear the signed state and refresh
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[txId];
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
    isLoading,
    error
  };
} 