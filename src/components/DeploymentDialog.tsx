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

interface DeploymentDialogProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  contractName: string
}

interface FormData {
  initialOwner: string
  broadcaster: string
  recovery: string
  timeLockPeriodInDays: string
}

export function DeploymentDialog({ isOpen, onClose, contractId, contractName }: DeploymentDialogProps) {
  const chainId = useChainId()
  const config = useConfig()
  const { address } = useAccount()
  const [deploymentStarted, setDeploymentStarted] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    initialOwner: address || '',
    broadcaster: '',
    recovery: '',
    timeLockPeriodInDays: '7'
  })
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({})
  const { addDeployedContract } = useDeployedContract()
  
  const { data: walletClient } = useWalletClient()

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
    libraries: {
      MultiPhaseSecureOperation: env.VITE_LIBRARY_MULTI_PHASE_SECURE_OPERATION as `0x${string}`
    }
  })

  useEffect(() => {
    if (isSuccess && contractAddress) {
      const contractInfo: SecureContractInfo = {
        contractAddress: contractAddress,
        timeLockPeriodInMinutes: parseInt(formData.timeLockPeriodInDays) * 24 * 60,
        chainId,
        chainName: getChainName(),
        broadcaster: formData.broadcaster,
        owner: formData.initialOwner,
        recoveryAddress: formData.recovery,
        contractType: contractId,
        contractName: contractName
      }
      
      addDeployedContract(contractInfo)
    }
  }, [isSuccess, contractAddress, formData, chainId, contractId, contractName, addDeployedContract])

  const validateForm = () => {
    const errors: Partial<FormData> = {}
    
    if (!isAddress(formData.initialOwner)) {
      errors.initialOwner = 'Invalid address'
    }
    if (!isAddress(formData.broadcaster)) {
      errors.broadcaster = 'Invalid address'
    }
    if (!isAddress(formData.recovery)) {
      errors.recovery = 'Invalid address'
    }
    
    const days = parseInt(formData.timeLockPeriodInDays)
    if (isNaN(days) || days < 1) {
      errors.timeLockPeriodInDays = 'Must be a positive number'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleDeploy = async () => {
    if (!validateForm()) return
    
    setDeploymentStarted(true)
    try {
      if (!walletClient) {
        throw new Error("Wallet client is not available")
      }
      
      await deploy([
        formData.initialOwner,
        formData.broadcaster,
        formData.recovery,
        parseInt(formData.timeLockPeriodInDays)
      ])
      
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
                Please configure the constructor parameters below.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="initialOwner">Initial Owner</Label>
                  <Input
                    id="initialOwner"
                    value={formData.initialOwner}
                    onChange={(e) => setFormData(prev => ({ ...prev, initialOwner: e.target.value }))}
                    placeholder="0x..."
                  />
                  {formErrors.initialOwner && (
                    <p className="text-sm text-destructive">{formErrors.initialOwner}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcaster">Broadcaster</Label>
                  <Input
                    id="broadcaster"
                    value={formData.broadcaster}
                    onChange={(e) => setFormData(prev => ({ ...prev, broadcaster: e.target.value }))}
                    placeholder="0x..."
                  />
                  {formErrors.broadcaster && (
                    <p className="text-sm text-destructive">{formErrors.broadcaster}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recovery">Recovery Address</Label>
                  <Input
                    id="recovery"
                    value={formData.recovery}
                    onChange={(e) => setFormData(prev => ({ ...prev, recovery: e.target.value }))}
                    placeholder="0x..."
                  />
                  {formErrors.recovery && (
                    <p className="text-sm text-destructive">{formErrors.recovery}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeLockPeriodInDays">Time Lock Period (days)</Label>
                  <Input
                    id="timeLockPeriodInDays"
                    type="number"
                    min="1"
                    value={formData.timeLockPeriodInDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeLockPeriodInDays: e.target.value }))}
                  />
                  {formErrors.timeLockPeriodInDays && (
                    <p className="text-sm text-destructive">{formErrors.timeLockPeriodInDays}</p>
                  )}
                </div>
              </div>

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
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div className="text-center">
                    <p className="font-semibold">Deployment Successful!</p>
                    <p className="text-sm text-muted-foreground">
                      Your contract has been deployed successfully.
                    </p>
                    <p className="mt-2 font-mono text-sm">
                      Contract Address: {contractAddress}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                    <Button asChild>
                      <a
                        href={getExplorerLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Explorer
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 