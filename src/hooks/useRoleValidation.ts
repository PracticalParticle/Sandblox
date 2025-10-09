import { Address, Chain } from 'viem';
import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import SecureOwnableABIJson from '../Guardian/abi/SecureOwnable.abi.json';

interface RoleValidationResult {
  isOwner: boolean;
  isBroadcaster: boolean;
  isRecovery: boolean;
  ownerAddress?: Address;
  broadcasterAddress?: Address;
  recoveryAddress?: Address;
  isLoading: boolean;
  error?: Error;
}


export function useRoleValidation(
  contractAddress: Address,
  connectedAddress?: Address,
  chain?: Chain
): RoleValidationResult {
  const publicClient = usePublicClient();
  const { data, isLoading, error } = useQuery({
    enabled: Boolean(publicClient && contractAddress && chain),
    queryKey: queryKeys.contract.roles(chain?.id || 0, contractAddress),
    queryFn: async () => {
      const [ownerAddress, broadcasterAddress, recoveryAddress] = await publicClient!.multicall({
        contracts: [
          { address: contractAddress, abi: SecureOwnableABIJson as any, functionName: 'owner', args: [] },
          { address: contractAddress, abi: SecureOwnableABIJson as any, functionName: 'getBroadcaster', args: [] },
          { address: contractAddress, abi: SecureOwnableABIJson as any, functionName: 'getRecoveryAddress', args: [] }
        ],
        allowFailure: false
      }) as [Address, Address, Address];
      return { ownerAddress, broadcasterAddress, recoveryAddress };
    },
    staleTime: 60_000,
  });

  const ownerAddress = data?.ownerAddress;
  const broadcasterAddress = data?.broadcasterAddress;
  const recoveryAddress = data?.recoveryAddress;
  const isOwner = !!(connectedAddress && ownerAddress && connectedAddress.toLowerCase() === ownerAddress.toLowerCase());
  const isBroadcaster = !!(connectedAddress && broadcasterAddress && connectedAddress.toLowerCase() === broadcasterAddress.toLowerCase());
  const isRecovery = !!(connectedAddress && recoveryAddress && connectedAddress.toLowerCase() === recoveryAddress.toLowerCase());

  return {
    isOwner,
    isBroadcaster,
    isRecovery,
    ownerAddress,
    broadcasterAddress,
    recoveryAddress,
    isLoading,
    error: error as Error | undefined,
  };
} 