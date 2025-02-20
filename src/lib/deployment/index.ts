import { type Address, type Hash, type Abi } from 'viem'
import { useWriteContract, useWatchContractEvent, useSimulateContract } from 'wagmi'
import { getContractABI } from '../catalog'
import { useEffect, useState } from 'react'

export interface DeploymentConfig {
  contractId: string
  args?: any[]
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

interface DeploymentData {
  hash: Hash
  address: Address
}

export function useContractDeployment(config: DeploymentConfig): DeploymentResult {
  const { contractId, args = [] } = config
  const [abi, setAbi] = useState<Abi | null>(null)

  // Load ABI
  useEffect(() => {
    getContractABI(contractId)
      .then((contractAbi) => setAbi(contractAbi))
      .catch(console.error)
  }, [contractId])

  // Prepare contract deployment
  const { data: simulateData, error: simulateError } = useSimulateContract({
    abi: abi || [],
    functionName: 'constructor',
    args,
  })

  // Contract deployment transaction
  const { 
    writeContract: deploy,
    data: deployData,
    error: deployError,
    isPending: isDeploying,
    isSuccess,
  } = useWriteContract()

  // Watch for contract creation event
  useWatchContractEvent({
    address: deployData ? (deployData as unknown as DeploymentData).address : undefined,
    abi: abi || [],
    eventName: 'Transfer',
    enabled: !!deployData && !!abi,
  })

  const error = simulateError || deployError
  const isLoading = isDeploying

  return {
    isLoading,
    isError: !!error,
    error: error as Error | null,
    isSuccess,
    hash: deployData ? (deployData as unknown as DeploymentData).hash : undefined,
    address: deployData ? (deployData as unknown as DeploymentData).address : undefined,
    deploy: async () => {
      if (simulateData?.request && abi) {
        await deploy(simulateData.request)
      }
    },
  }
} 