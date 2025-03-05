import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isValidEthereumAddress } from '@/lib/utils'
import { SecureContractInfo } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Timer } from 'lucide-react'
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
}

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
  connectedAddress
}: TemporalActionDialogProps) {
  const [newValue, setNewValue] = useState('')
  const { toast } = useToast()

  // Clear input when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue('')
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
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
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !isCorrectRole() || (!contractInfo?.recoveryAddress && !isValidEthereumAddress(newValue))}
          >
            {isLoading ? "Processing..." : actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 