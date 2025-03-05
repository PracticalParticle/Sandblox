import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isValidEthereumAddress } from '@/lib/utils'
import { SecureContractInfo } from '@/lib/types'
import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { Badge } from '@/components/ui/badge'
import { Timer, Loader2, X, CheckCircle2, AlertCircle, Wallet } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TemporalActionDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contractInfo: SecureContractInfo | null
  actionType: 'ownership_transfer' | 'broadcaster_update'
  currentValue: string
  currentValueLabel: string
  actionLabel: string
  isLoading?: boolean
  onSubmit: (newValue: string) => Promise<void>
  requiredRole: 'owner' | 'recovery' | 'broadcaster'
  connectedAddress?: string
  pendingTx?: TxRecord | null
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
}

// Helper function to format addresses
const formatAddress = (address: string | undefined | null): string => {
  if (!address || typeof address !== 'string' || address.length < 10) {
    return address || 'Invalid address';
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function TemporalActionDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  actionType,
  currentValue,
  currentValueLabel,
  actionLabel,
  isLoading = false,
  onSubmit,
  requiredRole,
  connectedAddress,
  pendingTx,
  onApprove,
  onCancel
}: TemporalActionDialogProps) {
  const [newValue, setNewValue] = useState('')
  const { toast } = useToast()
  const [isApproving, setIsApproving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Clear input when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue('')
      setIsApproving(false)
      setIsCancelling(false)
    }
  }, [isOpen])

  // Check if connected wallet matches required role
  const isCorrectRole = () => {
    if (!connectedAddress || !contractInfo) return false
    
    switch (requiredRole) {
      case 'owner':
        return connectedAddress.toLowerCase() === contractInfo.owner.toLowerCase()
      case 'broadcaster':
        return connectedAddress.toLowerCase() === contractInfo.broadcaster.toLowerCase()
      case 'recovery':
        return connectedAddress.toLowerCase() === contractInfo.recoveryAddress.toLowerCase()
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (!isCorrectRole()) {
      toast({
        title: "Error",
        description: `Please connect with the ${requiredRole} wallet to proceed`,
        variant: "destructive"
      })
      return
    }

    // For ownership transfer, the new value is fixed to recovery address
    if (actionType === 'ownership_transfer' && contractInfo) {
      await onSubmit(contractInfo.recoveryAddress)
      onOpenChange(false)
      return
    }

    // For other actions, validate the new value
    if (!isValidEthereumAddress(newValue)) {
      toast({
        title: "Error",
        description: "Please enter a valid Ethereum address",
        variant: "destructive"
      })
      return
    }

    await onSubmit(newValue)
    onOpenChange(false)
  }

  const handleApprove = async () => {
    if (!pendingTx || !onApprove) return
    
    try {
      setIsApproving(true)
      await onApprove(Number(pendingTx.txId))
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error approving transaction:', error)
      toast({
        title: "Error",
        description: "Failed to approve transaction",
        variant: "destructive"
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleCancel = async () => {
    if (!pendingTx || !onCancel) return
    
    try {
      setIsCancelling(true)
      await onCancel(Number(pendingTx.txId))
      toast({
        title: "Success",
        description: "Transaction cancelled successfully",
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error cancelling transaction:', error)
      toast({
        title: "Error",
        description: "Failed to cancel transaction",
        variant: "destructive"
      })
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{pendingTx ? `${title} Approval` : title}</DialogTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    <span>Temporal</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Two-phase temporal security</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {!pendingTx ? (
          // Request Phase UI
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{currentValueLabel}</Label>
              <div className="p-3 bg-muted rounded-md break-all">
                {currentValue}
              </div>
            </div>

            {actionType !== 'ownership_transfer' && (
              <div className="space-y-2">
                <Label>New Address</Label>
                <Input
                  placeholder="Enter new address"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className={!isValidEthereumAddress(newValue) && newValue !== "" ? "border-destructive" : ""}
                />
                {!isValidEthereumAddress(newValue) && newValue !== "" && (
                  <p className="text-sm text-destructive">
                    Please enter a valid Ethereum address
                  </p>
                )}
              </div>
            )}

            {actionType === 'ownership_transfer' && contractInfo && (
              <div className="space-y-2">
                <Label>New Owner Address (Recovery Address)</Label>
                <div className="p-3 bg-muted rounded-md break-all">
                  {contractInfo.recoveryAddress}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !isCorrectRole() || (!contractInfo?.recoveryAddress && !isValidEthereumAddress(newValue))}
              >
                {isLoading ? "Processing..." : actionLabel}
              </Button>
            </div>
          </div>
        ) : (
          // Approval Phase UI
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                {connectedAddress ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Connected Wallet</span>
                        <span className="text-xs text-muted-foreground">
                          {formatAddress(connectedAddress)}
                        </span>
                      </div>
                    </div>
                    {!isCorrectRole() && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Connected wallet does not match the required role. Please connect the correct wallet.
                        </AlertDescription>
                      </Alert>
                    )}
                    {isCorrectRole() && (
                      <Alert>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-500">
                          Wallet connected successfully!
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Transaction ID:</p>
                      <code className="text-xs">#{pendingTx.txId.toString()}</code>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handleApprove}
                        disabled={!isCorrectRole() || isApproving || isCancelling}
                        className="w-full"
                        variant="default"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            <span>Approve</span>
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        disabled={!isCorrectRole() || isApproving || isCancelling}
                        className="w-full"
                        variant="destructive"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>Cancelling...</span>
                          </>
                        ) : (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            <span>Cancel</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: "Action Required",
                        description: "Please connect your wallet using the connect button in the header",
                      })
                    }}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Required Wallet
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 