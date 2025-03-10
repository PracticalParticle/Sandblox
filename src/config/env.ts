import { z } from 'zod'

// Environment variable schema with validation
const envSchema = z.object({
  // App
  APP_NAME: z.string().default('SandBlox'),
  APP_DESCRIPTION: z.string(),
  APP_URL: z.string().url(),

  // WalletConnect
  WALLET_CONNECT_PROJECT_ID: z.string(),

  // Feature Flags
  ENABLE_TESTNET: z.boolean().default(true),
  ENABLE_DEBUG_LOGS: z.boolean().default(false),
  ENABLE_LOCAL_NODE: z.boolean().default(false),
  ENABLE_REMOTE_NODE: z.boolean().default(true),

  // Network Configuration
  DEVNET_RPC_URL: z.string().url(),
  DEVNET_CHAIN_ID: z.number(),
  DEVNET_NAME: z.string(),
  DEVNET_EXPLORER_URL: z.string().optional(),

  // Rest of the schema...
  SEPOLIA_RPC_URL: z.string().url().optional(),
  SEPOLIA_CHAIN_ID: z.number().optional(),
  SEPOLIA_NAME: z.string().optional(),
  SEPOLIA_EXPLORER_URL: z.string().url().optional(),

  // Security & Performance
  MAX_BATCH_SIZE: z.number().int().positive().default(100),
  REQUEST_TIMEOUT: z.number().int().positive().default(30000),
  MAX_RETRIES: z.number().int().nonnegative().default(3),
  RETRY_DELAY: z.number().int().nonnegative().default(1000),

  // Contract Deployment
  DEFAULT_GAS_LIMIT: z.number().int().positive().default(6000000),
  GAS_PRICE_BUFFER: z.number().positive().default(1.1),
  CONFIRMATION_BLOCKS: z.number().int().positive().default(2),

  // API Keys
  INFURA_API_KEY: z.string().optional(),
  ETHERSCAN_API_KEY: z.string().optional(),

  // Library Addresses
  LIBRARY_MULTI_PHASE_SECURE_OPERATION: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
})

// Type inference
type EnvConfig = z.infer<typeof envSchema>

