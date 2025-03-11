import { z } from 'zod'

// Environment variable schema with validation
const envSchema = z.object({
  // App
  VITE_APP_NAME: z.string().default('SandBlox'),
  VITE_APP_DESCRIPTION: z.string(),
  VITE_APP_URL: z.string().url(),

  // WalletConnect
  VITE_WALLET_CONNECT_PROJECT_ID: z.string(),

  // Feature Flags
  VITE_ENABLE_TESTNET: z.boolean().default(true),
  VITE_ENABLE_DEBUG_LOGS: z.boolean().default(false),
  VITE_ENABLE_LOCAL_NODE: z.boolean().default(false),
  VITE_ENABLE_REMOTE_NODE: z.boolean().default(true),

  // Network Configuration
  VITE_DEVNET_RPC_URL: z.string().url(),
  VITE_DEVNET_CHAIN_ID: z.number(),
  VITE_DEVNET_NAME: z.string(),
  VITE_DEVNET_EXPLORER_URL: z.string().optional(),

  // Rest of the schema...
  VITE_SEPOLIA_RPC_URL: z.string().url().optional(),
  VITE_SEPOLIA_CHAIN_ID: z.number().optional(),
  VITE_SEPOLIA_NAME: z.string().optional(),
  VITE_SEPOLIA_EXPLORER_URL: z.string().url().optional(),

  // Security & Performance
  VITE_MAX_BATCH_SIZE: z.number().int().positive().default(100),
  VITE_REQUEST_TIMEOUT: z.number().int().positive().default(30000),
  VITE_MAX_RETRIES: z.number().int().nonnegative().default(3),
  VITE_RETRY_DELAY: z.number().int().nonnegative().default(1000),

  // Contract Deployment
  VITE_DEFAULT_GAS_LIMIT: z.number().int().positive().default(6000000),
  VITE_GAS_PRICE_BUFFER: z.number().positive().default(1.1),
  VITE_CONFIRMATION_BLOCKS: z.number().int().positive().default(2),

  // API Keys
  VITE_INFURA_API_KEY: z.string().optional(),
  VITE_ETHERSCAN_API_KEY: z.string().optional(),

  // Library Addresses
  VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
  })

  console.log('Network config:', {
    VITE_DEVNET_RPC_URL: import.meta.env.VITE_DEVNET_RPC_URL,
    VITE_DEVNET_CHAIN_ID: import.meta.env.VITE_DEVNET_CHAIN_ID,
    VITE_DEVNET_NAME: import.meta.env.VITE_DEVNET_NAME,
  })

  console.log('Feature flags:', {
    VITE_ENABLE_TESTNET: import.meta.env.VITE_ENABLE_TESTNET,
    VITE_ENABLE_DEBUG_LOGS: import.meta.env.VITE_ENABLE_DEBUG_LOGS,
    VITE_ENABLE_LOCAL_NODE: import.meta.env.VITE_ENABLE_LOCAL_NODE,
    VITE_ENABLE_REMOTE_NODE: import.meta.env.VITE_ENABLE_REMOTE_NODE,
  })

  console.log('Library addresses:', {
    VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION: import.meta.env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION,
  })

  const env = {
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
    VITE_WALLET_CONNECT_PROJECT_ID: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    
    // Network Configuration
    VITE_DEVNET_RPC_URL: import.meta.env.VITE_DEVNET_RPC_URL,
    VITE_DEVNET_CHAIN_ID: Number(import.meta.env.VITE_DEVNET_CHAIN_ID),
    VITE_DEVNET_NAME: import.meta.env.VITE_DEVNET_NAME,
    VITE_DEVNET_EXPLORER_URL: import.meta.env.VITE_DEVNET_EXPLORER_URL,

    VITE_SEPOLIA_RPC_URL: import.meta.env.VITE_SEPOLIA_RPC_URL || undefined,
    VITE_SEPOLIA_CHAIN_ID: import.meta.env.VITE_SEPOLIA_CHAIN_ID ? Number(import.meta.env.VITE_SEPOLIA_CHAIN_ID) : undefined,
    VITE_SEPOLIA_NAME: import.meta.env.VITE_SEPOLIA_NAME || undefined,
    VITE_SEPOLIA_EXPLORER_URL: import.meta.env.VITE_SEPOLIA_EXPLORER_URL || undefined,

    // Security & Performance
    VITE_MAX_BATCH_SIZE: Number(import.meta.env.VITE_MAX_BATCH_SIZE),
    VITE_REQUEST_TIMEOUT: Number(import.meta.env.VITE_REQUEST_TIMEOUT),
    VITE_MAX_RETRIES: Number(import.meta.env.VITE_MAX_RETRIES),
    VITE_RETRY_DELAY: Number(import.meta.env.VITE_RETRY_DELAY),

    // Feature Flags
    VITE_ENABLE_TESTNET: import.meta.env.VITE_ENABLE_TESTNET === 'true',
    VITE_ENABLE_DEBUG_LOGS: import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true',
    VITE_ENABLE_LOCAL_NODE: import.meta.env.VITE_ENABLE_LOCAL_NODE === 'true',
    VITE_ENABLE_REMOTE_NODE: import.meta.env.VITE_ENABLE_REMOTE_NODE === 'true',

    // Contract Deployment
    VITE_DEFAULT_GAS_LIMIT: Number(import.meta.env.VITE_DEFAULT_GAS_LIMIT),
    VITE_GAS_PRICE_BUFFER: Number(import.meta.env.VITE_GAS_PRICE_BUFFER),
    VITE_CONFIRMATION_BLOCKS: Number(import.meta.env.VITE_CONFIRMATION_BLOCKS),

    // API Keys
    VITE_INFURA_API_KEY: import.meta.env.VITE_INFURA_API_KEY,
    VITE_ETHERSCAN_API_KEY: import.meta.env.VITE_ETHERSCAN_API_KEY,

    // Library Addresses
    VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION: import.meta.env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION,
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
    id: env.VITE_DEVNET_CHAIN_ID,
    name: env.VITE_DEVNET_NAME,
    rpcUrl: env.VITE_DEVNET_RPC_URL,
    explorerUrl: env.VITE_DEVNET_EXPLORER_URL,
  },
  sepolia: env.VITE_ENABLE_TESTNET ? {
    id: env.VITE_SEPOLIA_CHAIN_ID,
    name: env.VITE_SEPOLIA_NAME,
    rpcUrl: env.VITE_SEPOLIA_RPC_URL,
    explorerUrl: env.VITE_SEPOLIA_EXPLORER_URL,
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
  gasLimit: env.VITE_DEFAULT_GAS_LIMIT,
  gasPriceBuffer: env.VITE_GAS_PRICE_BUFFER,
  confirmationBlocks: env.VITE_CONFIRMATION_BLOCKS,
} as const

// Security and performance configuration
export const security = {
  maxBatchSize: env.VITE_MAX_BATCH_SIZE,
  requestTimeout: env.VITE_REQUEST_TIMEOUT,
  maxRetries: env.VITE_MAX_RETRIES,
  retryDelay: env.VITE_RETRY_DELAY,
} as const

// Library addresses configuration
export const libraries = {
  multiPhaseSecureOperation: env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION,
} as const 