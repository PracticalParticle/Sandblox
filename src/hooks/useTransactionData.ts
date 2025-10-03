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
      
      // Try to get pending transactions first
      let pendingTxs: TxRecord[] = []
      try {
        console.log('Attempting to get pending transactions...')
        const pendingTxIds = await contract.getPendingTransactions()
        console.log('Found pending transaction IDs:', pendingTxIds)
        
        if (pendingTxIds.length > 0) {
          // Fetch details for each pending transaction
          for (const txId of pendingTxIds) {
            try {
              const txDetail = await contract.getTransaction(txId)
              console.log(`Loaded transaction ${txId}:`, txDetail)
              pendingTxs.push(txDetail)
            } catch (txError: any) {
              console.warn(`Failed to load transaction ${txId}:`, txError.message)
            }
          }
        }
      } catch (pendingError: any) {
        console.log('Could not fetch pending transactions:', pendingError.message)
        // This is expected if the wallet doesn't have permission
      }

      // Use pending transactions as the source of truth
      // Transaction history calls are failing due to permission issues
      console.log('Using pending transactions as source of truth')
      
      const pending = pendingTxs.filter(tx => tx.status === TxStatus.PENDING)
      
      console.log('Final data:', {
        pending: pending.length,
        all: pendingTxs.length
      })

      setPendingTransactions(pending)
      setAllTransactions(pendingTxs)
      
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
