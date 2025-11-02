import { PublicClient, Hash, Address } from 'viem'
import { QueryClient } from '@tanstack/react-query'
import { NetworkDebugger, NetworkType } from './network-debugger'

export interface GlobalTransaction {
  id: string
  type: 'contract_call' | 'meta_tx' | 'deployment' | 'send' | 'simulation'
  operation: string
  from: Address
  to: Address
  value: bigint
  data: string
  status: 'pending' | 'success' | 'error' | 'simulated_success' | 'simulated_failure' | 'simulation_error'
  txHash?: Hash
  gasEstimate?: bigint
  error?: string
  timestamp: number
  source: string // Component/page that initiated
  errorDetails?: any
  result?: any
}

export interface TransactionFilters {
  status?: string
  source?: string
  type?: string
  operation?: string
}

export class GlobalTransactionMonitor extends NetworkDebugger {
  private queryClient: QueryClient
  private globalTransactionId = 0

  constructor(publicClient: PublicClient, queryClient: QueryClient) {
    super(publicClient)
    this.queryClient = queryClient
  }

  /**
   * Enhanced simulation that also stores in TanStack Query
   */
  async simulateAndStoreTransaction(
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    operation: string,
    source: string = 'unknown'
  ): Promise<{
    success: boolean
    gasEstimate: bigint
    error?: string
    attemptId: string
  }> {
    // Use existing simulation logic from NetworkDebugger
    const result = await super.simulateAndStoreTransaction(from, to, data, value, operation)
    
    // Create global transaction record
    const globalTx: GlobalTransaction = {
      id: result.attemptId,
      type: 'simulation',
      operation,
      from,
      to,
      value,
      data,
      status: result.success ? 'simulated_success' : 'simulated_failure',
      gasEstimate: result.gasEstimate,
      error: result.error,
      timestamp: Date.now(),
      source,
      errorDetails: this.getTransactionHistory().find(t => t.id === result.attemptId)?.errorDetails
    }
    
    // Store in TanStack Query cache
    this.storeGlobalTransaction(globalTx)
    
    return result
  }

