export interface BloxMetadata {
  id: string
  name: string
  description: string
  category: string
  securityLevel: 'Basic' | 'Advanced' | 'Enterprise'
  features: string[]
  requirements: string[]
  deployments: {
    [chainId: string]: {
      name: string
      factory: string
    }
  }
  deploymentCount: number
  lastUpdated: string
  libraries?: {
    [key: string]: {
      name: string
      description: string
      address?: string
    }
  }
}

export interface BloxContract extends BloxMetadata {
  files: {
    metadata: string
    sol: string
    abi: string
    component: string
    bytecode?: string
    docs: string
    factoryDialog?: string
  }
}

export type BloxCatalog = Record<string, BloxContract>