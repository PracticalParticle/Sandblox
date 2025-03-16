import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { useContractDeployment } from '../lib/deployment'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useChainId, useConfig, useWalletClient, useAccount } from 'wagmi'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { isAddress } from 'viem'
import { env } from '@/config/env'
import { useDeployedContract } from '@/contexts/DeployedContractContext'
import type { SecureContractInfo } from '@/lib/types'

interface ConstructorParam {
  name: string
  type: string
  description: string
  required: boolean
  label?: string
  defaultValue?: string | number
  validation?: {
    min?: number
    max?: number
  }
}

interface Constructor {
  requiresParams: boolean
  description?: string
  params?: ConstructorParam[]
}

interface BloxConfig {
  id: string
  name: string
  description: string
  category: string
  securityLevel: string
  features: string[]
  requirements: string[]
  deployments: number
  lastUpdated: string
  libraries?: Record<string, { name: string; description: string }>
  constructor: Constructor
}

interface DeploymentDialogProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  contractName: string
  bloxConfig: BloxConfig
}

interface FormData {
  [key: string]: string
}

const DEFAULT_CONSTRUCTOR: Constructor = {
  requiresParams: false,
  params: []
}

const DEFAULT_BLOX_CONFIG: BloxConfig = {
  id: '',
  name: '',
  description: '',
  category: '',
  securityLevel: '',
  features: [],
  requirements: [],
  deployments: 0,
  lastUpdated: '',
  constructor: DEFAULT_CONSTRUCTOR
}

