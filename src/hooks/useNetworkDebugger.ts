import { usePublicClient, useWalletClient } from 'wagmi'
import { useMemo, useCallback } from 'react'
import { createNetworkDebugger } from '@/lib/network-debugger'
import { Hash, Address } from 'viem'
import { env } from '@/config/env'

export function useNetworkDebugger() {
  const publicClient = usePublicClient()
  const { data: _walletClient } = useWalletClient()
  
  const networkDebugger = useMemo(() => {
    if (!publicClient) return null
    return createNetworkDebugger(publicClient)
  }, [publicClient])

  /**
   * Enhanced transaction wrapper that simulates before sending
   */
  const executeTransactionWithDebugging = useCallback(async (
    transactionFn: () => Promise<Hash>,
    operation: string,
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<Hash> => {
    if (!networkDebugger) {
      throw new Error('Debugger not available')
    }

    // Only enable debugging if explicitly enabled in environment
    if (!env.VITE_ENABLE_TRANSACTION_DEBUGGING) {
      console.log(`🔍 [DEBUG] Debugging disabled, executing transaction directly`)
      return await transactionFn()
    }

    // Step 1: Simulate the transaction (Guardian pattern: simulation-first approach)
    console.log(`🔍 [DEBUG] Pre-flight simulation for ${operation}`)
    const simulation = await networkDebugger.simulateAndStoreTransaction(
      from,
      to,
      data,
      value,
      operation
    )

    if (!simulation.success) {
      console.error(`❌ [DEBUG] ${operation} simulation failed:`, simulation.error)
      
      // Get detailed error information
      const attempt = networkDebugger.getTransactionHistory().find(t => t.id === simulation.attemptId)
      if (attempt?.errorDetails) {
        console.error(`🔍 [DEBUG] Detailed error info:`, attempt.errorDetails)
      }
      
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    console.log(`✅ [DEBUG] ${operation} simulation successful, proceeding with transaction`)

    // Step 2: Execute the actual transaction
    try {
      const txHash = await transactionFn()
      
      // Step 3: Debug the actual transaction
      if (env.VITE_DEBUG_LOG_LEVEL === 'verbose') {
        await networkDebugger.debugTransaction(txHash, operation)
      }
      
      return txHash
    } catch (error) {
      console.error(`❌ [DEBUG] ${operation} execution failed:`, error)
      
      // The transaction failed before being mined
      // Check if we have simulation details
      const attempt = networkDebugger.getTransactionHistory().find(t => t.id === simulation.attemptId)
      if (attempt?.errorDetails) {
        console.error(`🔍 [DEBUG] Pre-execution error details:`, attempt.errorDetails)
      }
      
      throw error
    }
  }, [networkDebugger])

  /**
   * Simple transaction execution without pre-simulation (for cases where simulation isn't possible)
   */
  const executeTransactionSimple = useCallback(async (
    transactionFn: () => Promise<Hash>,
    operation: string
  ): Promise<Hash> => {
    if (!networkDebugger) {
      return await transactionFn()
    }

    try {
      networkDebugger.logTransactionStart(operation, {})
      const txHash = await transactionFn()
      
      if (env.VITE_DEBUG_LOG_LEVEL === 'verbose') {
        await networkDebugger.debugTransaction(txHash, operation)
      }
      
      networkDebugger.logTransactionSuccess(operation, `Transaction hash: ${txHash}`)
      return txHash
    } catch (error) {
      networkDebugger.logTransactionError(operation, error)
      throw error
    }
  }, [networkDebugger])

  /**
   * Get network information
   */
  const getNetworkInfo = useCallback(async () => {
    if (!networkDebugger) return null
    return await networkDebugger.getNetworkInfo()
  }, [networkDebugger])

  /**
   * Log contract state
   */
  const logContractState = useCallback(async (contractAddress: Address, operation: string) => {
    if (!networkDebugger) return
    await networkDebugger.logContractState(contractAddress, operation)
  }, [networkDebugger])

  return {
    debugger: networkDebugger,
    isAvailable: !!networkDebugger,
    networkType: networkDebugger?.networkType || 'unknown',
    isDebuggingEnabled: env.VITE_ENABLE_TRANSACTION_DEBUGGING,
    executeTransactionWithDebugging,
    executeTransactionSimple,
    getTransactionHistory: () => networkDebugger?.getTransactionHistory() || [],
    clearTransactionHistory: () => networkDebugger?.clearTransactionHistory(),
    getNetworkInfo,
    logContractState
  }
}
