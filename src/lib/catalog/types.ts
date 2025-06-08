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


export interface NotificationMessage {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}