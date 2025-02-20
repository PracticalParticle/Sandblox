export enum ErrorCodes {
  // User interaction errors
  USER_REJECTED = 'USER_REJECTED',
  USER_DISCONNECTED = 'USER_DISCONNECTED',
  
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INVALID_CHAIN = 'INVALID_CHAIN',
  TIMEOUT = 'TIMEOUT',
  
  // Session errors
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_INVALID = 'TRANSACTION_INVALID',
  
  // Security errors
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  
  // Unknown error
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class WalletConnectError extends Error {
  public readonly code: ErrorCodes;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    code: ErrorCodes,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'WalletConnectError';
    this.code = code;
    this.originalError = originalError;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletConnectError);
    }
  }

  public static isWalletConnectError(error: unknown): error is WalletConnectError {
    return error instanceof WalletConnectError;
  }

  public static fromError(error: unknown): WalletConnectError {
    if (error instanceof WalletConnectError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    
    // Handle specific error types
    if (message.includes('User rejected')) {
      return new WalletConnectError(
        'User rejected the connection request',
        ErrorCodes.USER_REJECTED,
        error
      );
    }
    
    if (message.includes('Session expired')) {
      return new WalletConnectError(
        'Session has expired',
        ErrorCodes.SESSION_EXPIRED,
        error
      );
    }
    
    // Default unknown error
    return new WalletConnectError(
      message,
      ErrorCodes.UNKNOWN_ERROR,
      error
    );
  }
}

export class UserRejectedError extends WalletConnectError {
  constructor(message = 'User rejected the request') {
    super(message, ErrorCodes.USER_REJECTED);
    this.name = 'UserRejectedError';
  }
}

export class SessionError extends WalletConnectError {
  constructor(message: string, code: ErrorCodes.SESSION_INVALID | ErrorCodes.SESSION_EXPIRED) {
    super(message, code);
    this.name = 'SessionError';
  }
}

export class TransactionError extends WalletConnectError {
  constructor(
    message: string,
    code: ErrorCodes.TRANSACTION_FAILED | ErrorCodes.TRANSACTION_REJECTED | ErrorCodes.TRANSACTION_INVALID
  ) {
    super(message, code);
    this.name = 'TransactionError';
  }
}

export function isUserRejectionError(error: unknown): boolean {
  if (error instanceof UserRejectedError) {
    return true;
  }
  
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('user rejected') ||
           error.message.toLowerCase().includes('user cancelled');
  }
  
  return false;
} 