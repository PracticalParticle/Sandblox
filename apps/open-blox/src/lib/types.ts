import { Address } from 'viem'

export interface SecurityOperationEvent {
  type: 'ownership' | 'broadcaster' | 'recovery' | 'timelock';
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: number;
  description: string;
  details?: {
    oldValue?: string;
    newValue?: string;
    remainingTime?: number;
  };
}

export interface SecureContractInfo {
  address: Address;
  owner: Address;
  broadcaster: Address;
  recoveryAddress: Address;
  timeLockPeriodInDays: number;
  pendingOperations?: SecurityOperationEvent[];
  recentEvents?: SecurityOperationEvent[];
} 