import { type Address, createPublicClient, http, decodeAbiParameters, keccak256, toHex } from 'viem'
import { mainnet } from 'viem/chains'
import { getAllContracts, getContractABI } from '../catalog'
import type { BloxContract } from '../catalog/types'
import { getChainName, type Chain } from '@/lib/utils'

export interface ContractInfo {
  address: string
  type: string
  name?: string
  description?: string
  category?: string
  bloxId?: string
  isCustom?: boolean
  chainId?: number
  chainName?: string
}

let contractTypesCache: BloxContract[] | null = null

async function getContractTypes(): Promise<BloxContract[]> {
  if (contractTypesCache) {
    return contractTypesCache
  }
  
  try {
    contractTypesCache = await getAllContracts()
    return contractTypesCache
  } catch (error) {
    console.error('Error loading contract types:', error)
    return []
  }
}

// Create a public client for reading contract data
const client = createPublicClient({
  chain: mainnet,
  transport: http()
})

export async function identifyContract(address: string): Promise<ContractInfo> {
  // TODO: Remove this for production. we are using a mock for now.
  // return {
  //   address: address as Address,
  //   type: 'SimpleVault',
  //   name: 'Simple Vault',
  //   category: 'Vault',
  //   description: 'A basic vault implementation',
  //   bloxId: 'simple-vault-v1',
  //   isCustom: false
  // }

  try {
    // Get the runtime bytecode of the target contract
    const targetBytecode = await client.getCode({ address: address as Address })
    if (!targetBytecode) {
      throw new Error('No bytecode found at address')
    }

    // Get chain information
    const chainId = await client.getChainId()
    const chainName = getChainName(chainId as Chain)

    // Load all available contract types
    const contractTypes = await getContractTypes()
    
    // Try to match against each contract type
    for (const contractType of contractTypes) {
      try {
        // Get the ABI for this contract type
        const abi = await getContractABI(contractType.id)
        
        // Try to match using key functions from the ABI
        const viewFunctions = abi.filter((item: any) => 
          item.type === 'function' && 
          (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
          (!item.inputs || item.inputs.length === 0)
        )

        let matchCount = 0
        for (const func of viewFunctions.slice(0, 3)) {
          try {
            // Generate proper function selector
            const signature = `${func.name}(${func.inputs?.map((input: any) => input.type).join(',') || ''})`
            const selector = keccak256(toHex(signature)).slice(0, 10) as `0x${string}`

            // Call the view function
            const result = await client.call({
              account: address as Address,
              data: selector,
              to: address as Address
            })
            
            // Try to decode the result using the ABI
            try {
              if (func.outputs && func.outputs.length > 0) {
                decodeAbiParameters(func.outputs, result.data || '0x')
                matchCount++
              }
            } catch {
              // Decoding failed, not a match
            }
          } catch (error: any) {
            // If it reverts with a specific error, it might still be a match
            if (error.message?.includes(contractType.id)) {
              matchCount++
            }
          }
        }

        if (matchCount >= 2) {
          return {
            address: address as Address,
            type: contractType.id,
            name: contractType.name,
            category: contractType.category,
            description: contractType.description,
            bloxId: contractType.id,
            isCustom: false,
            chainId,
            chainName
          }
        }
      } catch (error) {
        console.error(`Error checking contract type ${contractType.id}:`, error)
        continue
      }
    }
    
    // If we get here, no match was found
    return {
      address: address as Address,
      type: 'unknown',
      isCustom: true,
      chainId,
      chainName
    }
  } catch (error) {
    console.error('Error identifying contract:', error)
    return {
      address: address as Address,
      type: 'unknown',
      isCustom: true,
      chainId: client.chain.id,
      chainName: getChainName(client.chain.id as Chain)
    }
  }
}

export function useContractVerification() {
  return {
    isValid: true, // Mock validation result
    isError: false
  }
} 