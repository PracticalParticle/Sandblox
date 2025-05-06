import { Address } from 'viem';

/**
 * Parameters for SimpleRWA20 operations
 */

export interface MintTokensParams {
  to: Address;
  amount: bigint;
}

export interface BurnTokensParams {
  from: Address;
  amount: bigint;
}

/**
 * Type guard functions for runtime type validation
 */

export function isMintTokensParams(params: any): params is MintTokensParams {
  return (
    params &&
    typeof params === 'object' &&
    'to' in params &&
    typeof params.to === 'string' &&
    'amount' in params &&
    (typeof params.amount === 'bigint' ||
      typeof params.amount === 'string' || // JSON payload
      typeof params.amount === 'number')   // UI form input
  );
}

export function isBurnTokensParams(params: any): params is BurnTokensParams {
  return (
    params &&
    typeof params === 'object' &&
    'from' in params &&
    typeof params.from === 'string' &&
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
export function validateRWA20OperationParams(operationType: string, params: any): boolean {
  switch (operationType) {
    case 'MINT_TOKENS':
      return isMintTokensParams(params);
    case 'BURN_TOKENS':
      return isBurnTokensParams(params);
    default:
      // Unknown operation → invalid
      return false;
  }
}
