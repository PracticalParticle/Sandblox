import { usePublicClient } from 'wagmi'
import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createGlobalTransactionMonitor, GlobalTransaction, TransactionFilters } from '@/lib/global-transaction-monitor'
import { Hash, Address } from 'viem'
import { env } from '@/config/env'

/**
 * Global transaction monitor hook that provides centralized transaction tracking
 * across the entire application using TanStack Query for state management
 */
export function useGlobalTransactionMonitor() {
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  
  const monitor = useMemo(() => {
    if (!publicClient) return null
    return createGlobalTransactionMonitor(publicClient, queryClient)
  }, [publicClient, queryClient])

  // Get all transactions from TanStack Query cache
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => {
      return queryClient.getQueryData<GlobalTransaction[]>(['transactions']) || []
    },
    staleTime: 0, // Always fresh
    enabled: !!monitor
  })

  /**
   * Enhanced execution wrapper that simulates before sending
   */
  const executeWithMonitoring = useCallback(async (
    transactionFn: () => Promise<Hash>,
    operation: string,
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    source: string = 'unknown'
  ): Promise<Hash> => {
    if (!monitor) {
      console.warn('Global transaction monitor not available, executing without monitoring')
      return await transactionFn()
    }

    // Only enable debugging if explicitly enabled in environment
    if (!env.VITE_ENABLE_TRANSACTION_DEBUGGING) {
      console.log(`🔍 [DEBUG] Debugging disabled, executing transaction directly`)
      return await transactionFn()
    }

    console.log(`🔍 [GLOBAL DEBUG] Pre-flight simulation for ${operation}`)
    
    // Pre-simulation
    const simulation = await monitor.simulateAndStoreTransaction(
      from,
      to,
      data,
      value,
      operation,
      source
    )

    if (!simulation.success) {
      console.error(`❌ [GLOBAL DEBUG] ${operation} simulation failed:`, simulation.error)
      
      // Get detailed error information
      const attempt = monitor.getTransactionHistory().find(t => t.id === simulation.attemptId)
      if (attempt?.errorDetails) {
        console.error(`🔍 [GLOBAL DEBUG] Detailed error info:`, attempt.errorDetails)
      }
      
      throw new Error(`Transaction simulation failed: ${simulation.error}`)
    }

    console.log(`✅ [GLOBAL DEBUG] ${operation} simulation successful, executing transaction`)

    try {
      // Execute transaction
      const txHash = await transactionFn()
      
      // Track the executed transaction
      await monitor.trackExecutedTransaction(
        txHash,
        operation,
        from,
        to,
        data,
        value,
        source
      )
      
      console.log(`🎯 [GLOBAL DEBUG] ${operation} executed successfully: ${txHash}`)
      return txHash
    } catch (error) {
      const attempt = monitor.getTransactionHistory().find(t => t.id === simulation.attemptId)
      console.error(`❌ [GLOBAL DEBUG] ${operation} execution failed:`, error)
      
      // Update simulation record with execution error
      monitor.updateTransactionStatus(
        simulation.attemptId,
        'error',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      throw new Error(`Transaction execution failed: ${attempt?.error || (error as Error).message}`)
    }
  }, [monitor])

  /**
   * Track a meta-transaction
   */
  const trackMetaTransaction = useCallback(async (
    operation: string,
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    source: string = 'unknown'
  ): Promise<string> => {
    if (!monitor) {
      console.warn('Global transaction monitor not available')
      return 'no_monitor'
    }

    return await monitor.trackMetaTransaction(operation, from, to, data, value, source)
  }, [monitor])

  /**
   * Track a deployment transaction
   */
  const trackDeployment = useCallback(async (
    operation: string,
    from: Address,
    bytecode: string,
    source: string = 'unknown'
  ): Promise<string> => {
    if (!monitor) {
      console.warn('Global transaction monitor not available')
      return 'no_monitor'
    }

    return await monitor.trackDeployment(operation, from, bytecode, source)
  }, [monitor])

  /**
   * Update transaction status
   */
  const updateTransactionStatus = useCallback((
    txId: string,
    status: GlobalTransaction['status'],
    txHash?: Hash,
    error?: string,
    gasEstimate?: bigint
  ) => {
    if (!monitor) return
    monitor.updateTransactionStatus(txId, status, txHash, error, gasEstimate)
  }, [monitor])

  /**
   * Get filtered transactions
   */
  const getFilteredTransactions = useCallback((filters: TransactionFilters = {}): GlobalTransaction[] => {
    if (!monitor) return []
    return monitor.getFilteredTransactions(filters)
  }, [monitor])

  /**
   * Clear all transactions
   */
  const clearAllTransactions = useCallback(() => {
    if (!monitor) return
    monitor.clearGlobalTransactions()
  }, [monitor])

  /**
   * Get transaction statistics
   */
  const getTransactionStats = useCallback(() => {
    if (!monitor) return {
      total: 0,
      pending: 0,
      success: 0,
      error: 0,
      simulated: 0,
      bySource: {},
      byType: {}
    }
    return monitor.getTransactionStats()
  }, [monitor])

  /**
   * Get network information
   */
  const getNetworkInfo = useCallback(async () => {
    if (!monitor) return null
    return await monitor.getNetworkInfo()
  }, [monitor])

  /**
   * Simple transaction execution without pre-simulation
   */
  const executeTransactionSimple = useCallback(async (
    transactionFn: () => Promise<Hash>,
    operation: string,
    source: string = 'unknown'
  ): Promise<Hash> => {
    if (!monitor) {
      return await transactionFn()
    }

    try {
      monitor.logTransactionStart(operation, {})
      const txHash = await transactionFn()
      
      // Always track executed transactions when debugging is enabled
      if (env.VITE_ENABLE_TRANSACTION_DEBUGGING) {
        try {
          const tx = await publicClient?.getTransaction({ hash: txHash })
          if (tx) {
            await monitor.trackExecutedTransaction(
              txHash,
              operation,
              tx.from,
              tx.to || '0x0000000000000000000000000000000000000000',
              tx.input,
              tx.value,
              source
            )
          }
        } catch (error) {
          console.warn('Could not track transaction details:', error)
        }
      }
      
      monitor.logTransactionSuccess(operation, `Transaction hash: ${txHash}`)
      return txHash
    } catch (error) {
      monitor.logTransactionError(operation, error)
      throw error
    }
  }, [monitor, publicClient])

  return {
    // Core functionality
    monitor,
    isAvailable: !!monitor,
    networkType: monitor?.networkType || 'unknown',
    isDebuggingEnabled: env.VITE_ENABLE_TRANSACTION_DEBUGGING,
    
    // Transaction execution
    executeWithMonitoring,
    executeTransactionSimple,
    
    // Transaction tracking
    trackMetaTransaction,
    trackDeployment,
    updateTransactionStatus,
    
    // Data access
    transactions,
    getFilteredTransactions,
    getTransactionStats,
    getNetworkInfo,
    
    // Transaction history (from NetworkDebugger)
    getTransactionHistory: () => monitor?.getTransactionHistory() || [],
    clearTransactionHistory: () => monitor?.clearTransactionHistory(),
    clearAllTransactions,
    
    // Logging helpers
    logTransactionStart: (operation: string, details: any) => monitor?.logTransactionStart(operation, details),
    logTransactionSuccess: (operation: string, message: string) => monitor?.logTransactionSuccess(operation, message),
    logTransactionError: (operation: string, error: any) => monitor?.logTransactionError(operation, error),
    logContractState: (contractAddress: Address, operation: string) => monitor?.logContractState(contractAddress, operation)
  }
}
