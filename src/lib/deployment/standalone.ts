import { type Address, type Hash, type Abi, type TransactionReceipt, encodeFunctionData, parseAbi } from 'viem'
import { useWriteContract, useWatchContractEvent, useSimulateContract, usePublicClient } from 'wagmi'
import { useEffect, useState, useMemo } from 'react'

// Enhanced interface for standalone deployment
export interface StandaloneDeploymentConfig {
  solidityCode: string
  libraries?: Record<string, Address>
  constructorArgs?: any[]
  compilerVersion?: string
  optimizerRuns?: number
}

export interface DeploymentResult {
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  hash?: Hash
  address?: Address
  deploy: () => Promise<void>
}

interface CompilationResult {
  abi: Abi
  bytecode: string
}

interface DeploymentData {
  hash: Hash
  address: Address
}

interface CompilerError {
  severity: 'error' | 'warning'
  formattedMessage: string
}

interface CompilerOutput {
  errors?: CompilerError[]
  contracts: {
    [file: string]: {
      [contract: string]: {
        abi: Abi
        evm: {
          bytecode: {
            object: string
          }
        }
      }
    }
  }
}

interface SolcWrapper {
  compile: (input: string) => string
  version: () => string
}

let solcCache: Record<string, SolcWrapper> = {}

async function loadCompiler(version: string): Promise<SolcWrapper> {
  if (solcCache[version]) {
    return solcCache[version]
  }

  try {
    // @ts-ignore
    const solc = await import('solc')
    const compiler = solc.default as SolcWrapper

    // Cache the compiler instance
    solcCache[version] = compiler
    return compiler
  } catch (error) {
    throw new Error(`Failed to load Solidity compiler version ${version}: ${error}`)
  }
}

export function useStandaloneDeployment(config: StandaloneDeploymentConfig): DeploymentResult {
  const { 
    solidityCode, 
    libraries = {}, 
    constructorArgs = [], 
    compilerVersion = '0.8.25',
    optimizerRuns = 200 
  } = config

  const publicClient = usePublicClient()
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null)
  const [compilationError, setCompilationError] = useState<Error | null>(null)

  // Compile contract when code changes
  useEffect(() => {
    const compileContract = async () => {
      try {
        const compiler = await loadCompiler(compilerVersion)
        
        const input = {
          language: 'Solidity' as const,
          sources: {
            'Contract.sol': {
              content: solidityCode
            }
          },
          settings: {
            optimizer: { 
              enabled: true, 
              runs: optimizerRuns 
            },
            outputSelection: {
              '*': {
                '*': ['abi', 'evm.bytecode']
              }
            }
          }
        }

        const output = JSON.parse(compiler.compile(JSON.stringify(input))) as CompilerOutput
        
        if (output.errors?.some((e: CompilerError) => e.severity === 'error')) {
          throw new Error(output.errors.map((e: CompilerError) => e.formattedMessage).join('\n'))
        }

        // Find the first contract in the output
        const contracts = output.contracts['Contract.sol']
        if (!contracts) {
          throw new Error('No contracts found in compilation output')
        }

        const [contractName, contract] = Object.entries(contracts)[0] as [string, { abi: Abi; evm: { bytecode: { object: string } } }]
        if (!contract) {
          throw new Error('No contract found in compilation output')
        }

        setCompilationResult({
          abi: contract.abi,
          bytecode: contract.evm.bytecode.object
        })
        setCompilationError(null)
      } catch (error) {
        setCompilationError(error as Error)
        setCompilationResult(null)
      }
    }

    compileContract()
  }, [solidityCode, compilerVersion, optimizerRuns])

  // Link libraries in bytecode
  const linkedBytecode = useMemo(() => {
    if (!compilationResult?.bytecode) return ''
    
    let bytecode = compilationResult.bytecode
    for (const [libName, libAddress] of Object.entries(libraries)) {
      const placeholder = `__\$${libName.padEnd(36, '_')}\$__`
      bytecode = bytecode.replace(new RegExp(placeholder, 'g'), libAddress.slice(2))
    }
    return `0x${bytecode}`
  }, [compilationResult, libraries])

  // Prepare deployment
  const { data: simulateData, error: simulateError } = useSimulateContract({
    abi: compilationResult?.abi || [],
    functionName: 'constructor',
    args: constructorArgs,
  })

  // Contract deployment transaction
  const { 
    writeContract: deploy,
    data: deployData,
    error: deployError,
    isPending: isDeploying,
    isSuccess,
  } = useWriteContract()

  // Watch for deployment events
  useWatchContractEvent({
    address: (deployData as DeploymentData | undefined)?.address,
    abi: compilationResult?.abi || [],
    eventName: 'ContractDeployed',
    enabled: !!deployData && !!compilationResult?.abi,
  })

  const error = compilationError || simulateError || deployError
  const isLoading = isDeploying

  return {
    isLoading,
    isError: !!error,
    error: error as Error | null,
    isSuccess,
    hash: (deployData as DeploymentData | undefined)?.hash,
    address: (deployData as DeploymentData | undefined)?.address,
    deploy: async () => {
      if (!compilationResult || !linkedBytecode) {
        throw new Error('Contract compilation failed or bytecode linking error')
      }

      if (simulateData?.request) {
        const { request } = simulateData
        await deploy({
          ...request,
          functionName: 'constructor',
          args: constructorArgs,
          abi: compilationResult.abi,
        })
      }
    },
  }
} 