import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { useContractDeployment } from '../lib/deployment'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useChainId, useConfig } from 'wagmi'

interface DeploymentDialogProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  contractName: string
}

export function DeploymentDialog({ isOpen, onClose, contractId, contractName }: DeploymentDialogProps) {
  const chainId = useChainId()
  const config = useConfig()
  const [deploymentStarted, setDeploymentStarted] = useState(false)

  const {
    deploy,
    isLoading,
    isError,
    error,
    isSuccess,
    hash,
  } = useContractDeployment({
    contractId,
  })

  const handleDeploy = () => {
    setDeploymentStarted(true)
    deploy()
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
                This action cannot be undone.
              </p>
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