import { usePublicClient, useWalletClient, useConfig } from 'wagmi'
import { Address, Hex } from 'viem'
import { SecureOwnable } from '../Guardian/sdk/typescript/SecureOwnable'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

// Storage key for operation types cache
const OPERATION_TYPES_CACHE_KEY = 'operationTypes.cache';

interface CachedOperationTypes {
  [contractAddress: string]: {
    types: Array<{ operationType: string; name: string }>;
    timestamp: number;
  };
}

// Cache expiration time - 24 hours
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

export function useOperationTypes(contractAddress?: Address) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const config = useConfig()

  const { data: operationData, isLoading } = useQuery({
    queryKey: queryKeys.operations.types(publicClient?.chain?.id || 0, contractAddress!),
    queryFn: async () => {
      if (!contractAddress || !publicClient) {
        return {
          operationTypes: new Map<string, string>(),
          nameToTypeMap: new Map<string, Hex>(),
        }
      }

      try {
        // Check cache first
        const cachedData = localStorage.getItem(OPERATION_TYPES_CACHE_KEY)
        const cache: CachedOperationTypes = cachedData ? JSON.parse(cachedData) : {}
        const cachedEntry = cache[contractAddress]
        
        // If we have valid cached data, use it
        if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_EXPIRATION) {
          console.log('Using cached operation types for contract:', contractAddress)
          const typeMap = new Map<string, string>()
          const reverseMap = new Map<string, Hex>()
          cachedEntry.types.forEach(({ operationType, name }) => {
            typeMap.set(operationType, name)
            reverseMap.set(name, operationType as Hex)
          })
          return { operationTypes: typeMap, nameToTypeMap: reverseMap }
        }

        // If no cache or expired, load from contract
        const chainId = await publicClient.getChainId()
        const chain = config.chains.find(c => c.id === chainId)
        if (!chain) throw new Error('Chain not found')

        const contract = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
        const types = await contract.getSupportedOperationTypes()
        
        // Create a map of operation type hex to name
        const typeMap = new Map<string, string>()
        const reverseMap = new Map<string, Hex>()
        types.forEach(({ operationType, name }) => {
          typeMap.set(operationType, name)
          reverseMap.set(name, operationType as Hex)
        })
        
        // Update cache
        cache[contractAddress] = {
          types: types.map(t => ({ operationType: t.operationType, name: t.name })),
          timestamp: Date.now()
        }
        localStorage.setItem(OPERATION_TYPES_CACHE_KEY, JSON.stringify(cache))
        
        return { operationTypes: typeMap, nameToTypeMap: reverseMap }
      } catch (error) {
        console.error('Failed to load operation types:', error)
        throw error
      }
    },
    enabled: !!contractAddress && !!publicClient,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep in cache for 7 days
  })

  return {
    operationTypes: operationData?.operationTypes || new Map<string, string>(),
    nameToTypeMap: operationData?.nameToTypeMap || new Map<string, Hex>(),
    loading: isLoading,
    getOperationName: (type: Hex) => operationData?.operationTypes.get(type) || 'Unknown Operation',
    getOperationType: (name: string) => operationData?.nameToTypeMap.get(name) || null
  }
} 