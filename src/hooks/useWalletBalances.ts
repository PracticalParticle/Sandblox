import { usePublicClient, useAccount } from 'wagmi';
import { Address } from 'viem';
import { erc20Abi } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface TokenBalance {
  address: Address;
  balance: bigint;
  decimals: number;
  symbol: string;
  name: string;
}

export interface WalletBalances {
  eth: bigint;
  tokens: Record<Address, TokenBalance>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to manage wallet balances for both ETH and ERC20 tokens using TanStack Query
 * @param tokenAddresses Array of token addresses to track
 * @param refreshInterval Optional interval in ms to refresh balances (default: 30000)
 * @returns WalletBalances object containing ETH and token balances
 */
export function useWalletBalances(
  tokenAddresses: Address[] = [],
  refreshInterval: number = 30000
): WalletBalances {
  const { address: walletAddress } = useAccount();
  const publicClient = usePublicClient();

  const { data: balances, isLoading, error } = useQuery({
    queryKey: queryKeys.wallet.balances(walletAddress!, tokenAddresses),
    queryFn: async () => {
      if (!walletAddress || !publicClient) {
        return {
          eth: BigInt(0),
          tokens: {},
        };
      }

      try {
        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({
          address: walletAddress,
        });

        // Use multicall to fetch all token data in a single RPC call
        const tokenBalances: Record<Address, TokenBalance> = {};
        
        if (tokenAddresses.length > 0) {
          const contracts = tokenAddresses.flatMap(tokenAddress => [
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [walletAddress],
            },
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'decimals',
              args: [],
            },
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'symbol',
              args: [],
            },
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'name',
              args: [],
            },
          ]);

          const results = await publicClient.multicall({
            contracts,
            allowFailure: true,
          });

          // Process results in groups of 4 (balance, decimals, symbol, name)
          for (let i = 0; i < tokenAddresses.length; i++) {
            const tokenAddress = tokenAddresses[i];
            const baseIndex = i * 4;
            
            const balanceResult = results[baseIndex];
            const decimalsResult = results[baseIndex + 1];
            const symbolResult = results[baseIndex + 2];
            const nameResult = results[baseIndex + 3];

            // Only add token if all calls succeeded
            if (
              balanceResult.status === 'success' &&
              decimalsResult.status === 'success' &&
              symbolResult.status === 'success' &&
              nameResult.status === 'success'
            ) {
              tokenBalances[tokenAddress] = {
                address: tokenAddress,
                balance: balanceResult.result as bigint,
                decimals: decimalsResult.result as number,
                symbol: symbolResult.result as string,
                name: nameResult.result as string,
              };
            } else {
              console.warn(`Failed to fetch token data for ${tokenAddress}`);
            }
          }
        }

        return {
          eth: ethBalance,
          tokens: tokenBalances,
        };
      } catch (error) {
        console.error('Error fetching balances:', error);
        throw error;
      }
    },
    enabled: !!walletAddress && !!publicClient,
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: true,
    staleTime: 30_000, // Cache for 30 seconds
  });

  return {
    eth: balances?.eth || BigInt(0),
    tokens: balances?.tokens || {},
    isLoading,
    error: error as Error | null,
  };
} 