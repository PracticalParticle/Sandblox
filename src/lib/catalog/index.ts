import { BloxCatalog, BloxContract, BloxMetadata } from './types'
import { env } from '@/config/env'

// Use Vite's glob import to get all .blox.json files
const bloxMetadataFiles = import.meta.glob('/src/blox/**/*.blox.json', { eager: true })

// Use Vite's glob import to get all config.ts files
const bloxConfigFiles = import.meta.glob('/src/blox/**/config.ts', { eager: true })

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

  // Try to load dynamic configuration
  const configPath = `/src/blox/${folderName}/config.ts`
  const configModule = bloxConfigFiles[configPath]
  if (configModule && typeof configModule === 'object' && 'getSimpleVaultConfig' in configModule) {
    const dynamicConfig = await (configModule as { getSimpleVaultConfig: () => Partial<BloxContract> }).getSimpleVaultConfig()
    return {
      ...metadata,
      ...dynamicConfig
    }
  }

  return metadata
}

async function loadContractFiles(contractId: string): Promise<BloxContract['files']> {
  const folderName = contractFolderMap.get(contractId)
  if (!folderName) {
    throw new Error(`No folder found for contract ${contractId}`)
  }

  // Determine which bytecode file to use based on environment
  // If local node is enabled, use dev bytecode, otherwise use remote
  const bytecodeFile = env.ENABLE_LOCAL_NODE ? 
    `${folderName}.dev.bin` : 
    `${folderName}.remote.bin`

  console.log('Environment config:', {
    isLocalNode: env.ENABLE_LOCAL_NODE,
    isRemoteNode: env.ENABLE_REMOTE_NODE,
    selectedBytecode: bytecodeFile
  })

  return {
    metadata: `/src/blox/${folderName}/${folderName}.blox.json`,
    sol: `/src/blox/${folderName}/${folderName}.sol`,
    abi: `/src/blox/${folderName}/${folderName}.abi.json`,
    component: `/src/blox/${folderName}/${folderName}.tsx`,
    bytecode: `/src/blox/${folderName}/${bytecodeFile}`
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

export async function getContractBytecode(contractId: string): Promise<string> {
  const contract = await getContractDetails(contractId)
  if (!contract) {
    throw new Error('Contract not found')
  }
  
  console.log('Environment:', {
    isRemote: env.ENABLE_REMOTE_NODE,
    bytecodeFile: contract.files.bytecode
  })
  
  const response = await fetch(contract.files.bytecode)
  if (!response.ok) {
    console.error('Bytecode loading error:', {
      status: response.status,
      statusText: response.statusText,
      file: contract.files.bytecode
    })
    throw new Error(`Failed to load contract bytecode: ${response.statusText}`)
  }
  
  const bytecode = await response.text()
  console.log('Loaded bytecode:', {
    length: bytecode.length,
    hasPrefix: bytecode.startsWith('0x'),
    start: bytecode.slice(0, 64)
  })
  
  return bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`
}