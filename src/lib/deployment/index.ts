import { type Address, type Hash, type Abi, type Hex } from 'viem'
import { useWalletClient, usePublicClient } from 'wagmi'
import { getContractABI } from '../catalog'
import { useEffect, useState, useMemo } from 'react'

// TODO: Implement proper contract bytecode fetching
// This is a temporary mock that returns a minimal valid bytecode
// Replace this with actual implementation that fetches real bytecode
const getMockBytecode = () => {
  return '0x6080604052348015600f57600080fd5b50604051602080608183398101806040' + 
         '5281815160007300000000000000000000000000000000000000001'
}

export interface DeploymentConfig {
  contractId: string
  args?: any[]
  libraries?: Record<string, Address>  // Add support for library addresses
}

export interface DeploymentResult {
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash?: Hash
  address?: Address
  deploy: (deployArgs?: any[]) => Promise<void>
}

interface DeploymentData {
  hash: Hash
  address: Address
}

export function useContractDeployment(config: DeploymentConfig): DeploymentResult {
  const { contractId, args = [], libraries = {} } = config
  const [abi, setAbi] = useState<Abi | null>(null)
  const [bytecode, setBytecode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [deploymentData, setDeploymentData] = useState<DeploymentData | null>(null)

  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Load ABI and bytecode
  useEffect(() => {
    Promise.all([
      getContractABI(contractId),
      getMockBytecode()
    ])
      .then(([contractAbi, contractBytecode]) => {
        setAbi(contractAbi)
        setBytecode(contractBytecode)
      })
      .catch(error => {
        setError(error as Error)
        setIsError(true)
      })
  }, [contractId])

  // Link libraries in bytecode
  const linkedBytecode = useMemo(() => {
    if (!bytecode) return null
    
    // Ensure bytecode starts with 0x
    let processedBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
    
    console.log('Initial bytecode:', {
      length: processedBytecode.length,
      hasPrefix: bytecode.startsWith('0x'),
      start: processedBytecode.slice(0, 64)
    })

    for (const [libName, libAddress] of Object.entries(libraries)) {
      // Remove '0x' prefix if it exists
      const cleanAddress = libAddress.toLowerCase().replace('0x', '')
      
      // Try different placeholder formats
      const placeholderFormats = [
        `__${libName}_`.padEnd(40, '_'),              // Format 1: __LibName___...
        `__\$${libName}$__`,                          // Format 2: __$LibName$__
        `__${libName}${cleanAddress.slice(0, 36)}__`  // Format 3: __LibNameAddress__
      ]
      
      console.log('Attempting library linking:', {
        name: libName,
        address: cleanAddress,
        placeholders: placeholderFormats
      })

      let replaced = false
      for (const placeholder of placeholderFormats) {
        const beforeReplace = processedBytecode
        processedBytecode = processedBytecode.replace(new RegExp(placeholder, 'g'), cleanAddress)
        
        if (beforeReplace !== processedBytecode) {
          console.log('Successfully linked library using placeholder:', placeholder)
          replaced = true
          break
        }
      }
      
      if (!replaced) {
        // Search for any placeholder-like pattern for this library
        const libraryPattern = new RegExp(`__${libName}[_$0-9a-fA-F]*__`)
        const match = processedBytecode.match(libraryPattern)
        if (match) {
          console.log('Found non-standard library placeholder:', match[0])
          processedBytecode = processedBytecode.replace(libraryPattern, cleanAddress)
          replaced = true
        }
      }

      if (!replaced) {
        console.warn(`No matching placeholder found for library: ${libName}`)
      }
    }

    // Additional validation
    console.log('Final bytecode:', {
      length: processedBytecode.length,
      containsUnderscores: processedBytecode.includes('__'),
      start: processedBytecode.slice(0, 64),
      containsLibraryPattern: processedBytecode.includes('__$') || processedBytecode.match(/__[a-zA-Z0-9]+__/)
    })

    // Validate final bytecode
    if (!/^[0-9a-f]*$/i.test(processedBytecode)) {
      const invalidIndex = processedBytecode.split('').findIndex(char => !/[0-9a-f]/i.test(char))
      console.error('Invalid bytecode format after linking:', {
        position: invalidIndex,
        character: processedBytecode[invalidIndex],
        context: processedBytecode.slice(Math.max(0, invalidIndex - 20), invalidIndex + 20)
      })
      return null
    }

    return processedBytecode
  }, [bytecode, libraries])

  return {
    isLoading,
    isError,
    error,
    isSuccess,
    hash: deploymentData?.hash,
    address: deploymentData?.address,
    deploy: async (deployArgs?: any[]) => {
      if (!walletClient || !abi || !linkedBytecode) {
        throw new Error('Contract ABI, bytecode, or wallet not available')
      }

      setIsLoading(true)
      setIsError(false)
      setError(null)
      
      try {
        if (!publicClient) {
          throw new Error('Public client not available')
        }

        // Use provided args or fall back to config args
        const constructorArgs = deployArgs || args

        // Ensure bytecode is properly formatted
        const deployBytecode = (linkedBytecode.startsWith('0x') ? linkedBytecode : `0x${linkedBytecode}`) as Hex
        
        console.log('Deploying contract with:', {
          bytecodeLength: deployBytecode.length,
          bytecodeStart: deployBytecode.slice(0, 64),
          args: constructorArgs,
          libraries: Object.keys(libraries).length > 0 ? libraries : 'No libraries'
        })

        const hash = await walletClient.deployContract({
          abi,
          bytecode: deployBytecode,
          args: constructorArgs
        })

        console.log('Deployment transaction hash:', hash)
        console.log('Waiting for transaction confirmation...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        
        console.log('Transaction receipt:', {
          status: receipt.status,
          gasUsed: receipt.gasUsed,
          blockNumber: receipt.blockNumber,
          contractAddress: receipt.contractAddress
        })

        if (receipt.status === 'success') {
          setDeploymentData({
            hash,
            address: receipt.contractAddress as Address
          })
          setIsSuccess(true)
        } else {
          throw new Error('Contract deployment failed')
        }
      } catch (err) {
        console.error('Deployment error:', err)
        setError(err as Error)
        setIsError(true)
        throw err
      } finally {
        setIsLoading(false)
      }
    }
  }
} 