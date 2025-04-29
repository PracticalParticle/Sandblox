import { Address } from 'viem';

/**
 * Parameters for SimpleVault operations
 */

export interface WithdrawEthParams {
  to: Address;
  amount: bigint;
}

export interface WithdrawTokenParams {
  token: Address;
  to: Address;
  amount: bigint;
}

/**
 * Type guard functions for runtime type validation
 */

export function isWithdrawEthParams(params: any): params is WithdrawEthParams {
  return (
    params &&
    typeof params === 'object' &&
    'to' in params &&
    typeof params.to === 'string' &&
    'amount' in params &&
    typeof params.amount === 'bigint'
  );
}

export function isWithdrawTokenParams(params: any): params is WithdrawTokenParams {
  return (
    params &&
    typeof params === 'object' &&
    'token' in params &&
    typeof params.token === 'string' &&
    'to' in params &&
    typeof params.to === 'string' &&
    'amount' in params &&
    typeof params.amount === 'bigint'
  );
}

/**
 * Validates operation parameters at runtime
 * @param operationType The operation type
 * @param params The parameters to validate
 * @returns Whether the parameters are valid for the operation type
 */
export function validateVaultOperationParams(operationType: string, params: any): boolean {
  switch (operationType) {
    case 'WITHDRAW_ETH':
      return isWithdrawEthParams(params);
    case 'WITHDRAW_TOKEN':
      return isWithdrawTokenParams(params);
    default:
      // For unknown operations, just check if params is an object
      return params && typeof params === 'object';
  }
}
