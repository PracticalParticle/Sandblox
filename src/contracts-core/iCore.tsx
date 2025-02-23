import { Address, Hash, TransactionReceipt } from 'viem';

/**
 * Interface for ERC20 Token standard
 */
export interface IERC20 {
  // Read-only functions
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  totalSupply(): Promise<bigint>;
  balanceOf(account: Address): Promise<bigint>;
  allowance(owner: Address, spender: Address): Promise<bigint>;
  
  // State-changing functions
  transfer(recipient: Address, amount: bigint): Promise<TransactionResult>;
  approve(spender: Address, amount: bigint): Promise<TransactionResult>;
  transferFrom(sender: Address, recipient: Address, amount: bigint): Promise<TransactionResult>;
  
  // Optional metadata
  logo?: string;
  website?: string;
}

/**
 * Represents the result of a blockchain transaction, providing both immediate hash
 * and the ability to wait for confirmation
 */
export interface TransactionResult {
  /** The transaction hash returned immediately after submission */
  hash: Hash;
  /** Function to wait for transaction confirmation and get the receipt */
  wait: () => Promise<TransactionReceipt>;
}

// Common transaction options interface used across all contracts
export interface TransactionOptions {
  from?: Address;
  gas?: number;
  gasPrice?: string;
  value?: string;
}

// SecureOwnable types and constants
export const SecurityOperationType = {
  OWNERSHIP_UPDATE: 'OWNERSHIP_UPDATE',
  BROADCASTER_UPDATE: 'BROADCASTER_UPDATE',
  RECOVERY_UPDATE: 'RECOVERY_UPDATE',
  TIMELOCK_UPDATE: 'TIMELOCK_UPDATE'
} as const;

export type SecurityOperationType = typeof SecurityOperationType[keyof typeof SecurityOperationType];

export const TxStatus = {
  UNDEFINED: 0,
  PENDING: 1,
  CANCELLED: 2,
  COMPLETED: 3,
  FAILED: 4,
  REJECTED: 5
} as const;

export type TxStatus = typeof TxStatus[keyof typeof TxStatus];

export const ExecutionType = {
  NONE: 0,
  STANDARD: 1,
  RAW: 2
} as const;

export type ExecutionType = typeof ExecutionType[keyof typeof ExecutionType];

export interface StandardExecutionOptions {
  functionSelector: string;
  params: string;
}

export interface RawExecutionOptions {
  rawTxData: string;
}

export interface TxRecord {
  txId: number;
  releaseTime: number;
  status: TxStatus;
  requester: Address;
  target: Address;
  operationType: SecurityOperationType;
  executionType: ExecutionType;
  executionOptions: string;
  value: string;
  gasLimit: number;
  result: string;
  payment: PaymentDetails;
}

// Meta Transaction interface
export interface MetaTransaction {
  txRecord: TxRecord;
  chainId: number;
  handlerContract: Address;
  handlerSelector: string;
  nonce: number;
  deadline: number;
  maxGasPrice: string;
  signer: Address;
  signature: string;
  data: string;
}

// Broadcaster interfaces
export interface PaymentDetails {
  recipient: Address;
  nativeTokenAmount: string;
  erc20TokenAddress: Address;
  erc20TokenAmount: string;
}

export interface PaymentResult {
  success: boolean;
  payment: PaymentDetails;
}

// Recovery interfaces
export interface RecoveryConfig {
  recoveryAddress: Address;
  timeLockPeriodInDays: number;
  lastRecoveryTime: number;
}