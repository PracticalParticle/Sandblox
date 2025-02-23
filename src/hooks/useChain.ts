import { useChainId, useConfig } from 'wagmi'
import type { Chain } from 'viem'

export function useChain(): Chain | undefined {
  const chainId = useChainId()
  const config = useConfig()
  
  return config.chains.find(chain => chain.id === chainId)
} 