import { useOperationHistory } from '../../../hooks/useOperationHistory'
import { TxRecord } from '../../../particle-core/sdk/typescript/interfaces/lib.index'
import { Address, Hex } from 'viem'
import { useMemo } from 'react'

// Valid operation types for SimpleRWA20
export const RWA20_OPERATIONS = {
  MINT_TOKENS: "MINT_TOKENS",
  BURN_TOKENS: "BURN_TOKENS"
} as const;

export type RWA20OperationType = typeof RWA20_OPERATIONS[keyof typeof RWA20_OPERATIONS];

interface UseSimpleRWA20OperationsProps {
  contractAddress: Address
  operations: TxRecord[]
  isLoading?: boolean
}

export function useSimpleRWA20Operations({
  contractAddress,
  operations,
  isLoading = false
}: UseSimpleRWA20OperationsProps) {
  const {
    filteredOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    getOperationName,
    operationTypes,
    loadingTypes
  } = useOperationHistory({
    contractAddress,
    operations,
    isLoading
  })

  // Filter for RWA20-specific operations
  const rwa20Operations = useMemo(() => {
    return filteredOperations.filter(op => {
      const operationType = getOperationName(op.params.operationType as Hex)
      return Object.values(RWA20_OPERATIONS).includes(operationType as RWA20OperationType)
    })
  }, [filteredOperations, getOperationName])

  // Filter operation types to only show RWA20 operations
  const rwa20OperationTypes = useMemo(() => {
    const filteredTypes = new Map<Hex, string>()
    operationTypes.forEach((value, key) => {
      if (Object.values(RWA20_OPERATIONS).includes(value as RWA20OperationType)) {
        filteredTypes.set(key, value)
      }
    })
    return filteredTypes
  }, [operationTypes])

  return {
    operations: rwa20Operations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    getOperationName,
    operationTypes: rwa20OperationTypes,
    isLoading: isLoading || loadingTypes
  }
} 