import { useChainId } from 'wagmi';
import { mainnet, sepolia, type Chain } from 'viem/chains';

export function useChain() {
  const chainId = useChainId();
  const chains: Record<number, Chain> = { [mainnet.id]: mainnet, [sepolia.id]: sepolia };
  return { chain: chains[chainId] || mainnet };
} 