import { PublicClient, Hash, Address } from 'viem'

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
}

export class TransactionDebugger {
  private publicClient: PublicClient

  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient
  }

  /**
   * Log debug information to console
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🔍 DEBUG:`, message)
    if (data) {
      console.log('  📋 Data:', JSON.stringify(data, (_, v) => 
        typeof v === 'bigint' ? v.toString() : v
      , 2))
    }
  }

  /**
   * Get detailed transaction information and log it
   */
  async logTransactionDetails(txHash: string, operation: string): Promise<TransactionDebugInfo | null> {
    if (!this.publicClient) {
      this.log('❌ No public client available')
      return null
    }

    try {
      this.log(`🔍 ${operation} - Transaction Details:`)
      this.log(`  📋 Hash: ${txHash}`)
      
      // Get transaction details
      const tx = await this.publicClient.getTransaction({ hash: txHash as Hash })
      this.log(`  📤 From: ${tx.from}`)
      this.log(`  📥 To: ${tx.to}`)
      this.log(`  ⛽ Gas Limit: ${tx.gas}`)
      this.log(`  💰 Gas Price: ${tx.gasPrice} wei`)
      this.log(`  💵 Value: ${tx.value} wei`)
      
      // Wait for receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash as Hash })
      this.log(`  📦 Block: ${receipt.blockNumber}`)
      this.log(`  ⛽ Gas Used: ${receipt.gasUsed}`)
      this.log(`  💰 Effective Gas Price: ${receipt.effectiveGasPrice} wei`)
      this.log(`  ✅ Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`)
      
      const debugInfo: TransactionDebugInfo = {
        hash: txHash as Hash,
        from: tx.from,
        to: tx.to,
        gasLimit: tx.gas,
        gasPrice: tx.gasPrice || 0n,
        value: tx.value,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice || 0n,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        logs: receipt.logs.map(log => ({
          address: log.address,
          topics: log.topics,
          data: log.data
        }))
      }
      
      if (receipt.status === 'reverted') {
        this.log(`  ❌ Transaction reverted`)
        
        // Try to get revert reason
        const revertReason = await this.getRevertReason(txHash as Hash)
        if (revertReason) {
          this.log(`  🔍 Revert reason: ${revertReason}`)
          debugInfo.revertReason = revertReason
        }
      }
      
      this.log(`  🎉 ${operation} completed`)
      return debugInfo
      
    } catch (error) {
      this.log(`❌ Error monitoring ${operation}:`, error)
      throw error
    }
  }

  /**
   * Get revert reason from a failed transaction
   */
  private async getRevertReason(txHash: Hash): Promise<string | undefined> {
    try {
      // Try to simulate the transaction to get revert reason
      const tx = await this.publicClient.getTransaction({ hash: txHash })
      
      if (!tx.to) return undefined

      try {
        await this.publicClient.call({
          to: tx.to,
          data: tx.input,
          value: tx.value,
          gasPrice: tx.gasPrice,
          blockNumber: tx.blockNumber ? tx.blockNumber - 1n : undefined
        })
      } catch (error: any) {
        // Extract revert reason from error
        if (error.data) {
          // Try to decode the error data
          return this.decodeRevertReason(error.data)
        }
        return error.message || error.shortMessage || 'Unknown revert reason'
      }
    } catch (error) {
      this.log('Could not retrieve revert reason', { error })
      return undefined
    }
  }

  /**
   * Decode revert reason from error data
   */
  private decodeRevertReason(errorData: string): string {
    try {
      // Standard Error(string) selector is 0x08c379a0
      if (errorData.startsWith('0x08c379a0')) {
        // Remove the selector and decode the string
        const reason = errorData.slice(10)
        // This is a simple hex to string conversion
        // In production, use proper ABI decoding
        return `Error(${reason})`
      }
      
      // Custom error - just return the selector and data
      return `Custom error: ${errorData.slice(0, 10)}`
    } catch (error) {
      return errorData
    }
  }

  /**
   * Log transaction start
   */
  logTransactionStart(operation: string, params?: any): void {
    this.log(`🚀 Starting ${operation}...`)
    if (params) {
      this.log(`  📋 Parameters:`, params)
    }
  }

  /**
   * Log transaction success
   */
  logTransactionSuccess(operation: string, txHash: string): void {
    this.log(`✅ ${operation} successful`)
    this.log(`  📋 Transaction Hash: ${txHash}`)
  }

  /**
   * Log transaction error
   */
  logTransactionError(operation: string, error: any): void {
    this.log(`❌ ${operation} failed:`, error)
  }

  /**
   * Log contract state before transaction
   */
  async logContractState(contractAddress: Address, operation: string): Promise<void> {
    try {
      this.log(`🔍 Contract state before ${operation}:`)
      this.log(`  📍 Contract: ${contractAddress}`)
      
      // Get current block info
      const block = await this.publicClient.getBlock()
      this.log(`  📦 Current block: ${block.number}`)
      this.log(`  🕐 Block timestamp: ${new Date(Number(block.timestamp) * 1000).toLocaleString()}`)
      
      // Get gas price
      const gasPrice = await this.publicClient.getGasPrice()
      this.log(`  ⛽ Current gas price: ${gasPrice} wei (${(Number(gasPrice) / 1e9).toFixed(2)} Gwei)`)
      
    } catch (error) {
      this.log(`❌ Error getting contract state:`, error)
    }
  }

  /**
   * Log network information
   */
  async logNetworkInfo(): Promise<void> {
    try {
      const chainId = await this.publicClient.getChainId()
      const block = await this.publicClient.getBlock()
      const gasPrice = await this.publicClient.getGasPrice()
      
      this.log(`🌐 Network Information:`)
      this.log(`  🔗 Chain ID: ${chainId}`)
      this.log(`  📦 Block: ${block.number}`)
      this.log(`  🕐 Time: ${new Date(Number(block.timestamp) * 1000).toLocaleString()}`)
      this.log(`  ⛽ Gas Price: ${gasPrice} wei (${(Number(gasPrice) / 1e9).toFixed(2)} Gwei)`)
      
    } catch (error) {
      this.log(`❌ Error getting network info:`, error)
    }
  }

  /**
   * Estimate gas and log the result
   */
  async estimateAndLogGas(
    from: Address,
    to: Address,
    data: string,
    value?: bigint,
    operation?: string
  ): Promise<bigint> {
    try {
      this.log(`⛽ Estimating gas for ${operation || 'transaction'}...`)
      
      const gas = await this.publicClient.estimateGas({
        to,
        data: data as `0x${string}`,
        value,
        account: from
      })

      this.log(`  📊 Estimated gas: ${gas}`)
      
      // Calculate estimated cost
      const gasPrice = await this.publicClient.getGasPrice()
      const estimatedCost = gas * gasPrice
      this.log(`  💰 Estimated cost: ${estimatedCost} wei (${(Number(estimatedCost) / 1e18).toFixed(6)} ETH)`)
      
      return gas
    } catch (error) {
      this.log(`❌ Gas estimation failed:`, error)
      throw error
    }
  }
}

/**
 * Create a transaction debugger instance
 */
export function createTransactionDebugger(publicClient: PublicClient): TransactionDebugger {
  return new TransactionDebugger(publicClient)
}

/**
 * Quick debug function for immediate use
 */
export async function debugTransaction(
  publicClient: PublicClient,
  txHash: string,
  operation: string
): Promise<TransactionDebugInfo | null> {
  const txDebugger = new TransactionDebugger(publicClient)
  return await txDebugger.logTransactionDetails(txHash, operation)
}
