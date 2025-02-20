import { useChainId } from 'wagmi'
import { mainnet, sepolia } from 'viem/chains'
import type { Chain } from 'viem'

export function useChain(): Chain {
  const chainId = useChainId()
  const chains: Record<number, Chain> = { [mainnet.id]: mainnet, [sepolia.id]: sepolia }
  return chains[chainId] || mainnet
} 