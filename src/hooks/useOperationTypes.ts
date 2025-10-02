import { useState, useEffect, useRef, useCallback } from 'react'
import { usePublicClient, useWalletClient, useConfig } from 'wagmi'
import { Address, Hex } from 'viem'
import { SecureOwnable, OPERATION_TYPES } from '../Guardian/sdk/typescript'

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

// Global cache to prevent multiple loads for the same contract
const loadingCache = new Set<string>();

export function useOperationTypes(contractAddress?: Address) {
  const [operationTypes, setOperationTypes] = useState<Map<string, string>>(new Map())
  const [nameToTypeMap, setNameToTypeMap] = useState<Map<string, Hex>>(new Map())
  const [loading, setLoading] = useState(true)
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const config = useConfig()
  const hasLoadedRef = useRef<string | null>(null)

  const loadOperationTypes = useCallback(async () => {
    if (!contractAddress || !publicClient) {
      setLoading(false)
      return
    }

    // Prevent multiple loads for the same contract address
    if (hasLoadedRef.current === contractAddress || loadingCache.has(contractAddress)) {
      return
    }
    
    hasLoadedRef.current = contractAddress
    loadingCache.add(contractAddress)

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
        setOperationTypes(typeMap)
        setNameToTypeMap(reverseMap)
        setLoading(false)
        return
      }

      // If no cache or expired, load from contract
      setLoading(true)
      const chainId = await publicClient.getChainId()
      const chain = config.chains.find(c => c.id === chainId)
      if (!chain) throw new Error('Chain not found')

      const contract = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
      // Try to get operation types from contract - if this fails due to permissions,
      // the catch block will use SDK constants as fallback
      const operationTypeHashes = await contract.getSupportedOperationTypes()
      
      // Create a reverse mapping from hash to name
      const hashToNameMap = new Map<string, string>()
      Object.entries(OPERATION_TYPES).forEach(([name, hash]) => {
        hashToNameMap.set(hash.toLowerCase(), name)
      })
      
      // Create a map of operation type hex to name
      const typeMap = new Map<string, string>()
      const reverseMap = new Map<string, Hex>()
      const typesWithNames: Array<{ operationType: string; name: string }> = []
      
      operationTypeHashes.forEach((hash) => {
        const name = hashToNameMap.get(hash.toLowerCase())
        if (name) {
          typeMap.set(hash, name)
          reverseMap.set(name, hash as Hex)
          typesWithNames.push({ operationType: hash, name })
        }
      })
      
      // Update cache
      cache[contractAddress] = {
        types: typesWithNames,
        timestamp: Date.now()
      }
      localStorage.setItem(OPERATION_TYPES_CACHE_KEY, JSON.stringify(cache))
      
      setOperationTypes(typeMap)
      setNameToTypeMap(reverseMap)
    } catch (error) {
      console.error('Failed to load operation types:', error)
      
      // Fallback to SDK constants if contract call fails
      console.log('Falling back to SDK operation types constants')
      const fallbackTypes: Array<{ operationType: string; name: string }> = []
      Object.entries(OPERATION_TYPES).forEach(([name, hash]) => {
        fallbackTypes.push({ operationType: hash, name })
      })
      
      const typeMap = new Map<string, string>()
      const reverseMap = new Map<string, Hex>()
      
      fallbackTypes.forEach(({ operationType, name }) => {
        typeMap.set(operationType, name)
        reverseMap.set(name, operationType as Hex)
      })
      
      setOperationTypes(typeMap)
      setNameToTypeMap(reverseMap)
    } finally {
      setLoading(false)
      loadingCache.delete(contractAddress)
    }
  }, [contractAddress, publicClient])

  useEffect(() => {
    loadOperationTypes()
  }, [loadOperationTypes])

  const getOperationName = (type: Hex) => operationTypes.get(type) || 'Unknown Operation'
  const getOperationType = (name: string) => nameToTypeMap.get(name) || null

  return {
    operationTypes,
    nameToTypeMap,
    loading,
    getOperationName,
    getOperationType
  }
}