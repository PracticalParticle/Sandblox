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
  libraries?: {
    [key: string]: {
      name: string
      description: string
      address: string
    }
  }
}

export interface BloxContract extends BloxMetadata {
  files: {
    metadata: string
    sol: string
    abi: string
    component: string
    bytecode: string
    docs: string
  }
}

export type BloxCatalog = Record<string, BloxContract>