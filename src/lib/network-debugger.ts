import { PublicClient, Hash, Address } from 'viem'
import { createGanacheDebugger, DetailedErrorInfo } from './ganache-debugger'

export interface TransactionAttempt {
  id: string
  from: Address
  to: Address
  data: string
  value: bigint
  gasEstimate: bigint
  operation: string
  timestamp: number
  status: 'simulated_success' | 'simulated_failure' | 'simulation_error'
  error?: string
  result?: any
  errorDetails?: DetailedErrorInfo
}

export interface TransactionDebugInfo {
  hash: Hash
  from: Address
  to: Address | null
  gasLimit: bigint
  gasPrice: bigint
  value: bigint
  blockNumber: bigint
  gasUsed: bigint
  effectiveGasPrice: bigint
  status: 'success' | 'reverted'
  revertReason?: string
  logs: any[]
  isUnmined?: boolean
  simulationDetails?: DetailedErrorInfo
}

export type NetworkType = 'ganache' | 'hardhat' | 'public' | 'unknown'

export class NetworkDebugger {
  private publicClient: PublicClient
  private ganacheDebugger?: ReturnType<typeof createGanacheDebugger>
  private _networkType: NetworkType
  private transactionHistory: Map<string, TransactionAttempt> = new Map()

  /**
   * Protected getter for publicClient access by subclasses
   */
  protected get client(): PublicClient {
    return this.publicClient
  }

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient
    this._networkType = this.detectNetworkType()
    
