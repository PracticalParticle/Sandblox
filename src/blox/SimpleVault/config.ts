import { env } from '@/config/env'
import type { BloxContract } from '@/lib/catalog/types'

export function getSimpleVaultConfig(): Partial<BloxContract> {
  return {
    libraries: {
      MultiPhaseSecureOperation: {
        name: 'MultiPhaseSecureOperation',
        description: 'Library for implementing secure multi-phase operations with time-locks and meta-transactions',
        address: env.LIBRARY_MULTI_PHASE_SECURE_OPERATION
      }
    }
  }
} 