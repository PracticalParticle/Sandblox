import { useState, useEffect, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { Address } from 'viem';
import { SafeCoreInterface, SafeInfo, createSafeCoreInterface } from '../lib/safe/SafeCoreInterface';
import { useChain } from '@/hooks/useChain';

/**
 * Hook state for Safe interface operations
 */
interface SafeCoreInterfaceState {
  SafeCoreInterface: SafeCoreInterface | null;
  isLoading: boolean;
  error: string | null;
  safeInfo: SafeInfo | null;
  owners: Address[];
}

/**
 * Hook for interacting with Safe wallets using the Safe Protocol Kit
 * @param safeAddress The Safe wallet address
 * @param rpcUrl Optional custom RPC URL
 * @returns Safe interface operations and state
 */
export function useSafeCoreInterface(safeAddress?: Address, rpcUrl?: string) {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  
  const [state, setState] = useState<SafeCoreInterfaceState>({
    SafeCoreInterface: null,
    isLoading: false,
    error: null,
    safeInfo: null,
    owners: []
  });

  // Initialize Safe interface when dependencies are available
  useEffect(() => {
    if (!publicClient || !chain || !safeAddress) {
      setState(prev => ({
        ...prev,
        SafeCoreInterface: null,
        error: safeAddress ? 'Missing required dependencies' : null
      }));
      return;
    }

    try {
      const SafeCoreInterface = createSafeCoreInterface(
        publicClient,
        walletClient,
        safeAddress,
        chain,
        rpcUrl
      );
      
      setState(prev => ({
        ...prev,
        SafeCoreInterface,
        error: null
      }));
    } catch (error) {
      console.error('Failed to initialize Safe interface:', error);
      setState(prev => ({
        ...prev,
        SafeCoreInterface: null,
        error: error instanceof Error ? error.message : 'Failed to initialize Safe interface'
      }));
    }
  }, [publicClient, walletClient, chain, safeAddress, rpcUrl]);

  /**
   * Get Safe owners/signers
   */
  const getOwners = useCallback(async (): Promise<Address[]> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const owners = await state.SafeCoreInterface.getOwners();
      setState(prev => ({ 
        ...prev, 
        owners,
        isLoading: false 
      }));
      return owners;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get owners';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Get comprehensive Safe information
   */
  const getSafeInfo = useCallback(async (): Promise<SafeInfo> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const safeInfo = await state.SafeCoreInterface.getSafeInfo();
      setState(prev => ({ 
        ...prev, 
        safeInfo,
        owners: safeInfo.owners,
        isLoading: false 
      }));
      return safeInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get Safe info';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Get Safe threshold (minimum signatures required)
   */
  const getThreshold = useCallback(async (): Promise<number> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const threshold = await state.SafeCoreInterface.getThreshold();
      setState(prev => ({ ...prev, isLoading: false }));
      return threshold;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get threshold';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Check if an address is an owner of the Safe
   */
  const isOwner = useCallback(async (address: Address): Promise<boolean> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await state.SafeCoreInterface.isOwner(address);
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check owner status';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Get Safe nonce
   */
  const getNonce = useCallback(async (): Promise<number> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const nonce = await state.SafeCoreInterface.getNonce();
      setState(prev => ({ ...prev, isLoading: false }));
      return nonce;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get nonce';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Get Safe version
   */
  const getVersion = useCallback(async (): Promise<string> => {
    if (!state.SafeCoreInterface) {
      throw new Error('Safe interface not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const version = await state.SafeCoreInterface.getVersion();
      setState(prev => ({ ...prev, isLoading: false }));
      return version;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get version';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      throw error;
    }
  }, [state.SafeCoreInterface]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    SafeCoreInterface: state.SafeCoreInterface,
    isLoading: state.isLoading,
    error: state.error,
    safeInfo: state.safeInfo,
    owners: state.owners,
    
    // Methods
    getOwners,
    getSafeInfo,
    getThreshold,
    isOwner,
    getNonce,
    getVersion,
    clearError,
    
    // Computed
    isInitialized: !!state.SafeCoreInterface,
    hasOwners: state.owners.length > 0
  };
}

/**
 * Hook to get Safe owners directly (simplified version)
 * @param safeAddress The Safe wallet address
 * @param rpcUrl Optional custom RPC URL
 * @returns Owners and loading state
 */
export function useSafeOwners(safeAddress?: Address, rpcUrl?: string) {
  const {
    owners,
    isLoading,
    error,
    getOwners,
    clearError,
    isInitialized
  } = useSafeCoreInterface(safeAddress, rpcUrl);

  // Automatically fetch owners when Safe interface is initialized
  useEffect(() => {
    if (isInitialized && safeAddress && owners.length === 0 && !isLoading && !error) {
      getOwners().catch(console.error);
    }
  }, [isInitialized, safeAddress, owners.length, isLoading, error, getOwners]);

  return {
    owners,
    isLoading,
    error,
    refetch: getOwners,
    clearError
  };
}