export function DeploymentDialog({
  isOpen,
  onClose,
  contractId,
  contractName,
  bloxConfig = DEFAULT_BLOX_CONFIG
}: DeploymentDialogProps) {
  const chainId = useChainId()
  const config = useConfig()
  const { address } = useAccount()
  const [deploymentStarted, setDeploymentStarted] = useState(false)
  const [formData, setFormData] = useState<FormData>({})
  const [formErrors, setFormErrors] = useState<FormData>({})
  const { addDeployedContract } = useDeployedContract()
  const [contractAdded, setContractAdded] = useState(false)
  const { data: walletClient } = useWalletClient()

  // Initialize form data with default values
  useEffect(() => {
    if (!bloxConfig?.constructor) return

    const constructor = bloxConfig.constructor
    if (constructor.requiresParams && constructor.params) {
      const initialData: FormData = {}
      constructor.params.forEach(param => {
        if (param.defaultValue !== undefined) {
          initialData[param.name] = param.defaultValue.toString()
        } else if (param.name === 'initialOwner' && address) {
          initialData[param.name] = address
        } else if (param.type === 'uint256' && param.validation?.min !== undefined) {
          initialData[param.name] = param.validation.min.toString()
        } else {
          initialData[param.name] = ''
        }
      })
      setFormData(initialData)
    }
  }, [bloxConfig?.constructor, address])

  const {
    deploy,
    isLoading,
    isError,
    error,
    isSuccess,
    hash,
    address: contractAddress,
  } = useContractDeployment({
    contractId,
    libraries: bloxConfig?.libraries?.MultiPhaseSecureOperation ? {
      MultiPhaseSecureOperation: env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION as `0x${string}`
    } : {}
  })

  useEffect(() => {
      if (isSuccess && contractAddress && !contractAdded) {
        const contractInfo: SecureContractInfo = {
          contractAddress: contractAddress,
          timeLockPeriodInMinutes: convertToMinutes(formData.timeLockPeriod, formData.timeUnit),
          chainId,
          chainName: getChainName(),
          broadcaster: formData.broadcaster,
          owner: formData.initialOwner,
          recoveryAddress: formData.recovery,
          contractType: contractId,
          contractName: contractName
        }

        addDeployedContract(contractInfo)
        setContractAdded(true)
      }
    }, [isSuccess, contractAddress, formData, chainId, contractId, contractName, addDeployedContract, contractAdded])

    useEffect(() => {
      if (!isOpen) {
        setContractAdded(false)
      }
    }, [isOpen])


  const validateForm = () => {
    if (!bloxConfig?.constructor?.requiresParams) return true

    const errors: FormData = {}

    bloxConfig.constructor.params?.forEach((param) => {
      if (!formData[param.name] && param.required) {
        errors[param.name] = 'This field is required'
      } else if (param.type === 'address' && formData[param.name] && !isAddress(formData[param.name])) {
        errors[param.name] = 'Invalid address'
      } else if (param.type === 'uint256' && formData[param.name]) {
        const value = parseInt(formData[param.name])
        if (isNaN(value)) {
          errors[param.name] = 'Must be a valid number'
        } else if (param.validation?.min !== undefined && value < param.validation.min) {
          errors[param.name] = `Must be at least ${param.validation.min}`
        } else if (param.validation?.max !== undefined && value > param.validation.max) {
          errors[param.name] = `Must be at most ${param.validation.max}`
        }
      }
    })

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const getConstructorParams = () => {
    if (!bloxConfig?.constructor?.requiresParams) return []

    return bloxConfig.constructor.params?.map((param) => {
      const value = formData[param.name]
      if (param.type === 'uint256') {
        return parseInt(value)
      }
      return value
    }) ?? []
  }

  const handleDeploy = async () => {
    if (!validateForm()) return

    setDeploymentStarted(true)
    try {
      if (!walletClient) {
        throw new Error("Wallet client is not available")
      }

      await deploy(getConstructorParams())

      console.log("Transaction sent")
    } catch (err) {
      console.error("Deployment error:", err)
      setDeploymentStarted(false)
    }
  }

  const getExplorerLink = () => {
    if (!hash) return '#'
    const chain = config.chains.find(c => c.id === chainId)
    if (!chain?.blockExplorers?.default?.url) return '#'
    return `${chain.blockExplorers.default.url}/tx/${hash}`
  }

  const getChainName = () => {
    const chain = config.chains.find(c => c.id === chainId)
    return chain?.name || 'the current network'
  }

  const renderFormFields = () => {
    if (!bloxConfig?.constructor?.requiresParams) return null

    return (
      <div className="space-y-4">
        {bloxConfig.constructor.params?.map((param) => (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label || param.name}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={param.name}
              value={formData[param.name] || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, [param.name]: e.target.value }))}
              placeholder={param.type === 'address' ? '0x...' : ''}
              type={param.type === 'uint256' ? 'number' : 'text'}
              min={param.validation?.min}
              max={param.validation?.max}
              required={param.required}
            />
            <p className="text-xs text-muted-foreground">
              {param.description}
            </p>
            {formErrors[param.name] && (
              <p className="text-sm text-destructive">{formErrors[param.name]}</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deploy {contractName}</DialogTitle>
          <DialogDescription>
            Deploy this contract to the current network. Make sure you have enough funds to cover the gas fees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!deploymentStarted ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are about to deploy the {contractName} contract to {getChainName()}.
                {bloxConfig.constructor?.requiresParams && " Please configure the constructor parameters below."}
              </p>

              {renderFormFields()}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleDeploy}>
                  Deploy Contract
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isLoading && (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Deploying contract...
                  </p>
                </div>
              )}

              {isError && (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <div className="text-center">
                    <p className="font-semibold">Deployment Failed</p>
                    <p className="text-sm text-muted-foreground">
                      {error?.message || 'Something went wrong during deployment.'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}

              {isSuccess && (
                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Deployment Successful</p>
                    <p className="text-sm text-muted-foreground">
                      Your contract has been deployed successfully.
                    </p>
                    <p className="mt-2 font-mono text-sm break-all">
                      Contract Address: {contractAddress}
                    </p>
                    <a
                      href={getExplorerLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      View on Explorer
                    </a>
                  </div>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 