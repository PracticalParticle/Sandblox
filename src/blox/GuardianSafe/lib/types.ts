import { Address, Hex } from 'viem';
import { TxStatus } from '../../../particle-core/sdk/typescript/types/lib.index';
import { TxParams, TxRecord } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { SafeTx } from '../GuardianSafe';

export interface NotificationMessage {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

/**
 * Parameters for meta-transaction generation
 */
export interface SafeMetaTxParams {
  deadline: bigint;
  maxGasPrice: bigint;
}

/**
 * Operation types supported by GuardianSafe
 */
export type SafeOperationType = 'EXEC_SAFE_TX';

/**
 * Represents a transaction record with GuardianSafe-specific details
 */
export interface SafeTxRecord extends Omit<TxRecord, 'status' | 'params'> {
  status: TxStatus;
  safeTx?: SafeTx;
  to: Address;
  value: bigint;
  operation: number;
  data?: Hex;
  type: 'TRANSACTION';
  params: TxParams & {
    operationType: Hex;
  };
}

/**
 * Extended SafeTx with additional metadata for UI
 */
export interface EnhancedSafeTx extends SafeTx {
  description?: string;
  createdAt?: number;
  status?: TxStatus;
  txId?: string;
}
