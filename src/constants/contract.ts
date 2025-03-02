export const CONTRACT_ERRORS = {
  NO_CLIENT: 'No public client available',
  NO_WALLET: 'No wallet client available',
  INVALID_ADDRESS: 'Invalid contract address format',
  NOT_DEPLOYED: 'Contract is not deployed at this address',
  INVALID_TIMELOCK: 'Invalid timelock period',
  INVALID_OPERATION: 'Invalid operation type',
  INVALID_SIGNATURE: 'Invalid signature',
  INVALID_PAYMENT: 'Invalid payment details',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  TRANSFER_FAILED: 'Transfer failed',
  UNAUTHORIZED: 'Unauthorized operation',
  EXPIRED: 'Operation expired',
  ALREADY_EXECUTED: 'Operation already executed',
  ALREADY_CANCELLED: 'Operation already cancelled',
  NOT_READY: 'Operation not ready for execution',
  CHAIN_MISMATCH: 'Chain ID mismatch',
  HANDLER_MISMATCH: 'Handler contract mismatch'
} as const

export const TIMELOCK_PERIODS = {
  MIN: 1440, // Minimum 1 day (1440 minutes)
  MAX: 43200, // Maximum 30 days (43200 minutes)
  DEFAULT: 10080 // Default 7 days (10080 minutes)
} as const

export const GAS_LIMITS = {
  APPROVE: 100000n,
  CANCEL: 50000n,
  TRANSFER: 150000n,
  UPDATE: 200000n,
  PAYMENT: 300000n
} as const

export const META_TX_DEFAULTS = {
  DEADLINE_BUFFER: 3600, // 1 hour in seconds
  MAX_GAS_PRICE_BUFFER: 1.5, // 50% buffer on current gas price
  SIGNATURE_VALIDITY: 86400 // 24 hours in seconds
} as const 