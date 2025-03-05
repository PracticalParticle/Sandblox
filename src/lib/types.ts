import { Address } from 'viem'
import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'

export type OperationType = 'ownership' | 'broadcaster' | 'recovery' | 'timelock'

export enum ExecutionType {
  NONE = 0,
  STANDARD = 1,
  RAW = 2
}

export type PaymentDetails = {
  recipient: Address
  nativeTokenAmount: bigint
  erc20TokenAddress: Address
  erc20TokenAmount: bigint
}

export type SecurityOperationDetails = {
  oldValue: string
  newValue: string
  remainingTime: number
}

export type SecurityOperationEvent = {
  type: OperationType
  status: 'pending' | 'completed' | 'cancelled'
  timestamp: number
  description: string
  details: SecurityOperationDetails
}

export type SecureContractInfo = {
  address: Address
  owner: Address
  broadcaster: Address
  recoveryAddress: Address
  timeLockPeriodInMinutes: number
  pendingOperations: SecurityOperationEvent[]
  recentEvents: SecurityOperationEvent[]
  chainId: number
  chainName: string
  operationHistory: TxRecord[]
}

export interface ContractInfo {
  address: Address;
  type: 'secure-ownable' | 'unknown';
  name?: string;
  description?: string;
  category?: string;
  bloxId?: string;
} 