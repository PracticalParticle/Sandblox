import { type Abi, type Address, createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getAllContracts, getContractABI } from '../catalog'
import { useContractRead } from 'wagmi'

export interface ContractInfo {
  address: string
  type: 'known' | 'unknown'
  name?: string
  description?: string
  category?: string
  bloxId?: string
}

async function verifyContractType(address: string, contractId: string): Promise<boolean> {
  try {
    const abi = await getContractABI(contractId)
    const client = createPublicClient({
      chain: mainnet,
      transport: http()
    })
    
    // Try to call a view function from the ABI to verify contract type
    const viewFunction = (abi as any[]).find(
      (item) => item.type === 'function' && item.stateMutability === 'view'
    )

    if (!viewFunction) return false

    await client.readContract({
      address: address as Address,
      abi: abi as Abi,
      functionName: viewFunction.name,
      args: viewFunction.inputs.map(() => '0x0'),
    })

    return true
  } catch {
    return false
  }
}

export async function identifyContract(address: string): Promise<ContractInfo> {
  try {
    // Get all known contract types
    const knownContracts = await getAllContracts()
    
    // For each known contract, try to match its ABI functions with the target contract
    for (const contract of knownContracts) {
      const isMatch = await verifyContractType(address, contract.id)
      if (isMatch) {
        return {
          address,
          type: 'known',
          name: contract.name,
          description: contract.description,
          category: contract.category,
          bloxId: contract.id
        }
      }
    }

    // If no match found, return unknown type
    return {
      address,
      type: 'unknown'
    }
  } catch (error) {
    console.error('Error identifying contract:', error)
    throw error
  }
}

export function useContractVerification(address: string) {
  const { data: isContract, isError } = useContractRead({
    address: address as Address,
    abi: [{
      name: 'supportsInterface',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'interfaceId', type: 'bytes4' }],
      outputs: [{ name: '', type: 'bool' }],
    }] as const,
    functionName: 'supportsInterface',
    args: ['0x01ffc9a7' as const],
  })

  return {
    isValid: isContract && !isError,
    isError
  }
} 