// Parse and validate environment variables
function parseEnvVariables(): EnvConfig {
  console.log('Loading environment variables:', {
    mode: import.meta.env.MODE,
    base: import.meta.env.BASE_URL,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
  })

  console.log('Application config:', {
    APP_NAME: import.meta.env.VITE_APP_NAME,
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    APP_URL: import.meta.env.VITE_APP_URL,
  })

  console.log('Network config:', {
    DEVNET_RPC_URL: import.meta.env.VITE_DEVNET_RPC_URL,
    DEVNET_CHAIN_ID: import.meta.env.VITE_DEVNET_CHAIN_ID,
    DEVNET_NAME: import.meta.env.VITE_DEVNET_NAME,
  })

  console.log('Feature flags:', {
    ENABLE_TESTNET: import.meta.env.VITE_ENABLE_TESTNET,
    ENABLE_DEBUG_LOGS: import.meta.env.VITE_ENABLE_DEBUG_LOGS,
    ENABLE_LOCAL_NODE: import.meta.env.VITE_ENABLE_LOCAL_NODE,
    ENABLE_REMOTE_NODE: import.meta.env.VITE_ENABLE_REMOTE_NODE,
  })

  console.log('Library addresses:', {
    LIBRARY_MULTI_PHASE_SECURE_OPERATION: import.meta.env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION,
  })

  const env = {
    APP_NAME: import.meta.env.VITE_APP_NAME,
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    APP_URL: import.meta.env.VITE_APP_URL,
    WALLET_CONNECT_PROJECT_ID: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    
    // Network Configuration
    DEVNET_RPC_URL: import.meta.env.VITE_DEVNET_RPC_URL,
    DEVNET_CHAIN_ID: Number(import.meta.env.VITE_DEVNET_CHAIN_ID),
    DEVNET_NAME: import.meta.env.VITE_DEVNET_NAME,
    DEVNET_EXPLORER_URL: import.meta.env.VITE_DEVNET_EXPLORER_URL,

    SEPOLIA_RPC_URL: import.meta.env.VITE_SEPOLIA_RPC_URL || undefined,
    SEPOLIA_CHAIN_ID: import.meta.env.VITE_SEPOLIA_CHAIN_ID ? Number(import.meta.env.VITE_SEPOLIA_CHAIN_ID) : undefined,
    SEPOLIA_NAME: import.meta.env.VITE_SEPOLIA_NAME || undefined,
    SEPOLIA_EXPLORER_URL: import.meta.env.VITE_SEPOLIA_EXPLORER_URL || undefined,

    // Security & Performance
    MAX_BATCH_SIZE: Number(import.meta.env.VITE_MAX_BATCH_SIZE),
    REQUEST_TIMEOUT: Number(import.meta.env.VITE_REQUEST_TIMEOUT),
    MAX_RETRIES: Number(import.meta.env.VITE_MAX_RETRIES),
    RETRY_DELAY: Number(import.meta.env.VITE_RETRY_DELAY),

    // Feature Flags
    ENABLE_TESTNET: import.meta.env.VITE_ENABLE_TESTNET === 'true',
    ENABLE_DEBUG_LOGS: import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true',
    ENABLE_LOCAL_NODE: import.meta.env.VITE_ENABLE_LOCAL_NODE === 'true',
    ENABLE_REMOTE_NODE: import.meta.env.VITE_ENABLE_REMOTE_NODE === 'true',

    // Contract Deployment
    DEFAULT_GAS_LIMIT: Number(import.meta.env.VITE_DEFAULT_GAS_LIMIT),
    GAS_PRICE_BUFFER: Number(import.meta.env.VITE_GAS_PRICE_BUFFER),
    CONFIRMATION_BLOCKS: Number(import.meta.env.VITE_CONFIRMATION_BLOCKS),

    // API Keys
    INFURA_API_KEY: import.meta.env.VITE_INFURA_API_KEY,
    ETHERSCAN_API_KEY: import.meta.env.VITE_ETHERSCAN_API_KEY,

    // Library Addresses
    LIBRARY_MULTI_PHASE_SECURE_OPERATION: import.meta.env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION,
  }

  try {
    return envSchema.parse(env)
  } catch (error) {
    console.error('Environment validation failed:', error)
    throw error
  }
}

// Export validated environment configuration
export const env = parseEnvVariables()

// Network configurations
export const networks = {
  devnet: {
    id: env.DEVNET_CHAIN_ID,
    name: env.DEVNET_NAME,
    rpcUrl: env.DEVNET_RPC_URL,
    explorerUrl: env.DEVNET_EXPLORER_URL,
  },
  sepolia: env.ENABLE_TESTNET ? {
    id: env.SEPOLIA_CHAIN_ID,
    name: env.SEPOLIA_NAME,
    rpcUrl: env.SEPOLIA_RPC_URL,
    explorerUrl: env.SEPOLIA_EXPLORER_URL,
  } : null,
} as const

// Helper to get active networks
export function getActiveNetworks() {
  return Object.entries(networks)
    .filter(([_, config]) => config !== null)
    .reduce((acc, [key, config]) => {
      acc[key] = config!
      return acc
    }, {} as Record<string, NonNullable<typeof networks[keyof typeof networks]>>)
}

// Contract deployment configuration
export const deployment = {
  gasLimit: env.DEFAULT_GAS_LIMIT,
  gasPriceBuffer: env.GAS_PRICE_BUFFER,
  confirmationBlocks: env.CONFIRMATION_BLOCKS,
} as const

// Security and performance configuration
export const security = {
  maxBatchSize: env.MAX_BATCH_SIZE,
  requestTimeout: env.REQUEST_TIMEOUT,
  maxRetries: env.MAX_RETRIES,
  retryDelay: env.RETRY_DELAY,
} as const

// Library addresses configuration
export const libraries = {
  multiPhaseSecureOperation: env.LIBRARY_MULTI_PHASE_SECURE_OPERATION,
} as const 