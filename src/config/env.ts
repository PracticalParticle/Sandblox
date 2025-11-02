import { z } from 'zod'

// Environment variable schema with validation
const envSchema = z.object({
  // App
  VITE_APP_NAME: z.string().default('SandBlox'),
  VITE_APP_DESCRIPTION: z.string(),
  VITE_APP_URL: z.string().url(),

  // WalletConnect
  VITE_WALLET_CONNECT_PROJECT_ID: z.string(),

  // Safe API Key (from legacy)
  VITE_SAFE_API_KEY: z.string().optional(),
  
  // CSP Script Source (from legacy)
  VITE_CSP_SCRIPT_SRC: z.string().optional(),

  // Network Configuration (from Sandblox)
  VITE_DEVNET_RPC_URL: z.string().url().optional(),
  VITE_DEVNET_CHAIN_ID: z.number().optional(),
  VITE_DEVNET_NAME: z.string().optional(),
  VITE_DEVNET_EXPLORER_URL: z.string().url().optional(),

  // Rest of the schema...
  VITE_SEPOLIA_RPC_URL: z.string().url().optional(),
  VITE_SEPOLIA_CHAIN_ID: z.number().optional(),
  VITE_SEPOLIA_NAME: z.string().optional(),
  VITE_SEPOLIA_EXPLORER_URL: z.string().url().optional(),

  // Development Debugging Configuration (from Sandblox)
  VITE_ENABLE_TRANSACTION_DEBUGGING: z.string().transform(val => val === 'true').default('false'),
  VITE_DEBUG_NETWORK_TYPE: z.enum(['ganache', 'hardhat', 'public']).default('ganache'),
  VITE_DEBUG_LOG_LEVEL: z.enum(['verbose', 'normal', 'minimal']).default('normal'),

  // Optional: Specific RPC URLs for debugging (from Sandblox)
  VITE_GANACHE_RPC_URL: z.string().url().optional(),
  VITE_HARDHAT_RPC_URL: z.string().url().optional(),
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

  const env = {
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
    VITE_WALLET_CONNECT_PROJECT_ID: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
    
    // Safe API Key (from legacy)
    VITE_SAFE_API_KEY: import.meta.env.VITE_SAFE_API_KEY || undefined,
    VITE_CSP_SCRIPT_SRC: import.meta.env.VITE_CSP_SCRIPT_SRC || undefined,
    
    // Network Configuration (from Sandblox)
    VITE_DEVNET_RPC_URL: import.meta.env.VITE_DEVNET_RPC_URL || undefined,
    VITE_DEVNET_CHAIN_ID: import.meta.env.VITE_DEVNET_CHAIN_ID ? Number(import.meta.env.VITE_DEVNET_CHAIN_ID) : undefined,
    VITE_DEVNET_NAME: import.meta.env.VITE_DEVNET_NAME || undefined,
    VITE_DEVNET_EXPLORER_URL: import.meta.env.VITE_DEVNET_EXPLORER_URL || undefined,

    VITE_SEPOLIA_RPC_URL: import.meta.env.VITE_SEPOLIA_RPC_URL || undefined,
    VITE_SEPOLIA_CHAIN_ID: import.meta.env.VITE_SEPOLIA_CHAIN_ID ? Number(import.meta.env.VITE_SEPOLIA_CHAIN_ID) : undefined,
    VITE_SEPOLIA_NAME: import.meta.env.VITE_SEPOLIA_NAME || undefined,
    VITE_SEPOLIA_EXPLORER_URL: import.meta.env.VITE_SEPOLIA_EXPLORER_URL || undefined,

    // Development Debugging Configuration (from Sandblox)
    VITE_ENABLE_TRANSACTION_DEBUGGING: import.meta.env.VITE_ENABLE_TRANSACTION_DEBUGGING || 'false',
    VITE_DEBUG_NETWORK_TYPE: import.meta.env.VITE_DEBUG_NETWORK_TYPE || 'ganache',
    VITE_DEBUG_LOG_LEVEL: import.meta.env.VITE_DEBUG_LOG_LEVEL || 'normal',

    // Optional: Specific RPC URLs for debugging (from Sandblox)
    VITE_GANACHE_RPC_URL: import.meta.env.VITE_GANACHE_RPC_URL || undefined,
    VITE_HARDHAT_RPC_URL: import.meta.env.VITE_HARDHAT_RPC_URL || undefined,
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