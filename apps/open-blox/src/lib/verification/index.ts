import { type Abi, type Address, createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { getAllContracts, getContractABI } from '../catalog'
import { useReadContract } from 'wagmi'

export interface ContractInfo {
  address: string
  type: 'secure-ownable' | 'unknown'
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

// Function to check if contract is SecureOwnable
async function isSecureOwnable(address: string): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http()
    })
    
    // Check for key SecureOwnable functions
    const secureOwnableFunctions = [
      'owner',
      'getBroadcaster',
      'getRecoveryAddress',
      'getTimeLockPeriodInDays'
    ]

    for (const functionName of secureOwnableFunctions) {
      try {
        await client.readContract({
          address: address as Address,
          abi: [{
            name: functionName,
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: functionName === 'getTimeLockPeriodInDays' ? 'uint256' : 'address' }],
          }] as const,
          functionName,
        })
      } catch {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

export async function identifyContract(address: string): Promise<ContractInfo> {
  try {
    // First check if it's a SecureOwnable contract
    const isSecureOwnableContract = await isSecureOwnable(address)
    if (isSecureOwnableContract) {
      // Get all known contracts to find additional metadata
      const knownContracts = await getAllContracts()
      
      // Try to match with a known contract for additional metadata
      for (const contract of knownContracts) {
        const isMatch = await verifyContractType(address, contract.id)
        if (isMatch) {
          return {
            address,
            type: 'secure-ownable',
            name: contract.name,
            description: contract.description,
            category: contract.category,
            bloxId: contract.id
          }
        }
      }

      // If no specific match found but it is SecureOwnable
      return {
        address,
        type: 'secure-ownable'
      }
    }

    // If not SecureOwnable, return unknown
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
  const { data: isContract, isError } = useReadContract({
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