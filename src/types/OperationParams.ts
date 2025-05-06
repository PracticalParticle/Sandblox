import { Address } from 'viem';

/**
 * Parameters for core operations
 */

export interface BroadcasterUpdateParams {
  newBroadcaster: Address;
}

export interface RecoveryUpdateParams {
  newRecoveryAddress: Address;
}

export interface TimeLockUpdateParams {
  newTimeLockPeriodInMinutes: bigint;
}

/**
 * Union type for core operation parameters
 * This is used to provide type safety for operation parameters
 */
export type OperationParams =
  | BroadcasterUpdateParams
  | RecoveryUpdateParams
  | TimeLockUpdateParams
  | Record<string, any>; // Fallback for custom operations

/**
 * Type guard functions for runtime type validation
 */

export function isBroadcasterUpdateParams(params: any): params is BroadcasterUpdateParams {
  return (
    params &&
    typeof params === 'object' &&
    'newBroadcaster' in params &&
    typeof params.newBroadcaster === 'string'
  );
}

export function isRecoveryUpdateParams(params: any): params is RecoveryUpdateParams {
  return (
    params &&
    typeof params === 'object' &&
    'newRecoveryAddress' in params &&
    typeof params.newRecoveryAddress === 'string'
  );
}

export function isTimeLockUpdateParams(params: any): params is TimeLockUpdateParams {
  return (
    params &&
    typeof params === 'object' &&
    'newTimeLockPeriodInMinutes' in params &&
    (typeof params.newTimeLockPeriodInMinutes === 'bigint' ||
     typeof params.newTimeLockPeriodInMinutes === 'number' ||
     (typeof params.newTimeLockPeriodInMinutes === 'string' &&
      /^\d+$/.test(params.newTimeLockPeriodInMinutes)))
  );
}
}

/**
 * Validates core operation parameters at runtime
 * @param operationType The operation type
 * @param params The parameters to validate
 * @returns Whether the parameters are valid for the operation type
 */
export function validateOperationParams(operationType: string, params: any): boolean {
  switch (operationType) {
    case 'BROADCASTER_UPDATE':
      return isBroadcasterUpdateParams(params);
    case 'RECOVERY_UPDATE':
      return isRecoveryUpdateParams(params);
    case 'TIMELOCK_UPDATE':
      return isTimeLockUpdateParams(params);
    default:
      // For unknown operations, just check if params is an object
      return params && typeof params === 'object';
  }
} 