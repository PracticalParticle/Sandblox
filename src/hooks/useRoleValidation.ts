import { useState, useEffect } from 'react';
import { Address, Chain } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { SecureOwnable } from '../Guardian/sdk/typescript';

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

const defaultResult: RoleValidationResult = {
  isOwner: false,
  isBroadcaster: false,
  isRecovery: false,
  isLoading: true
};

export function useRoleValidation(
  contractAddress: Address,
  connectedAddress?: Address,
  chain?: Chain
): RoleValidationResult {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [result, setResult] = useState<RoleValidationResult>(defaultResult);

  useEffect(() => {
    let mounted = true;

    async function validateRoles() {
      if (!publicClient || !contractAddress || !chain) {
        if (mounted) {
          setResult({
            ...defaultResult,
            isLoading: false
          });
        }
        return;
      }

      try {
        // Create SecureOwnable instance
        const contract = new SecureOwnable(
          publicClient,
          walletClient,
          contractAddress,
          chain
        );

        // Helper function to safely call contract functions with error handling
        const safeCall = async <T>(
          fn: () => Promise<T>,
          functionName: string,
          defaultValue: T
        ): Promise<T> => {
          try {
            return await fn();
          } catch (error: any) {
            const errorMessage = error?.message || error?.shortMessage || String(error);
            console.warn(
              `⚠️ Role validation: Contract function "${functionName}" reverted or failed for ${contractAddress}:`,
              errorMessage.includes('revert') ? 'Function call reverted' : errorMessage
            );
            return defaultValue;
          }
        };

        // Get role addresses with individual error handling
        const [ownerAddress, broadcasterAddress, recoveryAddress] = await Promise.all([
          safeCall(
            () => contract.owner(),
            'owner()',
            '0x0000000000000000000000000000000000000000' as `0x${string}`
          ),
          safeCall(
            () => contract.getBroadcaster(),
            'getBroadcaster()',
            '0x0000000000000000000000000000000000000000' as `0x${string}`
          ),
          safeCall(
            () => contract.getRecovery(),
            'getRecovery()',
            '0x0000000000000000000000000000000000000000' as `0x${string}`
          )
        ]);

        if (!mounted) return;

        // Validate roles if connected address exists
        const isOwner = connectedAddress && ownerAddress !== '0x0000000000000000000000000000000000000000' ? 
          connectedAddress.toLowerCase() === ownerAddress.toLowerCase() : false;
        const isBroadcaster = connectedAddress && broadcasterAddress !== '0x0000000000000000000000000000000000000000' ? 
          connectedAddress.toLowerCase() === broadcasterAddress.toLowerCase() : false;
        const isRecovery = connectedAddress && recoveryAddress !== '0x0000000000000000000000000000000000000000' ? 
          connectedAddress.toLowerCase() === recoveryAddress.toLowerCase() : false;

        setResult({
          isOwner,
          isBroadcaster,
          isRecovery,
          ownerAddress,
          broadcasterAddress,
          recoveryAddress,
          isLoading: false
        });
      } catch (error) {
        console.error('Error validating roles:', error);
        if (mounted) {
          setResult({
            ...defaultResult,
            isLoading: false,
            error: error as Error
          });
        }
      }
    }

    validateRoles();

    return () => {
      mounted = false;
    };
  }, [publicClient, walletClient, contractAddress, connectedAddress, chain]);

  return result;
} 