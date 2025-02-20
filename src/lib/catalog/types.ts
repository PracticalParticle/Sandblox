export interface BloxMetadata {
  id: string
  name: string
  description: string
  category: string
  securityLevel: 'Basic' | 'Advanced' | 'Enterprise'
  features: string[]
  requirements: string[]
  deployments: number
  lastUpdated: string
}

export interface BloxContract extends BloxMetadata {
  files: {
    metadata: string
    sol: string
    abi: string
    component: string
  }
}

export type BloxCatalog = Record<string, BloxContract>