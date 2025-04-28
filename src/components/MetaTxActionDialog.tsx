import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Radio, Network } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { formatAddress, convertToMinutes } from "@/lib/utils"
import { TxInfoCard } from "./TxInfoCard"
import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { useState, useEffect, FormEvent } from "react"
import { useWorkflowManager } from "@/hooks/useWorkflowManager"
import { CoreOperationType, OperationPhase } from "../types/OperationRegistry"
import { Address } from "viem"

interface MetaTxActionDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contractInfo: {
    chainId: number
    chainName: string
    broadcaster: string
    owner: string
    contractAddress: string
    [key: string]: any
  }
  actionType: string
  currentValue: string
  currentValueLabel: string
  actionLabel: string
  isLoading?: boolean
  onSubmit?: (signedTx: string) => Promise<void>
  requiredRole: string
  connectedAddress?: string
  newValue: string
  onNewValueChange: (value: string) => void
  newValueLabel: string
  newValuePlaceholder?: string
  validateNewValue?: (value: string) => { isValid: boolean; message?: string }
  isSigning?: boolean
  customInput?: React.ReactNode
  transactionRecord?: TxRecord
  operationName?: string
  refreshData?: () => void
  refreshSignedTransactions?: () => void
  timeLockUnit?: 'days' | 'hours' | 'minutes'
}

export function MetaTxActionDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  actionType,
  currentValue,
  currentValueLabel,
  actionLabel,
  isLoading: externalIsLoading = false,
  onSubmit,
  requiredRole,
  connectedAddress,
  newValue,
  onNewValueChange,
  newValueLabel,
  newValuePlaceholder,
  validateNewValue,
  isSigning: externalIsSigning = false,
  customInput,
  transactionRecord,
  operationName,
  refreshData,
  refreshSignedTransactions,
  timeLockUnit = 'minutes'
}: MetaTxActionDialogProps) {
  // Use the WorkflowManager hook with enhanced role validation
  const {
    isLoading: workflowIsLoading,
    signSinglePhaseOperation,
    canExecutePhase,
    isOwner,
    isBroadcaster,
    isRecovery
  } = useWorkflowManager(contractInfo.contractAddress as `0x${string}`)

  // Local state
  const [isSigning, setIsSigning] = useState(false)
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSigning(false)
    }
  }, [isOpen])

  // Map the actionType to a core operation type
  const getOperationType = () => {
    switch (actionType) {
      case 'timelock':
        return CoreOperationType.TIMELOCK_UPDATE
      case 'recovery':
        return CoreOperationType.RECOVERY_UPDATE
      case 'ownership':
        return CoreOperationType.OWNERSHIP_TRANSFER
      case 'broadcaster':
        return CoreOperationType.BROADCASTER_UPDATE
      default:
        return actionType // Custom operation type
    }
  }

  // Check if wallet is valid based on required role directly using role validation results
  const isWalletValidForRole = () => {
    switch (requiredRole) {
      case 'owner':
        return isOwner
      case 'broadcaster':
        return isBroadcaster
      case 'recovery':
        return isRecovery
      case 'owner_or_recovery':
        return isOwner || isRecovery
      default:
        // If the requiredRole doesn't match our known roles, fall back to phase checking
        return canExecutePhase(
          getOperationType(), 
          OperationPhase.REQUEST, 
          connectedAddress as Address
        )
    }
  }

  // Combine direct role check with canExecutePhase check for maximum reliability
  const isWalletValidForRequest = isWalletValidForRole()

  // Validate the new value
  const validationResult = validateNewValue ? validateNewValue(newValue) : { isValid: true }

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSigning(true)
      const operationType = getOperationType()
      
      // Prepare parameters based on operation type
      let params: any = {}
      
      if (operationType === CoreOperationType.RECOVERY_UPDATE) {
        params = { newRecoveryAddress: newValue as Address }
      } else if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
        // For timelock updates, we need to convert the value to minutes first
        const minutes = convertToMinutes(newValue, timeLockUnit)
        params = { newTimeLockPeriodInMinutes: BigInt(minutes) }
      } else {
        // For custom operations
        params = { newValue }
      }
      
      // Sign the operation - WorkflowManager will handle storage
      await signSinglePhaseOperation(operationType, params)
      
      // Close the dialog on success
      onOpenChange(false)
      
      // Refresh all data after successful operation
      if (refreshData) {
        refreshData()
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Submit error:", error)
    } finally {
      setIsSigning(false)
    }
  }

  // Combined loading state
  const isLoadingState = externalIsLoading || workflowIsLoading || isSigning || externalIsSigning

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-full max-h-[85vh] overflow-y-auto p-4 overflow-x-hidden">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="secondary" 
                      className="flex items-center gap-1 cursor-help hover:bg-secondary/80"
                    >
                      <Network className="h-3 w-3" />
                      <span>Meta Tx</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    align="end"
                    className="max-w-[200px] text-xs bg-popover/95 backdrop-blur-sm"
                  >
                    Single-phase meta tx security
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <DialogDescription>
              {description || `Update the ${actionType}. This will be executed via meta-transaction.`}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display transaction info if a record is provided */}
          {transactionRecord && (
            <TxInfoCard 
              record={transactionRecord}
              operationName={operationName || actionType}
              showExecutionType={true}
              showStatus={true}
            />
          )}

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{currentValueLabel}</Label>
                    <div className="p-2 bg-muted rounded-lg">
                      <code className="text-sm">{currentValue}</code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newValue">{newValueLabel}</Label>
                    {customInput || (
                      <Input
                        id="newValue"
                        value={newValue}
                        onChange={(e) => onNewValueChange(e.target.value)}
                        placeholder={newValuePlaceholder}
                        disabled={isLoadingState}
                        className={`w-full ${!validationResult.isValid && newValue ? "border-destructive" : ""}`}
                      />
                    )}
                    {!validationResult.isValid && newValue && (
                      <p className="text-sm text-destructive">
                        {validationResult.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>Broadcaster Required</span>
                    <span className="text-muted-foreground">{formatAddress(contractInfo.broadcaster)}</span>
                  </div>

                  {!isWalletValidForRequest && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Please connect the {requiredRole} wallet to proceed
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="w-full">
                    <Button 
                      type="submit"
                      disabled={!newValue || !validationResult.isValid || !isWalletValidForRequest || isLoadingState}
                      className="w-full"
                    >
                      {isLoadingState ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing...
                        </>
                      ) : (
                        <>
                          <Radio className="mr-2 h-4 w-4" />
                          {actionLabel}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
} 