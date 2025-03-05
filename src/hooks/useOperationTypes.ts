import { useState, useEffect } from 'react'
import { usePublicClient, useWalletClient, useConfig } from 'wagmi'
import { Address, Hex } from 'viem'
import { SecureOwnable } from '@/particle-core/sdk/typescript/SecureOwnable'

export function useOperationTypes(contractAddress?: Address) {
  const [operationTypes, setOperationTypes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const config = useConfig()

  useEffect(() => {
    const loadOperationTypes = async () => {
      if (!contractAddress || !publicClient) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const chainId = await publicClient.getChainId()
        const chain = config.chains.find(c => c.id === chainId)
        if (!chain) throw new Error('Chain not found')

        const contract = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
        const types = await contract.getSupportedOperationTypes()
        
        // Create a map of operation type hex to name
        const typeMap = new Map<string, string>()
        types.forEach(({ operationType, name }) => {
          typeMap.set(operationType, name)
        })
        
        setOperationTypes(typeMap)
      } catch (error) {
        console.error('Failed to load operation types:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOperationTypes()
  }, [contractAddress, publicClient, walletClient, config.chains])

  return {
    operationTypes,
    loading,
    getOperationName: (type: Hex) => operationTypes.get(type) || 'Unknown Operation'
  }
} 