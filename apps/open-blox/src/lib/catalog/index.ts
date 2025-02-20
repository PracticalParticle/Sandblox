import { BloxCatalog, BloxContract, BloxMetadata } from './types'

const BLOX_PATH = '/src/blox'

async function loadBloxMetadata(contractId: string): Promise<BloxMetadata> {
  try {
    const response = await fetch(`${BLOX_PATH}/${contractId}/${contractId}.blox.json`)
    if (!response.ok) {
      throw new Error(`Failed to load metadata for contract ${contractId}`)
    }
    return response.json()
  } catch (error) {
    console.error(`Error loading metadata for ${contractId}:`, error)
    throw error
  }
}

async function loadContractFiles(contractId: string): Promise<BloxContract['files']> {
  return {
    metadata: `${BLOX_PATH}/${contractId}/${contractId}.blox.json`,
    sol: `${BLOX_PATH}/${contractId}/${contractId}.sol`,
    abi: `${BLOX_PATH}/${contractId}/${contractId}.abi.json`,
    component: `${BLOX_PATH}/${contractId}/${contractId}.tsx`
  }
}

let catalogCache: BloxCatalog | null = null

export async function loadCatalog(): Promise<BloxCatalog> {
  if (catalogCache) {
    return catalogCache
  }

  try {
    // For now, we'll use a known list of contracts from the community folder
    // In a production environment, this would be dynamically loaded from the server
    const contractIds = [
      'SimpleVault'
    ]
    
    const contracts = await Promise.all(
      contractIds.map(async (id) => {
        try {
          const metadata = await loadBloxMetadata(id)
          const files = await loadContractFiles(id)
          return {
            ...metadata,
            files
          }
        } catch (error) {
          console.error(`Failed to load contract ${id}:`, error)
          return null
        }
      })
    )

    catalogCache = contracts
      .filter((contract): contract is BloxContract => contract !== null)
      .reduce((acc, contract) => {
        acc[contract.id] = contract
        return acc
      }, {} as BloxCatalog)

    return catalogCache
  } catch (error) {
    console.error('Failed to load catalog:', error)
    return {}
  }
}

export async function getContractDetails(contractId: string): Promise<BloxContract | null> {
  const catalog = await loadCatalog()
  return catalog[contractId] || null
}

export async function getAllContracts(): Promise<BloxContract[]> {
  const catalog = await loadCatalog()
  return Object.values(catalog)
}

export async function getContractCode(contractId: string): Promise<string> {
  const contract = await getContractDetails(contractId)
  if (!contract) {
    throw new Error('Contract not found')
  }
  
  const response = await fetch(contract.files.sol)
  if (!response.ok) {
    throw new Error('Failed to load contract code')
  }
  
  return response.text()
}

export async function getContractABI(contractId: string): Promise<any> {
  const contract = await getContractDetails(contractId)
  if (!contract) {
    throw new Error('Contract not found')
  }
  
  const response = await fetch(contract.files.abi)
  if (!response.ok) {
    throw new Error('Failed to load contract ABI')
  }
  
  return response.json()
}