  /**
   * Store transaction in global TanStack Query cache
   */
  private storeGlobalTransaction(transaction: GlobalTransaction): void {
    // Store individual transaction
    this.queryClient.setQueryData(['transactions', transaction.id], transaction)
    
    // Update global transaction list
    this.queryClient.setQueryData(['transactions'], (old: GlobalTransaction[] = []) => {
      const existing = old.find(t => t.id === transaction.id)
      if (existing) {
        // Update existing transaction
        return old.map(t => t.id === transaction.id ? transaction : t)
      } else {
        // Add new transaction
        return [...old, transaction]
      }
    })
    
    // Invalidate queries to trigger re-renders
    this.queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  /**
   * Track a transaction that was executed (not just simulated)
   */
  async trackExecutedTransaction(
    txHash: Hash,
    operation: string,
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    source: string = 'unknown'
  ): Promise<void> {
    const globalTxId = `exec_${txHash}_${Date.now()}`
    
    const globalTx: GlobalTransaction = {
      id: globalTxId,
      type: 'contract_call',
      operation,
      from,
      to,
      value,
      data,
      status: 'pending',
      txHash,
      timestamp: Date.now(),
      source
    }
    
    this.storeGlobalTransaction(globalTx)
    
    // Wait for transaction receipt and check for revert
    try {
      const receipt = await this.client.waitForTransactionReceipt({ hash: txHash })
      
      if (receipt.status === 'success') {
        // Transaction succeeded
        const updatedTx: GlobalTransaction = {
          ...globalTx,
          status: 'success',
          gasEstimate: receipt.gasUsed
        }
        this.storeGlobalTransaction(updatedTx)
      } else {
        // Transaction reverted
        console.log(`🔍 [GLOBAL DEBUG] Transaction reverted, calling debugTransaction for: ${txHash}`)
        const debugInfo = await this.debugTransaction(txHash, operation)
        console.log(`🔍 [GLOBAL DEBUG] debugTransaction returned:`, debugInfo)
        console.log(`🔍 [GLOBAL DEBUG] Revert reason: ${debugInfo?.revertReason}`)
        
        const updatedTx: GlobalTransaction = {
          ...globalTx,
          status: 'error',
          error: debugInfo?.revertReason || 'Transaction reverted',
          gasEstimate: receipt.gasUsed
        }
        console.log(`🔍 [GLOBAL DEBUG] Storing reverted transaction with error: ${updatedTx.error}`)
        this.storeGlobalTransaction(updatedTx)
      }
    } catch (error) {
      // Error getting receipt or debugging
      const updatedTx: GlobalTransaction = {
        ...globalTx,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      this.storeGlobalTransaction(updatedTx)
    }
  }

  /**
   * Track a meta-transaction
   */
  async trackMetaTransaction(
    operation: string,
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    source: string = 'unknown'
  ): Promise<string> {
    const globalTxId = `meta_${this.generateGlobalId()}`
    
    const globalTx: GlobalTransaction = {
      id: globalTxId,
      type: 'meta_tx',
      operation,
      from,
      to,
      value,
      data,
      status: 'pending',
      timestamp: Date.now(),
      source
    }
    
    this.storeGlobalTransaction(globalTx)
    return globalTxId
  }

  /**
   * Track a deployment transaction
   */
  async trackDeployment(
    operation: string,
    from: Address,
    bytecode: string,
    source: string = 'unknown'
  ): Promise<string> {
    const globalTxId = `deploy_${this.generateGlobalId()}`
    
    const globalTx: GlobalTransaction = {
      id: globalTxId,
      type: 'deployment',
      operation,
      from,
      to: '0x0000000000000000000000000000000000000000' as Address, // Deployment target
      value: 0n,
      data: bytecode,
      status: 'pending',
      timestamp: Date.now(),
      source
    }
    
    this.storeGlobalTransaction(globalTx)
    return globalTxId
  }

  /**
   * Update transaction status
   */
  updateTransactionStatus(
    txId: string,
    status: GlobalTransaction['status'],
    txHash?: Hash,
    error?: string,
    gasEstimate?: bigint
  ): void {
    this.queryClient.setQueryData(['transactions', txId], (old: GlobalTransaction) => {
      if (!old) return old
      
      const updated: GlobalTransaction = {
        ...old,
        status,
        ...(txHash && { txHash }),
        ...(error && { error }),
        ...(gasEstimate && { gasEstimate })
      }
      
      // Also update in the global list
      this.queryClient.setQueryData(['transactions'], (oldList: GlobalTransaction[] = []) => {
        return oldList.map(t => t.id === txId ? updated : t)
      })
      
      return updated
    })
    
    this.queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  /**
   * Get filtered transactions from TanStack Query cache
   */
  getFilteredTransactions(filters: TransactionFilters = {}): GlobalTransaction[] {
    const allTransactions = this.queryClient.getQueryData<GlobalTransaction[]>(['transactions']) || []
    
    return allTransactions.filter(tx => {
      if (filters.status && tx.status !== filters.status) return false
      if (filters.source && !tx.source.includes(filters.source)) return false
      if (filters.type && tx.type !== filters.type) return false
      if (filters.operation && !tx.operation.includes(filters.operation)) return false
      return true
    })
  }

  /**
   * Clear all global transactions
   */
  clearGlobalTransactions(): void {
    this.queryClient.removeQueries({ queryKey: ['transactions'] })
    this.clearTransactionHistory() // Also clear local history
  }

  /**
   * Get transaction statistics
   */
  getTransactionStats(): {
    total: number
    pending: number
    success: number
    error: number
    simulated: number
    bySource: Record<string, number>
    byType: Record<string, number>
  } {
    const allTransactions = this.queryClient.getQueryData<GlobalTransaction[]>(['transactions']) || []
    
    const stats = {
      total: allTransactions.length,
      pending: 0,
      success: 0,
      error: 0,
      simulated: 0,
      bySource: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }
    
    allTransactions.forEach(tx => {
      // Count by status
      if (tx.status === 'pending') stats.pending++
      else if (tx.status === 'success' || tx.status === 'simulated_success') stats.success++
      else if (tx.status === 'error' || tx.status === 'simulated_failure' || tx.status === 'simulation_error') stats.error++
      else if (tx.status === 'simulated_success' || tx.status === 'simulated_failure') stats.simulated++
      
      // Count by source
      stats.bySource[tx.source] = (stats.bySource[tx.source] || 0) + 1
      
      // Count by type
      stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1
    })
    
    return stats
  }

  /**
   * Generate unique global transaction ID
   */
  private generateGlobalId(): string {
    return `global_${++this.globalTransactionId}_${Date.now()}`
  }

  /**
   * Get network information for debugging
   */
  async getNetworkInfo(): Promise<{
    chainId: number
    blockNumber: bigint
    networkType: NetworkType
    rpcUrl: string
  }> {
    try {
      const chainId = this.client.chain?.id || 0
      const rpcUrl = this.client.transport.url || 'unknown'
      const blockNumber = await this.client.getBlockNumber()
      
      return {
        chainId,
        blockNumber,
        networkType: this.networkType,
        rpcUrl
      }
    } catch (error) {
      return {
        chainId: 0,
        blockNumber: 0n,
        networkType: this.networkType,
        rpcUrl: 'unknown'
      }
    }
  }
}

/**
 * Create a global transaction monitor instance
 */
export function createGlobalTransactionMonitor(
  publicClient: PublicClient,
  queryClient: QueryClient
): GlobalTransactionMonitor {
  return new GlobalTransactionMonitor(publicClient, queryClient)
}
