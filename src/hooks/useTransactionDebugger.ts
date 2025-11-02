import { usePublicClient } from 'wagmi'
import { useMemo } from 'react'
import { createTransactionDebugger } from '@/lib/transaction-debugger'

export function useTransactionDebugger() {
  const publicClient = usePublicClient()
  
  const txDebugger = useMemo(() => {
    if (!publicClient) return null
    return createTransactionDebugger(publicClient)
  }, [publicClient])

  return {
    debugger: txDebugger,
    isAvailable: !!txDebugger
  }
}
