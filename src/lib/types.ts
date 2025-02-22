import { Address } from 'viem'

export interface SecurityOperationDetails {
  oldValue?: string;
  newValue?: string;
  remainingTime?: number;
}

export interface SecurityOperationEvent {
  type: 'ownership' | 'broadcaster' | 'recovery' | 'timelock';
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: number;
  description: string;
  details?: SecurityOperationDetails;
}

export interface SecureContractInfo {
  address: Address;
  owner: Address;
  broadcaster: Address;
  recoveryAddress: Address;
  timeLockPeriodInDays: number;
  pendingOperations?: SecurityOperationEvent[];
  recentEvents?: SecurityOperationEvent[];
  chainId: number;
  chainName: string;
}

export interface ContractInfo {
  address: Address;
  type: 'secure-ownable' | 'unknown';
  name?: string;
  description?: string;
  category?: string;
  bloxId?: string;
} 