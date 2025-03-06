import { useCallback, useState } from 'react';
import { Address, createWalletClient, custom, Hash } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import SimpleVault from '../SimpleVault';
import { createVaultMetaTxParams } from '../SimpleVault.ui';
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

      // Create meta tx params with 1 hour deadline
      const metaTxParams = createVaultMetaTxParams({
        deadline: BigInt(3600), // 1 hour
        maxGasPrice: BigInt(0) // No max gas price
      });

      // Generate unsigned meta transaction
      const unsignedMetaTx = await vault.generateUnsignedWithdrawalMetaTxApproval(
        BigInt(txId),
        metaTxParams
      );

      // Get the signer's address
      const [address] = await walletClient.getAddresses();

      // Create the meta transaction data for signing
      const domain = {
        name: 'SimpleVault',
        version: '1',
        chainId: chain.id,
        verifyingContract: contractAddress
      };

      const types = {
        MetaTransaction: [
          { name: 'txId', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'maxGasPrice', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      } as const;

      const message = {
        txId: BigInt(txId),
        deadline: metaTxParams.deadline,
        maxGasPrice: metaTxParams.maxGasPrice,
        nonce: unsignedMetaTx.params.nonce
      } as const;

      // Sign the typed data
      const signature = await walletClient.signTypedData({
        account: address,
        domain,
        types,
        primaryType: 'MetaTransaction',
        message,
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