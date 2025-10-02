import { PublicClient, WalletClient, Hash, Address } from 'viem'
import { 
  extractErrorInfo,
  COMMON_ERROR_PATTERNS
} from '../Guardian/sdk/typescript/utils/contract-errors'

export interface GanacheDebugInfo {
  transactionHash?: Hash
  from: Address
  to: Address | null
  data: string
  value: bigint
  gasLimit: bigint
  gasPrice: bigint
  status: 'pending' | 'success' | 'reverted'
  revertReason?: string
  gasUsed?: bigint
  blockNumber?: bigint
  logs: any[]
  error?: any
  executionTrace?: any
}

export interface DetailedErrorInfo {
  revertReason: string
  gasUsed?: bigint
  executionTrace?: any
  networkType: string
  note?: string
}

export class GanacheDebugger {
  private ganacheClient: PublicClient
  private _ganacheWallet?: WalletClient
  private isGanacheMode: boolean

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
    ganacheRpcUrl: string = 'http://localhost:8545'
  ) {
    this.isGanacheMode = ganacheRpcUrl.includes('localhost:8545') || ganacheRpcUrl.includes('127.0.0.1:8545')
    
    if (this.isGanacheMode) {
      this.ganacheClient = publicClient
      this._ganacheWallet = walletClient
    } else {
      this.ganacheClient = publicClient
      this._ganacheWallet = walletClient
    }
  }

  /**
   * Enhanced transaction debugging with Ganache-specific features
   */
  async debugTransaction(
    txHash: Hash,
    operation: string
  ): Promise<GanacheDebugInfo | null> {
    try {
      console.log(`🔍 [GANACHE DEBUG] ${operation} - Transaction Analysis:`)
      console.log(`  📋 Hash: ${txHash}`)
      
      // Get transaction details
      const tx = await this.ganacheClient.getTransaction({ hash: txHash })
      console.log(`  📤 From: ${tx.from}`)
      console.log(`  📥 To: ${tx.to}`)
      console.log(`  ⛽ Gas Limit: ${tx.gas}`)
      console.log(`  💰 Gas Price: ${tx.gasPrice} wei`)
      console.log(`  💵 Value: ${tx.value} wei`)
      console.log(`  📝 Data: ${tx.input}`)
      
      // Wait for receipt
      const receipt = await this.ganacheClient.waitForTransactionReceipt({ hash: txHash })
      console.log(`  📦 Block: ${receipt.blockNumber}`)
      console.log(`  ⛽ Gas Used: ${receipt.gasUsed}`)
      console.log(`  ✅ Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`)
      
      const debugInfo: GanacheDebugInfo = {
        transactionHash: txHash,
        from: tx.from,
        to: tx.to,
        data: tx.input,
        value: tx.value,
        gasLimit: tx.gas,
        gasPrice: tx.gasPrice || 0n,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber,
        logs: receipt.logs.map(log => ({
          address: log.address,
          topics: log.topics,
          data: log.data
        }))
      }
      
      if (receipt.status === 'reverted') {
        console.log(`  ❌ Transaction reverted`)
        
        // Try to get revert reason from Ganache
        try {
          const revertReason = await this.getRevertReason(txHash)
          if (revertReason) {
            console.log(`  🔍 Revert Reason: ${revertReason}`)
            debugInfo.revertReason = revertReason
          }
        } catch (error) {
          console.log(`  ⚠️ Could not get revert reason: ${error}`)
        }
      }
      
      return debugInfo
      
    } catch (error) {
      console.error(`❌ [GANACHE DEBUG] Error debugging transaction:`, error)
      return {
        transactionHash: txHash,
        from: '0x0' as Address,
        to: null,
        data: '',
        value: 0n,
        gasLimit: 0n,
        gasPrice: 0n,
        status: 'reverted',
        logs: [],
        error
      }
    }
  }

  /**
   * Get revert reason from Ganache using debug_traceTransaction
   */
  async getRevertReason(txHash: Hash): Promise<string | null> {
    if (!this.isGanacheMode) {
      return null
    }

    try {
      console.log(`🔍 [GANACHE DEBUG] Getting revert reason for transaction: ${txHash}`)
      
      // Try multiple tracers to get revert reason
      const tracers = [
        { tracer: 'callTracer', config: { withLog: true } },
        { tracer: 'prestateTracer', config: {} },
        { tracer: '4byteTracer', config: {} }
      ]

      for (const { tracer, config } of tracers) {
        try {
          console.log(`🔍 [GANACHE DEBUG] Trying tracer: ${tracer}`)
          const trace = await this.ganacheClient.request({
            method: 'debug_traceTransaction' as any,
            params: [txHash, { tracer, tracerConfig: config } as any]
          }) as any

          console.log(`🔍 [GANACHE DEBUG] Trace result for ${tracer}:`, JSON.stringify(trace, null, 2))

          // Extract revert reason from trace
          if (trace.error) {
            console.log(`🔍 [GANACHE DEBUG] Found error in trace: ${trace.error}`)
            return trace.error
          }

          // Look for revert in the trace structure
          const findRevert = (node: any, depth = 0): string | null => {
            const indent = '  '.repeat(depth)
            console.log(`${indent}🔍 [GANACHE DEBUG] Checking node:`, Object.keys(node))
            
            if (node.error) {
              console.log(`${indent}🔍 [GANACHE DEBUG] Found error: ${node.error}`)
              return node.error
            }
            
            if (node.revertReason) {
              console.log(`${indent}🔍 [GANACHE DEBUG] Found revert reason: ${node.revertReason}`)
              return node.revertReason
            }
            
            if (node.revert) {
              console.log(`${indent}🔍 [GANACHE DEBUG] Found revert: ${node.revert}`)
              return node.revert
            }
            
            // Check structLogs for revert operations
            if (node.structLogs && Array.isArray(node.structLogs)) {
              console.log(`${indent}🔍 [GANACHE DEBUG] Checking ${node.structLogs.length} structLogs`)
              for (let i = 0; i < node.structLogs.length; i++) {
                const log = node.structLogs[i]
                if (log.error && log.error !== '') {
                  console.log(`${indent}🔍 [GANACHE DEBUG] Found error in structLog ${i}: ${log.error}`)
                  return log.error
                }
                if (log.op === 'REVERT' && log.stack && log.stack.length > 0) {
                  console.log(`${indent}🔍 [GANACHE DEBUG] Found REVERT operation in structLog ${i}`)
                  console.log(`${indent}🔍 [GANACHE DEBUG] REVERT stack:`, log.stack)
                  
                  // For REVERT, the stack should contain [offset, length] for the revert data
                  if (log.stack.length >= 2) {
                    const offset = parseInt(log.stack[log.stack.length - 2], 16)
                    const length = parseInt(log.stack[log.stack.length - 1], 16)
                    console.log(`${indent}🔍 [GANACHE DEBUG] REVERT offset: ${offset}, length: ${length}`)
                    
                    // Look for the revert data in memory
                    if (log.memory && log.memory.length > 0) {
                      // Memory is in 32-byte words, so calculate the word index
                      const wordOffset = Math.floor(offset / 32)
                      const wordLength = Math.ceil(length / 32)
                      
                      if (wordOffset + wordLength <= log.memory.length) {
                        let revertData = ''
                        for (let j = 0; j < wordLength; j++) {
                          revertData += log.memory[wordOffset + j] || ''
                        }
                        
                        // Extract the actual data (remove padding)
                        const actualData = revertData.slice(offset % 32 * 2, (offset % 32 + length) * 2)
                        console.log(`${indent}🔍 [GANACHE DEBUG] Extracted revert data: ${actualData}`)
                        
                        if (actualData.length > 0) {
                          const reason = this.decodeRevertReason(actualData)
                          if (reason) {
                            console.log(`${indent}🔍 [GANACHE DEBUG] Decoded revert reason: ${reason}`)
                            return reason
                          }
                        }
                      }
                    }
                  }
                  
                  // Fallback: try to decode from the last stack item
                  const revertData = log.stack[log.stack.length - 1]
                  if (revertData && revertData.length > 2) {
                    const reason = this.decodeRevertReason(revertData.slice(2)) // Remove 0x prefix
                    if (reason) {
                      console.log(`${indent}🔍 [GANACHE DEBUG] Decoded revert reason from stack: ${reason}`)
                      return reason
                    }
                  }
                }
              }
            }
            
            if (node.calls && Array.isArray(node.calls)) {
              for (const call of node.calls) {
                const revert = findRevert(call, depth + 1)
                if (revert) return revert
              }
            }
            
            return null
          }

          const revertReason = findRevert(trace)
          if (revertReason) {
            console.log(`🔍 [GANACHE DEBUG] Found revert reason with ${tracer}: ${revertReason}`)
            return revertReason
          }

        } catch (tracerError) {
          console.warn(`🔍 [GANACHE DEBUG] Tracer ${tracer} failed:`, tracerError)
          continue
        }
      }

      // If all tracers fail, try a simpler approach
      console.log(`🔍 [GANACHE DEBUG] All tracers failed, trying receipt analysis`)
      try {
        const receipt = await this.ganacheClient.getTransactionReceipt({ hash: txHash })
        if (receipt.status === 'reverted') {
          // Try to get the revert reason from the receipt logs or other methods
          console.log(`🔍 [GANACHE DEBUG] Transaction reverted, receipt status: ${receipt.status}`)
          console.log(`🔍 [GANACHE DEBUG] Receipt logs:`, receipt.logs)
          
          // Check if there's a revert reason in the logs
          for (const log of receipt.logs) {
            if (log.data && log.data.length > 2) {
              try {
                // Try to decode the log data as a revert reason
                const data = log.data.slice(2) // Remove 0x prefix
                if (data.startsWith('08c379a0')) { // Error(string) selector
                  const reason = this.decodeRevertReason(data)
                  if (reason) {
                    console.log(`🔍 [GANACHE DEBUG] Found revert reason in logs: ${reason}`)
                    return reason
                  }
                }
              } catch (decodeError) {
                console.warn('Failed to decode log data:', decodeError)
              }
            }
          }
        }
      } catch (receiptError) {
        console.warn('Failed to get transaction receipt:', receiptError)
      }

      // Final fallback: try to simulate the transaction to get the error
      console.log(`🔍 [GANACHE DEBUG] Trying simulation fallback for transaction: ${txHash}`)
      try {
        const tx = await this.ganacheClient.getTransaction({ hash: txHash })
        const simulation = await this.simulateTransaction(tx.from, tx.to || '0x0000000000000000000000000000000000000000', tx.input, tx.value)
        
        if (!simulation.success && simulation.error) {
          console.log(`🔍 [GANACHE DEBUG] Found revert reason via simulation: ${simulation.error}`)
          return simulation.error
        }
      } catch (simError) {
        console.warn(`🔍 [GANACHE DEBUG] Simulation fallback failed:`, simError)
      }

      console.log(`🔍 [GANACHE DEBUG] Could not extract revert reason from transaction: ${txHash}`)
      return null
    } catch (error) {
      console.warn(`🔍 [GANACHE DEBUG] Error getting revert reason:`, error)
      return null
    }
  }

  /**
   * Decode revert reason from hex data using Guardian contract error utilities
   */
  private decodeRevertReason(data: string): string | null {
    try {
      console.log(`🔍 [GANACHE DEBUG] Decoding revert reason from data: ${data}`)
      
      // Use the official Guardian contract error decoder
      const errorInfo = extractErrorInfo(data)
      
      if (errorInfo.error) {
        console.log(`🔍 [GANACHE DEBUG] Decoded contract error:`, errorInfo.error)
        console.log(`🔍 [GANACHE DEBUG] User-friendly message: ${errorInfo.userMessage}`)
        console.log(`🔍 [GANACHE DEBUG] Is known error: ${errorInfo.isKnownError}`)
        
        // Return the user-friendly message
        return errorInfo.userMessage
      }
      
      // Fallback to the original decoding logic for unknown errors
      console.log(`🔍 [GANACHE DEBUG] Using fallback decoding for unknown error`)
      
      // Ensure data is hex string without 0x prefix
      if (data.startsWith('0x')) {
        data = data.slice(2)
      }
      
      // Check if it starts with Error(string) selector (0x08c379a0)
      if (data.length >= 8 && data.startsWith('08c379a0')) {
        console.log(`🔍 [GANACHE DEBUG] Detected Error(string) selector`)
        const stringData = data.slice(8) // Remove selector
        if (stringData.length < 64) return null
        
        // Get the length of the string (first 32 bytes after selector)
        const lengthHex = stringData.slice(0, 64)
        const length = parseInt(lengthHex, 16)
        
        if (length <= 0 || length > 1000) return null // Sanity check
        
        // Get the string data (after length)
        const stringHex = stringData.slice(64, 64 + length * 2)
        const bytes = Buffer.from(stringHex, 'hex')
        const result = bytes.toString('utf8').replace(/\0/g, '') // Remove null bytes
        console.log(`🔍 [GANACHE DEBUG] Decoded Error(string): ${result}`)
        return result
      }
      
      // Check if it's a simple string (no selector)
      if (data.length >= 64) {
        // Try to decode as ABI-encoded string
        const lengthHex = data.slice(0, 64)
        const length = parseInt(lengthHex, 16)
        
        if (length > 0 && length <= 1000 && data.length >= 64 + length * 2) {
          const stringHex = data.slice(64, 64 + length * 2)
          const bytes = Buffer.from(stringHex, 'hex')
          const result = bytes.toString('utf8').replace(/\0/g, '')
          console.log(`🔍 [GANACHE DEBUG] Decoded simple string: ${result}`)
          return result
        }
      }
      
      // Try to find readable strings in the data using common patterns
      if (data.length > 0) {
        try {
          // Convert hex to string and look for readable parts
          const bytes = Buffer.from(data, 'hex')
          const hexString = data.toLowerCase()
          
          // Check for common revert strings in hex using the official patterns
          for (const revertString of COMMON_ERROR_PATTERNS) {
            const hexPattern = Buffer.from(revertString, 'utf8').toString('hex')
            if (hexString.includes(hexPattern)) {
              console.log(`🔍 [GANACHE DEBUG] Found revert string in hex: ${revertString}`)
              return revertString
            }
          }
          
          // Try to extract readable ASCII from the data
          let readableText = ''
          for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i]
            if (byte >= 32 && byte <= 126) { // Printable ASCII
              readableText += String.fromCharCode(byte)
            } else if (byte === 0) {
              readableText += ' ' // Replace null bytes with spaces
            }
          }
          
          // Clean up the text
          readableText = readableText.trim().replace(/\s+/g, ' ')
          
          if (readableText.length > 3 && readableText.length < 200) {
            console.log(`🔍 [GANACHE DEBUG] Extracted readable text: ${readableText}`)
            return readableText
          }
          
          // Try UTF-8 decoding as fallback
          const utf8Result = bytes.toString('utf8').replace(/\0/g, '').trim()
          if (utf8Result.length > 0 && utf8Result.length < 200) {
            console.log(`🔍 [GANACHE DEBUG] Decoded UTF-8: ${utf8Result}`)
            return utf8Result
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
      
      console.log(`🔍 [GANACHE DEBUG] Could not decode revert reason from data: ${data}`)
      return null
    } catch (error) {
      console.warn('Failed to decode revert reason:', error)
      return null
    }
  }

  /**
   * Monitor all transactions in real-time
   */
  async startTransactionMonitoring(): Promise<void> {
    if (!this.isGanacheMode) return

    console.log('🔍 [GANACHE DEBUG] Starting transaction monitoring...')
    
    // Subscribe to new blocks
    this.ganacheClient.watchBlocks({
      onBlock: async (block) => {
        console.log(`📦 [GANACHE DEBUG] New block: ${block.number}`)
        
        // Check each transaction in the block
        for (const txHash of block.transactions) {
          if (typeof txHash === 'string') {
            try {
              const receipt = await this.ganacheClient.getTransactionReceipt({ hash: txHash as Hash })
              if (receipt.status === 'reverted') {
                console.log(`❌ [GANACHE DEBUG] Reverted transaction detected: ${txHash}`)
                await this.debugTransaction(txHash as Hash, 'MONITORED')
              }
            } catch (error) {
              // Transaction might not be available yet
            }
          }
        }
      }
    })
  }

  /**
   * Simulate transaction before sending using debug_traceCall
   */
  async simulateTransaction(
    from: Address,
    to: Address,
    data: string,
    value: bigint = 0n
  ): Promise<{ success: boolean; gasEstimate: bigint; error?: string; trace?: any }> {
    try {
      console.log(`🔍 [GANACHE DEBUG] Simulating transaction...`)
      console.log(`  📤 From: ${from}`)
      console.log(`  📥 To: ${to}`)
      console.log(`  📝 Data: ${data}`)
      console.log(`  💵 Value: ${value} wei`)
      
      // Estimate gas
      const gasEstimate = await this.ganacheClient.estimateGas({
        to,
        data: data as `0x${string}`,
        value,
        account: from
      })
      
      console.log(`  ⛽ Gas Estimate: ${gasEstimate}`)
      
      // Try to call the function to see if it would revert
      try {
        await this.ganacheClient.call({
          to,
          data: data as `0x${string}`,
          value,
          account: from
        })
        
        console.log(`  ✅ Simulation successful`)
        return { success: true, gasEstimate }
      } catch (error: any) {
        console.log(`  ❌ Simulation failed: ${error.message}`)
        
        // Try to extract revert reason from error message
        let revertReason = error.message
        
        // Check if it's a revert error with encoded data
        if (error.message.includes('revert')) {
          // Look for revert reason in error data
          const revertMatch = error.message.match(/revert\s+(0x[a-fA-F0-9]+)/)
          if (revertMatch) {
            const encodedData = revertMatch[1]
            const decoded = this.decodeRevertReason(encodedData.slice(2))
            if (decoded) {
              revertReason = decoded
              console.log(`  🔍 Extracted revert reason: ${revertReason}`)
            }
          }
        }
        
        // Get detailed trace if available
        let trace = null
        if (this.isGanacheMode) {
          try {
            trace = await this.ganacheClient.request({
              method: 'debug_traceCall' as any,
              params: [
                {
                  from,
                  to,
                  data: data as `0x${string}`,
                  value: `0x${value.toString(16)}` as `0x${string}`
                },
                'latest',
                {
                  tracer: 'callTracer',
                  tracerConfig: {
                    withLog: true,
                    timeout: '10s'
                  }
                }
              ]
            }) as any
          } catch (traceError) {
            console.warn('Failed to get trace details:', traceError)
          }
        }
        
        return { success: false, gasEstimate, error: revertReason, trace }
      }
      
    } catch (error: any) {
      console.error(`❌ [GANACHE DEBUG] Simulation error:`, error)
      return { success: false, gasEstimate: 0n, error: error.message }
    }
  }

  /**
   * Log contract state for debugging
   */
  async logContractState(contractAddress: Address, operation: string): Promise<void> {
    if (!this.isGanacheMode) return

    try {
      console.log(`🔍 [GANACHE DEBUG] Contract state for ${operation}:`)
      console.log(`  📋 Contract: ${contractAddress}`)
      
      // Get current block number
      const blockNumber = await this.ganacheClient.getBlockNumber()
      console.log(`  📦 Current Block: ${blockNumber}`)
      
      // Get contract code
      const code = await this.ganacheClient.getCode({ address: contractAddress })
      console.log(`  📝 Contract Code: ${code === '0x' ? 'NOT DEPLOYED' : 'DEPLOYED'}`)
      
    } catch (error) {
      console.warn(`⚠️ [GANACHE DEBUG] Could not get contract state:`, error)
    }
  }

  /**
   * Log transaction start
   */
  logTransactionStart(operation: string, details: Record<string, any>): void {
    console.log(`🚀 [GANACHE DEBUG] Starting ${operation}:`)
    Object.entries(details).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`)
    })
  }

  /**
   * Log transaction success
   */
  logTransactionSuccess(operation: string, details: string): void {
    console.log(`✅ [GANACHE DEBUG] ${operation} successful: ${details}`)
  }

  /**
   * Log transaction error
   */
  logTransactionError(operation: string, error: any): void {
    console.error(`❌ [GANACHE DEBUG] ${operation} failed:`, error)
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number
    blockNumber: bigint
    isGanache: boolean
  }> {
    try {
      const chainId = await this.ganacheClient.getChainId()
      const blockNumber = await this.ganacheClient.getBlockNumber()
      
      return {
        chainId,
        blockNumber,
        isGanache: this.isGanacheMode
      }
    } catch (error) {
      console.error('Failed to get network info:', error)
      throw error
    }
  }
}

/**
 * Create a Ganache debugger instance
 */
export function createGanacheDebugger(
  publicClient: PublicClient,
  walletClient?: WalletClient,
  ganacheRpcUrl?: string
): GanacheDebugger {
  return new GanacheDebugger(publicClient, walletClient, ganacheRpcUrl)
}

/**
 * Quick debug function for immediate use
 */
export async function debugGanacheTransaction(
  publicClient: PublicClient,
  txHash: string,
  operation: string
): Promise<GanacheDebugInfo | null> {
  const ganacheDebugger = new GanacheDebugger(publicClient)
  return await ganacheDebugger.debugTransaction(txHash as Hash, operation)
}
