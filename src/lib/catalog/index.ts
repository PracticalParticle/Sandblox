import { BloxCatalog, BloxContract, BloxMetadata } from './types'

// Use Vite's glob import to get all .blox.json files
const bloxMetadataFiles = import.meta.glob('/src/blox/**/*.blox.json', { eager: true })

// Map to store folder names by contract ID
const contractFolderMap = new Map<string, string>()

async function getContractIdsFromBloxFolder(): Promise<string[]> {
  const contractIds: string[] = []
  
  // Process all .blox.json files
  for (const [path, module] of Object.entries(bloxMetadataFiles)) {
    try {
      const metadata = module as BloxMetadata
      if (metadata.id) {
        // Extract folder name from path (e.g., /src/blox/SimpleVault/SimpleVault.blox.json -> SimpleVault)
        const folderName = path.split('/').slice(-2)[0]
        contractIds.push(metadata.id)
        contractFolderMap.set(metadata.id, folderName)
      }
    } catch (error) {
      console.error(`Error processing metadata from ${path}:`, error)
    }
  }
  
  return contractIds
}

async function loadBloxMetadata(contractId: string): Promise<BloxMetadata> {
  const folderName = contractFolderMap.get(contractId)
  if (!folderName) {
    throw new Error(`No folder found for contract ${contractId}`)
  }

  // Get the metadata directly from the glob import
  const metadataPath = `/src/blox/${folderName}/${folderName}.blox.json`
  const metadata = bloxMetadataFiles[metadataPath] as BloxMetadata
  if (!metadata) {
    throw new Error(`Failed to load metadata for contract ${contractId}`)
  }

  return metadata
}

async function loadContractFiles(contractId: string): Promise<BloxContract['files']> {
  const folderName = contractFolderMap.get(contractId)
  if (!folderName) {
    throw new Error(`No folder found for contract ${contractId}`)
  }

  // Check if factory dialog exists
  const factoryDialogPath = `/src/blox/${folderName}/factory/${folderName}Factory.dialog.tsx`
  const hasFactoryDialog = Object.keys(import.meta.glob('/src/blox/**/factory/*.dialog.tsx', { eager: true }))
    .includes(factoryDialogPath)

  // In development, use src paths
  if (import.meta.env.DEV) {
    return {
      metadata: `/src/blox/${folderName}/${folderName}.blox.json`,
      sol: `/src/blox/${folderName}/${folderName}.sol`,
      abi: `/src/blox/${folderName}/${folderName}.abi.json`,
      component: `/src/blox/${folderName}/${folderName}.tsx`,
      docs: `/src/blox/${folderName}/${folderName}.md`,
      ...(hasFactoryDialog && { factoryDialog: factoryDialogPath })
    }
  }
  
  // In production, use public paths
  return {
    metadata: `/blox/${folderName}/${folderName}.blox.json`,
    sol: `/blox/${folderName}/${folderName}.sol`,
    abi: `/blox/${folderName}/${folderName}.abi.json`,
    component: `/src/blox/${folderName}/${folderName}.tsx`, // Component still from src
    docs: `/blox/${folderName}/${folderName}.md`,
    ...(hasFactoryDialog && { factoryDialog: factoryDialogPath })
  }
}

let catalogCache: BloxCatalog | null = null

export async function loadCatalog(): Promise<BloxCatalog> {
  if (catalogCache) {
    return catalogCache
  }

  try {
    const contractIds = await getContractIdsFromBloxFolder()
    
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

/**
 * Dynamically load a blox contract module
 * @param bloxId The ID of the blox to load the contract module for
 * @returns Promise resolving to the contract module
 */
export async function loadBloxContractModule(bloxId: string): Promise<any> {
  const folderName = contractFolderMap.get(bloxId);
  if (!folderName) {
    throw new Error(`No folder found for blox ${bloxId}`);
  }
  
  try {
    return await import(`../../blox/${folderName}/${folderName}`);
  } catch (error) {
    console.error(`Failed to load contract module for blox: ${bloxId}`, error);
    throw error;
  }
}