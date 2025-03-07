import { useCallback, useState } from 'react';
import { Address, createWalletClient, custom, Hash } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import SimpleVault from '../SimpleVault';
import { createVaultMetaTxParams, getStoredMetaTxSettings } from '../SimpleVault.ui';
import { MetaTransaction } from '@/particle-core/sdk/typescript/interfaces/lib.index';

interface UseVaultMetaTxReturn {
  signWithdrawalApproval: (txId: number) => Promise<MetaTransaction>;
  isLoading: boolean;
  error: Error | null;
}

export function useVaultMetaTx(contractAddress: Address): UseVaultMetaTxReturn {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signWithdrawalApproval = useCallback(async (txId: number): Promise<MetaTransaction> => {
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

      // Sign the message hash from the meta transaction
      const signature = await walletClient.signMessage({
        account: address,
        message: unsignedMetaTx.message
      });

      // Return the signed meta transaction
      return {
        ...unsignedMetaTx,
        signature
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to sign meta transaction');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, publicClient, walletClient]);

  return {
    signWithdrawalApproval,
    isLoading,
    error
  };
} 