    // Initialize Ganache debugger if applicable
    if (this._networkType === 'ganache' || this._networkType === 'hardhat') {
      this.ganacheDebugger = createGanacheDebugger(publicClient)
    }
  }

  /**
   * Detect network type based on chain ID and RPC URL
   */
  private detectNetworkType(): NetworkType {
    const chainId = this.publicClient.chain?.id
    const rpcUrl = this.publicClient.transport.url

    // Ganache typically uses chain ID 1337
    if (chainId === 1337 || rpcUrl?.includes('localhost:8545')) {
      return 'ganache'
    }

    // Hardhat typically uses chain ID 31337
    if (chainId === 31337) {
      return 'hardhat'
    }

    // Public networks
    if (chainId === 1 || chainId === 11155111 || chainId === 5) {
      return 'public'
    }

    return 'unknown'
  }

  /**
   * Get network type
   */
  get networkType(): NetworkType {
    return this._networkType
  }

  /**
   * Enhanced transaction debugging that handles both mined and unmined transactions
   */
  async debugTransaction(
    txHash: Hash,
    _operation: string
  ): Promise<TransactionDebugInfo | null> {
    // First try to get the transaction from the chain
    try {
      const tx = await this.publicClient.getTransaction({ hash: txHash })
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })
      
      return await this.processMinedTransaction(tx, receipt, _operation)
    } catch (error) {
      // Transaction not found on chain - check our local history
      console.log(`🔍 Transaction ${txHash} not found on chain, checking local history...`)
      
      const localAttempt = this.transactionHistory.get(txHash)
      if (localAttempt) {
        return this.processUnminedTransaction(localAttempt, _operation)
      }
      
      console.warn(`Transaction ${txHash} not found in local history either`)
      return null
    }
  }

  /**
   * Simulate transaction before sending and store attempt details
   */
  async simulateAndStoreTransaction(
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n,
    _operation: string
  ): Promise<{
    success: boolean
    gasEstimate: bigint
    error?: string
    attemptId: string
  }> {
    const attemptId = this.generateAttemptId(from, to, data, value)
    
    try {
      console.log(`🔍 [${this._networkType.toUpperCase()}] Simulating ${_operation}...`)
      console.log(`  📤 From: ${from}`)
      console.log(`  📥 To: ${to}`)
      console.log(`  📝 Data: ${data}`)
      console.log(`  💵 Value: ${value} wei`)
      
      // Estimate gas first (Guardian pattern: always estimate gas before send)
      const gasEstimate = await this.publicClient.estimateGas({
        to,
        data: data as `0x${string}`,
        value,
        account: from
      })
      
      console.log(`  ⛽ Gas Estimate: ${gasEstimate}`)
      
      // Try to call the function to see if it would revert (Guardian pattern: simulation before execution)
      try {
        const result = await this.publicClient.call({
          to,
          data: data as `0x${string}`,
          value,
          account: from
        })
        
        console.log(`  ✅ Simulation successful`)
        
        // Store successful attempt
        this.transactionHistory.set(attemptId, {
          id: attemptId,
          from,
          to,
          data,
          value,
          gasEstimate,
          operation: _operation,
          timestamp: Date.now(),
          status: 'simulated_success',
          result
        })
        
        return { success: true, gasEstimate, attemptId }
      } catch (error: any) {
        console.log(`  ❌ Simulation failed: ${error.message}`)
        
        // Store failed attempt with detailed error
        this.transactionHistory.set(attemptId, {
          id: attemptId,
          from,
          to,
          data,
          value,
          gasEstimate,
          operation: _operation,
          timestamp: Date.now(),
          status: 'simulated_failure',
          error: error.message,
          errorDetails: await this.getDetailedErrorInfo(error, from, to, data, value) || undefined
        })
        
        return { success: false, gasEstimate, error: error.message, attemptId }
      }
      
    } catch (error: any) {
      console.error(`❌ [${this.networkType.toUpperCase()}] Simulation error:`, error)
      
      // Store error attempt
      this.transactionHistory.set(attemptId, {
        id: attemptId,
        from,
        to,
        data,
        value,
        gasEstimate: 0n,
        operation: _operation,
        timestamp: Date.now(),
        status: 'simulation_error',
        error: error.message
      })
      
      return { success: false, gasEstimate: 0n, error: error.message, attemptId }
    }
  }

  /**
   * Get detailed error information based on network type
   */
  private async getDetailedErrorInfo(
    error: any,
    from: Address,
    to: Address,
    data: string,
    value: bigint
  ): Promise<DetailedErrorInfo | null> {
    switch (this._networkType) {
      case 'ganache':
        return this.getGanacheErrorDetails(error, from, to, data, value)
      case 'hardhat':
        return this.getHardhatErrorDetails(error, from, to, data, value)
      case 'public':
        return this.getPublicNetworkErrorDetails(error)
      default:
        return this.getStandardErrorDetails(error)
    }
  }

  /**
   * Ganache-specific error details using debug_traceCall
   */
  private async getGanacheErrorDetails(
    error: any,
    from: Address,
    to: Address,
    data: string,
    value: bigint
  ): Promise<DetailedErrorInfo | null> {
    if (!this.ganacheDebugger) {
      return this.getStandardErrorDetails(error)
    }

    try {
      // For mined transactions, we need to get the revert reason differently
      // Since we don't have the txHash here, we'll use simulation to get the error
      const simulation = await this.ganacheDebugger.simulateTransaction(from, to, data, value)
      
      return {
        revertReason: simulation.error || error.message,
        gasUsed: simulation.gasEstimate,
        executionTrace: simulation.trace,
        networkType: 'ganache'
      }
    } catch (traceError) {
      console.warn('Failed to get Ganache trace details:', traceError)
      return {
        revertReason: error.message,
        networkType: 'ganache'
      }
    }
  }

  /**
   * Hardhat-specific error details
   */
  private async getHardhatErrorDetails(
    error: any,
    from: Address,
    to: Address,
    data: string,
    value: bigint
  ): Promise<DetailedErrorInfo | null> {
    if (!this.ganacheDebugger) {
      return this.getStandardErrorDetails(error)
    }

    try {
      // Hardhat also supports debug_traceCall
      const simulation = await this.ganacheDebugger.simulateTransaction(from, to, data, value)
      
      return {
        revertReason: simulation.error || error.message,
        gasUsed: simulation.gasEstimate,
        executionTrace: simulation.trace,
        networkType: 'hardhat'
      }
    } catch (traceError) {
      return {
        revertReason: error.message,
        networkType: 'hardhat'
      }
    }
  }

  /**
   * Public network error details (limited)
   */
  private async getPublicNetworkErrorDetails(error: any): Promise<DetailedErrorInfo | null> {
    return {
      revertReason: error.message,
      networkType: 'public',
      note: 'Limited debugging available on public networks'
    }
  }

  /**
   * Standard error details
   */
  private async getStandardErrorDetails(error: any): Promise<DetailedErrorInfo | null> {
    return {
      revertReason: error.message,
      networkType: 'unknown'
    }
  }

  /**
   * Process mined transaction
   */
  private async processMinedTransaction(
    tx: any,
    receipt: any,
    _operation: string
  ): Promise<TransactionDebugInfo> {
    const debugInfo: TransactionDebugInfo = {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      gasLimit: tx.gas,
      gasPrice: tx.gasPrice || 0n,
      value: tx.value,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice || 0n,
      status: receipt.status === 'success' ? 'success' : 'reverted',
      logs: receipt.logs.map((log: any) => ({
        address: log.address,
        topics: log.topics,
        data: log.data
      }))
    }

    // If transaction reverted, try to get detailed revert reason
    if (receipt.status === 'reverted') {
      console.log(`🔍 [NETWORK DEBUG] Transaction reverted, attempting to get revert reason`)
      console.log(`🔍 [NETWORK DEBUG] Network type: ${this._networkType}`)
      console.log(`🔍 [NETWORK DEBUG] Has ganache debugger: ${!!this.ganacheDebugger}`)
      
      try {
        // For Ganache, use the Ganache debugger directly to get revert reason
        if (this._networkType === 'ganache' && this.ganacheDebugger) {
          console.log(`🔍 [NETWORK DEBUG] Using Ganache debugger to get revert reason for: ${tx.hash}`)
          const revertReason = await this.ganacheDebugger.getRevertReason(tx.hash)
          console.log(`🔍 [NETWORK DEBUG] Ganache debugger returned: ${revertReason}`)
          if (revertReason) {
            debugInfo.revertReason = revertReason
            console.log(`🔍 [NETWORK DEBUG] Set revert reason: ${revertReason}`)
          } else {
            console.log(`🔍 [NETWORK DEBUG] No revert reason found by Ganache debugger`)
          }
        } else {
          console.log(`🔍 [NETWORK DEBUG] Using standard error details`)
          // For other networks, use the standard error details
          const detailedError = await this.getDetailedErrorInfo(
            new Error('Transaction reverted'),
            tx.from,
            tx.to,
            tx.input,
            tx.value
          )
          if (detailedError) {
            debugInfo.revertReason = detailedError.revertReason
            debugInfo.simulationDetails = detailedError
            console.log(`🔍 [NETWORK DEBUG] Set revert reason from standard error: ${detailedError.revertReason}`)
          }
        }
      } catch (error) {
        console.warn(`🔍 [NETWORK DEBUG] Could not get detailed revert reason:`, error)
      }
    } else {
      console.log(`🔍 [NETWORK DEBUG] Transaction succeeded, no revert reason needed`)
    }

    return debugInfo
  }

  /**
   * Process unmined transaction from local history
   */
  private processUnminedTransaction(
    attempt: TransactionAttempt,
    _operation: string
  ): TransactionDebugInfo {
    return {
      hash: attempt.id as Hash,
      from: attempt.from,
      to: attempt.to,
      gasLimit: attempt.gasEstimate,
      gasPrice: 0n,
      value: attempt.value,
      blockNumber: 0n,
      gasUsed: 0n,
      effectiveGasPrice: 0n,
      status: 'reverted',
      revertReason: attempt.error,
      logs: [],
      isUnmined: true,
      simulationDetails: attempt.errorDetails
    }
  }

  /**
   * Generate unique attempt ID
   */
  private generateAttemptId(
    from: Address,
    to: Address,
    data: string,
    value: bigint
  ): string {
    const input = `${from}-${to}-${data}-${value.toString()}-${Date.now()}`
    return `0x${this.simpleHash(input)}`
  }

  /**
   * Simple hash function for attempt IDs
   */
  private simpleHash(input: string): string {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }

  /**
   * Get transaction history for debugging
   */
  getTransactionHistory(): TransactionAttempt[] {
    return Array.from(this.transactionHistory.values())
  }

  /**
   * Clear transaction history
   */
  clearTransactionHistory(): void {
    this.transactionHistory.clear()
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number
    blockNumber: bigint
    networkType: NetworkType
    rpcUrl: string
  }> {
    try {
      const chainId = await this.publicClient.getChainId()
      const blockNumber = await this.publicClient.getBlockNumber()
      const rpcUrl = this.publicClient.transport.url || 'unknown'
      
      return {
        chainId,
        blockNumber,
        networkType: this._networkType,
        rpcUrl
      }
    } catch (error) {
      console.error('Failed to get network info:', error)
      throw error
    }
  }

  /**
   * Log contract state for debugging
   */
  async logContractState(contractAddress: Address, operation: string): Promise<void> {
    if (this.ganacheDebugger) {
      await this.ganacheDebugger.logContractState(contractAddress, operation)
    } else {
      console.log(`🔍 [${this.networkType.toUpperCase()}] Contract state for ${operation}:`)
      console.log(`  📋 Contract: ${contractAddress}`)
      
      try {
        const blockNumber = await this.publicClient.getBlockNumber()
        console.log(`  📦 Current Block: ${blockNumber}`)
        
        const code = await this.publicClient.getCode({ address: contractAddress })
        console.log(`  📝 Contract Code: ${code === '0x' ? 'NOT DEPLOYED' : 'DEPLOYED'}`)
      } catch (error) {
        console.warn(`⚠️ Could not get contract state:`, error)
      }
    }
  }

  /**
   * Log transaction start
   */
  logTransactionStart(operation: string, details: Record<string, any>): void {
    if (this.ganacheDebugger) {
      this.ganacheDebugger.logTransactionStart(operation, details)
    } else {
      console.log(`🚀 [${this.networkType.toUpperCase()}] Starting ${operation}:`)
      Object.entries(details).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`)
      })
    }
  }

  /**
   * Log transaction success
   */
  logTransactionSuccess(operation: string, details: string): void {
    if (this.ganacheDebugger) {
      this.ganacheDebugger.logTransactionSuccess(operation, details)
    } else {
      console.log(`✅ [${this.networkType.toUpperCase()}] ${operation} successful: ${details}`)
    }
  }

  /**
   * Log transaction error
   */
  logTransactionError(operation: string, error: any): void {
    if (this.ganacheDebugger) {
      this.ganacheDebugger.logTransactionError(operation, error)
    } else {
      console.error(`❌ [${this.networkType.toUpperCase()}] ${operation} failed:`, error)
    }
  }
}

/**
 * Create a network debugger instance
 */
export function createNetworkDebugger(publicClient: PublicClient): NetworkDebugger {
  return new NetworkDebugger(publicClient)
}
