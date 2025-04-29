import { Address } from 'viem';

/**
 * Parameters for GuardianSafe operations
 */
export interface SafeTxParams {
  to: Address;
  value: bigint;
  data: string;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  signatures: string;
}

/**
 * Type guard to check if parameters match SafeTxParams interface
 */
export function isSafeTxParams(params: any): params is SafeTxParams {
  return (
    params &&
    typeof params === 'object' &&
    'to' in params &&
    typeof params.to === 'string' &&
    'value' in params &&
    typeof params.value === 'bigint' &&
    'data' in params &&
    typeof params.data === 'string' &&
    'operation' in params &&
    typeof params.operation === 'number' &&
    'safeTxGas' in params &&
    typeof params.safeTxGas === 'bigint' &&
    'baseGas' in params &&
    typeof params.baseGas === 'bigint' &&
    'gasPrice' in params &&
    typeof params.gasPrice === 'bigint' &&
    'gasToken' in params &&
    typeof params.gasToken === 'string' &&
    'refundReceiver' in params &&
    typeof params.refundReceiver === 'string' &&
    'signatures' in params &&
    typeof params.signatures === 'string'
  );
}

/**
 * Validates operation parameters at runtime
 * @param operationType The operation type
 * @param params The parameters to validate
 * @returns Whether the parameters are valid for the operation type
 */
export function validateSafeOperationParams(operationType: string, params: any): boolean {
  switch (operationType) {
    case 'EXEC_SAFE_TX':
      return isSafeTxParams(params);
    default:
      // For unknown operations, just check if params is an object
      return params && typeof params === 'object';
  }
}
