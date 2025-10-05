import { useState, useEffect, useMemo } from 'react'
import { TxRecord } from '../Guardian/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '../Guardian/sdk/typescript/types/lib.index'
import { Address, Hex } from 'viem'
import { useOperationTypes } from './useOperationTypes'

export interface UseOperationHistoryProps {
  contractAddress: Address
  operations: TxRecord[]
  isLoading?: boolean
}

export interface UseOperationHistoryReturn {
  sortedOperations: TxRecord[]
  filteredOperations: TxRecord[]
  statusFilter: string
  operationTypeFilter: string
  setStatusFilter: (value: string) => void
  setOperationTypeFilter: (value: string) => void
  isLoading: boolean
  getOperationName: (type: Hex) => string
  operationTypes: Map<Hex, string>
  loadingTypes: boolean
}

// Status to human-readable text mapping
export const statusToHuman: { [key: number]: string } = {
  [TxStatus.UNDEFINED]: 'Undefined',
  [TxStatus.PENDING]: 'Pending',
  [TxStatus.CANCELLED]: 'Cancelled',
  [TxStatus.COMPLETED]: 'Completed',
  [TxStatus.FAILED]: 'Failed',
  [TxStatus.REJECTED]: 'Rejected'
}

export function useOperationHistory({
  contractAddress,
  operations,
  isLoading = false
}: UseOperationHistoryProps): UseOperationHistoryReturn {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all')

  const { getOperationName, operationTypes: rawOperationTypes, loading: loadingTypes } = useOperationTypes(contractAddress)

  // Convert operation types to the correct Hex type (stable memo)
  const operationTypes = useMemo(
    () => new Map(Array.from(rawOperationTypes.entries()).map(([key, value]) => [key as Hex, value])),
    [rawOperationTypes]
  )

  // Derive sorted operations (stable memo)
  const sortedOperations = useMemo(() => {
    if (!operations || operations.length === 0) return []
    // Sort by txId desc (newest first)
    return [...operations].sort((a, b) => Number(b.txId - a.txId))
  }, [operations])

  // Derive filtered operations (stable memo)
  const filteredOperations = useMemo(() => {
    let filtered = sortedOperations

    if (statusFilter !== 'all') {
      filtered = filtered.filter(op => op.status === parseInt(statusFilter))
    }

    if (operationTypeFilter !== 'all') {
      filtered = filtered.filter(op => op.params.operationType === operationTypeFilter)
    }

    return filtered
  }, [sortedOperations, statusFilter, operationTypeFilter])

  return {
    sortedOperations,
    filteredOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    isLoading,
    getOperationName,
    operationTypes,
    loadingTypes
  }
} 