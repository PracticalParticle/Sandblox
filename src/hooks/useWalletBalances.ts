import { useState, useEffect } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { Address, formatEther, formatUnits } from 'viem';
import { erc20Abi } from 'viem';

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
 * Hook to manage wallet balances for both ETH and ERC20 tokens
 * @param tokenAddresses Array of token addresses to track
 * @param refreshInterval Optional interval in ms to refresh balances (default: 10000)
 * @returns WalletBalances object containing ETH and token balances
 */
export function useWalletBalances(
  tokenAddresses: Address[] = [],
  refreshInterval: number = 10000
): WalletBalances {
  const { address: walletAddress } = useAccount();
  const publicClient = usePublicClient();
  const [balances, setBalances] = useState<WalletBalances>({
    eth: BigInt(0),
    tokens: {},
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchBalances = async () => {
      if (!walletAddress || !publicClient) {
        return;
      }

      try {
        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({
          address: walletAddress,
        });

        // Fetch token balances and metadata
        const tokenBalances: Record<Address, TokenBalance> = {};
        await Promise.all(
          tokenAddresses.map(async (tokenAddress) => {
            try {
              const [balance, decimals, symbol, name] = await Promise.all([
                publicClient.readContract({
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [walletAddress],
                }) as Promise<bigint>,
                publicClient.readContract({
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: 'decimals',
                  args: [],
                }) as Promise<number>,
                publicClient.readContract({
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: 'symbol',
                  args: [],
                }) as Promise<string>,
                publicClient.readContract({
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: 'name',
                  args: [],
                }) as Promise<string>,
              ]);

              tokenBalances[tokenAddress] = {
                address: tokenAddress,
                balance,
                decimals,
                symbol,
                name,
              };
            } catch (error) {
              console.error(`Error fetching token balance for ${tokenAddress}:`, error);
              // Don't throw here, just log the error and continue with other tokens
            }
          })
        );

        if (mounted) {
          setBalances((prev) => ({
            ...prev,
            eth: ethBalance,
            tokens: tokenBalances,
            isLoading: false,
            error: null,
          }));
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
        if (mounted) {
          setBalances((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Failed to fetch balances'),
          }));
        }
      }
    };

    // Initial fetch
    fetchBalances();

    // Set up interval for periodic updates
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchBalances, refreshInterval);
    }

    // Cleanup
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [walletAddress, publicClient, tokenAddresses, refreshInterval]);

  return balances;
} 