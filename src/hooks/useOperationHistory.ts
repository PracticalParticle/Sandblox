import { useState, useEffect } from 'react'
import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '../particle-core/sdk/typescript/types/lib.index'
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
  const [sortedOperations, setSortedOperations] = useState<TxRecord[]>([])
  const [filteredOperations, setFilteredOperations] = useState<TxRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all')

  const { getOperationName, operationTypes: rawOperationTypes, loading: loadingTypes } = useOperationTypes(contractAddress)

  // Convert operation types to the correct Hex type
  const operationTypes = new Map(
    Array.from(rawOperationTypes.entries()).map(([key, value]) => [key as Hex, value])
  )

  // Update sorted operations when operations change
  useEffect(() => {
    // Sort operations by txId in descending order (newest first)
    const sorted = [...operations].sort((a, b) => 
      Number(b.txId - a.txId)
    )
    setSortedOperations(sorted)
  }, [operations])

  // Update filtered operations when filters or sorted operations change
  useEffect(() => {
    // Apply filters
    let filtered = [...sortedOperations]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(op => op.status === parseInt(statusFilter))
    }

    if (operationTypeFilter !== 'all') {
      filtered = filtered.filter(op => op.params.operationType === operationTypeFilter)
    }

    setFilteredOperations(filtered)
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