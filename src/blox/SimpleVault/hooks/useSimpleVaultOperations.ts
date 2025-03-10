import { useOperationHistory } from '../../../hooks/useOperationHistory'
import { TxRecord } from '../../../particle-core/sdk/typescript/interfaces/lib.index'
import { Address, Hex } from 'viem'
import { useMemo } from 'react'

// Valid operation types for SimpleVault
export const VAULT_OPERATIONS = {
  WITHDRAW_ETH: "WITHDRAW_ETH",
  WITHDRAW_TOKEN: "WITHDRAW_TOKEN"
} as const;

export type VaultOperationType = typeof VAULT_OPERATIONS[keyof typeof VAULT_OPERATIONS];

export interface UseSimpleVaultOperationsProps {
  contractAddress: Address
  operations: TxRecord[]
  isLoading?: boolean
}

export function useSimpleVaultOperations({
  contractAddress,
  operations,
  isLoading = false
}: UseSimpleVaultOperationsProps) {
  const {
    filteredOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    selectedRecord,
    isDetailsOpen,
    setIsDetailsOpen,
    handleRowClick,
    getOperationName,
    operationTypes,
    loadingTypes
  } = useOperationHistory({
    contractAddress,
    operations,
    isLoading
  })

  // Filter for vault-specific operations
  const vaultOperations = useMemo(() => {
    return filteredOperations.filter(op => {
      const operationType = getOperationName(op.params.operationType as Hex)
      return Object.values(VAULT_OPERATIONS).includes(operationType as VaultOperationType)
    })
  }, [filteredOperations, getOperationName])

  // Filter operation types to only show vault operations
  const vaultOperationTypes = useMemo(() => {
    const filteredTypes = new Map<Hex, string>()
    operationTypes.forEach((value, key) => {
      if (Object.values(VAULT_OPERATIONS).includes(value as VaultOperationType)) {
        filteredTypes.set(key, value)
      }
    })
    return filteredTypes
  }, [operationTypes])

  return {
    operations: vaultOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    selectedRecord,
    isDetailsOpen,
    setIsDetailsOpen,
    handleRowClick,
    getOperationName,
    operationTypes: vaultOperationTypes,
    isLoading: isLoading || loadingTypes
  }
} 