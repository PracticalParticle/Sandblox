import { useState } from 'react';
import { Address } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import SimpleVault from '../SimpleVault';
import { useChain } from '@/hooks/useChain';
import { NotificationMessage } from '../lib/types';

interface UseTimeLockActionsReturn {
  handleApproveWithdrawal: (txId: number) => Promise<void>;
  handleCancelWithdrawal: (txId: number) => Promise<void>;
  loadingStates: {
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
  };
}

export function useTimeLockActions(
  contractAddress: Address,
  onSuccess?: (message: NotificationMessage) => void,
  onError?: (message: NotificationMessage) => void,
  onRefresh?: () => void
): UseTimeLockActionsReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  const [loadingStates, setLoadingStates] = useState<{
    approval: Record<number, boolean>;
    cancellation: Record<number, boolean>;
  }>({
    approval: {},
    cancellation: {}
  });

  const handleApproveWithdrawal = async (txId: number): Promise<void> => {
    if (!walletClient || !publicClient || !address || !chain) {
      throw new Error("Vault not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({
      ...prev,
      approval: { ...prev.approval, [txId]: true }
    }));

    try {
      const vault = new SimpleVault(publicClient, walletClient, contractAddress, chain);
      const tx = await vault.approveWithdrawalAfterDelay(txId, { from: address });
      await tx.wait();

      onSuccess?.({
        type: 'success',
        title: 'Withdrawal Approved',
        description: `Successfully approved withdrawal #${txId}`
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Approval error:', error);
      onError?.({
        type: 'error',
        title: 'Approval Failed',
        description: error.message || 'Failed to approve withdrawal'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        approval: { ...prev.approval, [txId]: false }
      }));
    }
  };

  const handleCancelWithdrawal = async (txId: number): Promise<void> => {
    if (!walletClient || !publicClient || !address || !chain) {
      throw new Error("Vault not initialized or wallet not connected");
    }

    setLoadingStates(prev => ({
      ...prev,
      cancellation: { ...prev.cancellation, [txId]: true }
    }));

    try {
      const vault = new SimpleVault(publicClient, walletClient, contractAddress, chain);
      const tx = await vault.cancelWithdrawal(txId, { from: address });
      await tx.wait();

      onSuccess?.({
        type: 'success',
        title: 'Withdrawal Cancelled',
        description: `Successfully cancelled withdrawal #${txId}`
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Cancellation error:', error);
      onError?.({
        type: 'error',
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel withdrawal'
      });
      throw error;
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        cancellation: { ...prev.cancellation, [txId]: false }
      }));
    }
  };

  return {
    handleApproveWithdrawal,
    handleCancelWithdrawal,
    loadingStates
  };
} 