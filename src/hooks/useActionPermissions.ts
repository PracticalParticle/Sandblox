import { Address, Chain } from 'viem';
import { useRoleValidation } from './useRoleValidation';
import { useChainId, useConfig } from 'wagmi';
import { useMemo } from 'react';

export type ActionType = 
  | 'request_withdrawal'
  | 'timelock_approve'
  | 'timelock_cancel'
  | 'metatx_sign'
  | 'metatx_broadcast';

interface ActionPermissions {
  canRequestWithdrawal: boolean;
  canTimeLockApprove: boolean;
  canTimeLockCancel: boolean;
  canMetaTxSign: boolean;
  canMetaTxBroadcast: boolean;
  ownerAddress?: Address;
  broadcasterAddress?: Address;
  isLoading: boolean;
  error?: Error;
}

export function useActionPermissions(
  contractAddress: Address,
  connectedAddress?: Address,
): ActionPermissions {
  const chainId = useChainId();
  const config = useConfig();
  
  const chain = useMemo(() => {
    if (!chainId) return undefined;
    return config.chains.find(c => c.id === chainId);
  }, [chainId, config.chains]);

  const { 
    isOwner, 
    isBroadcaster, 
    ownerAddress, 
    broadcasterAddress,
    isLoading,
    error 
  } = useRoleValidation(contractAddress, connectedAddress, chain);

  return {
    // Owner-restricted actions
    canRequestWithdrawal: isOwner,
    canTimeLockApprove: isOwner,
    canTimeLockCancel: isOwner,
    canMetaTxSign: isOwner,
    
    // Broadcaster-restricted actions
    canMetaTxBroadcast: isBroadcaster,
    
    // Additional context
    ownerAddress,
    broadcasterAddress,
    isLoading,
    error
  };
} 