import { z } from 'zod'

// Environment variable schema with validation
const envSchema = z.object({
  // App
  VITE_APP_NAME: z.string().default('SandBlox'),
  VITE_APP_DESCRIPTION: z.string(),
  VITE_APP_URL: z.string().url(),

  // WalletConnect
  VITE_WALLET_CONNECT_PROJECT_ID: z.string(),

  // Safe API Key
  VITE_SAFE_API_KEY: z.string().optional(),
  
  // CSP Script Source
  VITE_CSP_SCRIPT_SRC: z.string().optional(),
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
    VITE_SAFE_API_KEY: import.meta.env.VITE_SAFE_API_KEY || undefined,
    VITE_CSP_SCRIPT_SRC: import.meta.env.VITE_CSP_SCRIPT_SRC || undefined,
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