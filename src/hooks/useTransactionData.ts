import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useWalletClient } from 'wagmi'
import { SecureOwnable } from '../Guardian/sdk/typescript'
import { TxRecord, TxStatus } from '../Guardian/sdk/typescript'
import { Address, Chain } from 'viem'

interface UseTransactionDataProps {
  contractAddress: Address
  chain: Chain
}

interface TransactionData {
  pendingTransactions: TxRecord[]
  allTransactions: TxRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useTransactionData({ 
  contractAddress, 
  chain 
}: UseTransactionDataProps): TransactionData {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [pendingTransactions, setPendingTransactions] = useState<TxRecord[]>([])
  const [allTransactions, setAllTransactions] = useState<TxRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactionData = useCallback(async () => {
    if (!publicClient || !contractAddress) {
      console.log('Missing publicClient or contractAddress')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      console.log('Creating SecureOwnable instance...')
      const contract = new SecureOwnable(
        publicClient,
        walletClient,
        contractAddress,
        chain
      )

      console.log('Fetching transaction data from contract...')
      
      let allTxs: TxRecord[] = []
      let pendingTxs: TxRecord[] = []
      
      // First, try to get pending transactions
      try {
        console.log('Attempting to get pending transactions...')
        const pendingTxIds = await contract.getPendingTransactions()
        console.log('Found pending transaction IDs:', pendingTxIds)
        
        if (pendingTxIds.length > 0) {
          // Fetch details for each pending transaction
          for (const txId of pendingTxIds) {
            try {
              const txDetail = await contract.getTransaction(txId)
              console.log(`Loaded pending transaction ${txId}:`, txDetail)
              pendingTxs.push(txDetail)
              allTxs.push(txDetail)
            } catch (txError: any) {
              console.warn(`Failed to load pending transaction ${txId}:`, txError.message)
            }
          }
        }
      } catch (pendingError: any) {
        console.log('Could not fetch pending transactions:', pendingError.message)
        // This is expected if the wallet doesn't have permission
      }

      // Now try to get transaction history to find completed/cancelled transactions
      try {
        console.log('Attempting to get transaction history...')
        
        // Get a reasonable range for transaction history
        // Start from transaction ID 1 and go up to a reasonable number
        const startTxId = 1n
        const endTxId = 100n // Adjust this range as needed
        
        console.log(`Fetching transaction history from ${startTxId} to ${endTxId}...`)
        const historyTxs = await contract.getTransactionHistory(startTxId, endTxId)
        console.log(`Found ${historyTxs.length} transactions in history`)
        
        // Add history transactions that aren't already in our list
        for (const historyTx of historyTxs) {
          const existingTx = allTxs.find(tx => tx.txId === historyTx.txId)
          if (!existingTx) {
            console.log(`Adding history transaction ${historyTx.txId} with status ${historyTx.status}`)
            allTxs.push(historyTx)
          }
        }
        
        // Sort all transactions by transaction ID
        allTxs.sort((a, b) => Number(a.txId) - Number(b.txId))
        
      } catch (historyError: any) {
        console.log('Could not fetch transaction history:', historyError.message)
        // This might fail due to permission issues, but we'll continue with what we have
      }

      // If we still don't have any transactions, try to get individual transactions
      if (allTxs.length === 0) {
        console.log('No transactions found, trying to fetch individual transactions...')
        
        // Try to fetch individual transactions starting from 1
        for (let i = 1; i <= 10; i++) {
          try {
            const txDetail = await contract.getTransaction(BigInt(i))
            console.log(`Found individual transaction ${i}:`, txDetail)
            allTxs.push(txDetail)
          } catch (txError: any) {
            // Transaction doesn't exist or we don't have permission
            console.log(`Transaction ${i} not found or no permission:`, txError.message)
            break // Stop trying if we hit a non-existent transaction
          }
        }
      }
      
      // Filter pending transactions
      const pending = allTxs.filter(tx => tx.status === TxStatus.PENDING)
      
      console.log('Final transaction data:', {
        total: allTxs.length,
        pending: pending.length,
        completed: allTxs.filter(tx => tx.status === TxStatus.COMPLETED).length,
        cancelled: allTxs.filter(tx => tx.status === TxStatus.CANCELLED).length,
        failed: allTxs.filter(tx => tx.status === TxStatus.FAILED).length,
        rejected: allTxs.filter(tx => tx.status === TxStatus.REJECTED).length
      })

      setPendingTransactions(pending)
      setAllTransactions(allTxs)
      
    } catch (error: any) {
      console.error('Error fetching transaction data:', error)
      setError(error.message || 'Failed to fetch transaction data')
      setPendingTransactions([])
      setAllTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, walletClient, contractAddress, chain])

  // Initial fetch
  useEffect(() => {
    fetchTransactionData()
  }, [fetchTransactionData])

  return {
    pendingTransactions,
    allTransactions,
    isLoading,
    error,
    refresh: fetchTransactionData
  }
}
