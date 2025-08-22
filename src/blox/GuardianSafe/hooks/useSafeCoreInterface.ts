import { useCallback, useEffect, useState } from 'react';
import { Address } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { SafeCoreInterface } from '../lib/safe/SafeCoreInterface';

export interface SafeCoreInterfaceState {
  SafeCoreInterface: SafeCoreInterface | null;
  isLoading: boolean;
  error: Error | null;
  isInitialized: boolean;
}

export function useSafeCoreInterface(safeAddress?: Address) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<SafeCoreInterfaceState>({
    SafeCoreInterface: null,
    isLoading: false,
    error: null,
    isInitialized: false
  });

  useEffect(() => {
    if (!safeAddress || !publicClient || !walletClient || !publicClient.chain) {
      setState(prev => ({ ...prev, SafeCoreInterface: null, isInitialized: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, isInitialized: false }));

    try {
      const safeInterface = new SafeCoreInterface(
        {
          safeAddress,
          chainId: publicClient.chain.id
        },
        publicClient,
        walletClient
      );

      // Initialize the Safe SDK
      safeInterface.init().then(() => {
        setState(prev => ({
          ...prev,
          SafeCoreInterface: safeInterface,
          isLoading: false,
          error: null,
          isInitialized: true
        }));
      }).catch(error => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error as Error,
          isInitialized: false
        }));
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error,
        isInitialized: false
      }));
    }
  }, [safeAddress, publicClient, walletClient]);

  /**
   * Get Safe owners/signers
   */
  const getOwners = useCallback(async (): Promise<Address[]> => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }
    return await state.SafeCoreInterface.getOwners();
  }, [state.SafeCoreInterface, state.isInitialized]);

  /**
   * Check if an address is an owner
   */
  const isOwner = useCallback(async (address: Address): Promise<boolean> => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }
    return await state.SafeCoreInterface.isOwner(address);
  }, [state.SafeCoreInterface, state.isInitialized]);

  /**
   * Get Safe nonce
   */
  const getNonce = useCallback(async (): Promise<number> => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }
    return await state.SafeCoreInterface.getNonce();
  }, [state.SafeCoreInterface, state.isInitialized]);

  /**
   * Get Safe guard info
   */
  const getGuardInfo = useCallback(async () => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }
    return await state.SafeCoreInterface.getGuardInfo();
  }, [state.SafeCoreInterface, state.isInitialized]);

  /**
   * Set a transaction guard on the Safe wallet
   */
  const setGuard = useCallback(async (guardAddress: Address): Promise<string> => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }

    if (!walletClient?.account?.address) {
      throw new Error('Wallet not connected');
    }

    // Validate the guard address format early
    if (!guardAddress || typeof guardAddress !== 'string') {
      throw new Error('Invalid guard address: address must be a string');
    }

    // Ensure address is properly formatted (42 characters including 0x)
    if (!/^0x[a-fA-F0-9]{40}$/.test(guardAddress)) {
      throw new Error(`Invalid guard address format: ${guardAddress}. Expected 42-character hex string starting with 0x, got ${guardAddress.length} characters`);
    }

    console.log('🔍 Setting guard with address:', guardAddress);
    console.log('🔍 Address length:', guardAddress.length);
    console.log('🔍 Address format valid:', /^0x[a-fA-F0-9]{40}$/.test(guardAddress));

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // First check if the connected wallet is an owner
      const isOwnerResult = await state.SafeCoreInterface.isOwner(walletClient.account.address);
      if (!isOwnerResult) {
        throw new Error('Connected wallet is not a Safe owner');
      }

      const safeTxHash = await state.SafeCoreInterface.setGuard(guardAddress);
      setState(prev => ({ ...prev, isLoading: false }));
      return safeTxHash;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
      throw error;
    }
  }, [state.SafeCoreInterface, state.isInitialized, walletClient?.account?.address]);

  /**
   * Remove the transaction guard from the Safe wallet
   */
  const removeGuard = useCallback(async (): Promise<string> => {
    if (!state.SafeCoreInterface || !state.isInitialized) {
      throw new Error('Safe interface not initialized');
    }

    if (!walletClient?.account?.address) {
      throw new Error('Wallet not connected');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // First check if the connected wallet is an owner
      const isOwnerResult = await state.SafeCoreInterface.isOwner(walletClient.account.address);
      if (!isOwnerResult) {
        throw new Error('Connected wallet is not a Safe owner');
      }

      const safeTxHash = await state.SafeCoreInterface.removeGuard();
      setState(prev => ({ ...prev, isLoading: false }));
      return safeTxHash;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
      throw error;
    }
  }, [state.SafeCoreInterface, state.isInitialized, walletClient?.account?.address]);

  return {
    getOwners,
    isOwner,
    getNonce,
    getGuardInfo,
    setGuard,
    removeGuard,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized
  };
}

/**
 * Hook to get Safe owners directly (simplified version)
 */
export function useSafeOwners(safeAddress?: Address) {
  const [owners, setOwners] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const safeInterface = useSafeCoreInterface(safeAddress);

  const fetchOwners = useCallback(async () => {
    if (!safeInterface.isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const ownersResult = await safeInterface.getOwners();
      setOwners(ownersResult);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [safeInterface.getOwners, safeInterface.isInitialized]);

  useEffect(() => {
    if (safeAddress && safeInterface.isInitialized && !safeInterface.isLoading && !safeInterface.error) {
      fetchOwners();
    }
  }, [safeAddress, safeInterface.isInitialized, safeInterface.isLoading, safeInterface.error, fetchOwners]);

  return {
    owners,
    isLoading: isLoading || safeInterface.isLoading,
    error: error || safeInterface.error,
    refetch: fetchOwners,
    clearError: () => setError(null)
  };
}