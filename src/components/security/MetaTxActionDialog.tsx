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
import { TxInfoCard } from "../TxInfoCard"
import { TxRecord } from '../../Guardian/sdk/typescript/interfaces/lib.index'
import { useState, useEffect, FormEvent } from "react"
import { useWorkflowManager } from "@/hooks/useWorkflowManager"
import { CoreOperationType, OperationPhase } from "../../types/OperationRegistry"
import { Address } from "viem"
import { extractErrorInfo } from '../../Guardian/sdk/typescript/utils/contract-errors'
import { useToast } from "@/components/ui/use-toast"

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
  isSigning?: boolean
  customInput?: React.ReactNode
  transactionRecord?: TxRecord
  operationName?: string
  refreshData?: () => void
  refreshSignedTransactions?: () => void
  timeLockUnit?: 'days' | 'hours' | 'minutes' | 'seconds'
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
  requiredRole,
  connectedAddress,
  newValue,
  onNewValueChange,
  newValueLabel,
  newValuePlaceholder,
  isSigning: externalIsSigning = false,
  customInput,
  transactionRecord,
  operationName,
  refreshData,
  timeLockUnit = 'minutes'
}: MetaTxActionDialogProps) {
  // Use the Guardian SDK hook
  const {
    isLoading: workflowIsLoading,
    signSinglePhaseOperation,
    canExecutePhase,
    isOwner,
    isBroadcaster,
    isRecovery,
    secureOwnable
  } = useWorkflowManager(contractInfo.contractAddress as `0x${string}`)
  
  const { toast } = useToast()

  // Local state
  const [isSigning, setIsSigning] = useState(false)
  const [validationState, setValidationState] = useState<{ isValid: boolean; message?: string }>({ isValid: true })
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSigning(false)
      setValidationState({ isValid: true })
    }
  }, [isOpen])

  // Validate input when it changes using SDK
  useEffect(() => {
    if (newValue && newValue.trim() && secureOwnable) {
      validateWithSDK(newValue).then(result => {
        setValidationState(result)
      }).catch(() => {
        setValidationState({ isValid: false, message: "Validation failed" })
      })
    } else {
      setValidationState({ isValid: true })
    }
  }, [newValue, timeLockUnit, secureOwnable])

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

  // SDK-based validation using contract validations
  const validateWithSDK = async (value: string): Promise<{ isValid: boolean; message?: string }> => {
    if (!secureOwnable) {
      return { isValid: false, message: "SDK not initialized" }
    }

    try {
      const operationType = getOperationType()
      
      if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
        // Convert to minutes for SDK validation
        const minutes = convertToMinutes(value, timeLockUnit)
        
        // Basic validation - must be positive
        if (minutes <= 0) {
          return { isValid: false, message: "Time lock period must be greater than 0" }
        }
        
        // Use SDK to get current time lock period for comparison
        const currentPeriod = await secureOwnable.getTimeLockPeriodSec()
        const currentPeriodMinutes = Number(currentPeriod) / 60
        
        // Check if it's different from current period (with proper tolerance for different units)
        const tolerance = timeLockUnit === 'seconds' ? 0.01 : 0.1 // Smaller tolerance for seconds
        if (Math.abs(minutes - currentPeriodMinutes) < tolerance) {
          return { isValid: false, message: "New time lock period must be different from current period" }
        }
        
        // Let the SDK handle the actual validation through execution options
        return { isValid: true }
      } else if (operationType === CoreOperationType.RECOVERY_UPDATE) {
        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
          return { isValid: false, message: "Invalid Ethereum address format" }
        }
        
        // Use SDK to get current recovery address for comparison
        const currentRecovery = await secureOwnable.getRecovery()
        if (value.toLowerCase() === currentRecovery.toLowerCase()) {
          return { isValid: false, message: "New recovery address must be different from current address" }
        }
        
        return { isValid: true }
      } else if (operationType === CoreOperationType.BROADCASTER_UPDATE) {
        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
          return { isValid: false, message: "Invalid Ethereum address format" }
        }
        
        // Use SDK to get current broadcaster address for comparison
        const currentBroadcaster = await secureOwnable.getBroadcaster()
        if (value.toLowerCase() === currentBroadcaster.toLowerCase()) {
          return { isValid: false, message: "New broadcaster address must be different from current address" }
        }
        
        return { isValid: true }
      } else if (operationType === CoreOperationType.OWNERSHIP_TRANSFER) {
        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
          return { isValid: false, message: "Invalid Ethereum address format" }
        }
        
        // Use SDK to get current owner address for comparison
        const currentOwner = await secureOwnable.owner()
        if (value.toLowerCase() === currentOwner.toLowerCase()) {
          return { isValid: false, message: "New owner address must be different from current address" }
        }
        
        return { isValid: true }
      }
      
      return { isValid: true }
    } catch (error) {
      console.error("SDK validation error:", error)
      return { isValid: false, message: "Validation failed" }
    }
  }

  // Use SDK validation state
  const validationResult = validationState

  // Handle form submission with SDK error handling
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSigning(true)
      const operationType = getOperationType()
      
      // Check validation state
      if (!validationState.isValid) {
        throw new Error(validationState.message || "Validation failed")
      }
      
      
      // Additional validation for empty inputs
      if (!newValue || newValue.trim() === '') {
        throw new Error("Please enter a value")
      }
      
      // Prepare parameters based on operation type
      let params: any = {}
      
      if (operationType === CoreOperationType.RECOVERY_UPDATE) {
        params = { newRecoveryAddress: newValue as Address }
      } else if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
        // For timelock updates, convert to minutes for SDK (SDK will convert to seconds internally)
        const minutes = convertToMinutes(newValue, timeLockUnit)
        
        // Round to nearest integer to avoid decimal BigInt conversion errors
        const roundedMinutes = Math.round(minutes)
        
        // Validate that the rounded minutes is greater than 0
        if (roundedMinutes <= 0) {
          throw new Error(`Time lock period too small. ${newValue} ${timeLockUnit} converts to ${minutes.toFixed(6)} minutes, which rounds to 0. Please use at least 1 minute or a larger value. For seconds, try at least 60 seconds (1 minute).`)
        }
        
        params = { newTimeLockPeriodInMinutes: BigInt(roundedMinutes) }
      } else if (operationType === CoreOperationType.BROADCASTER_UPDATE) {
        params = { newBroadcaster: newValue as Address }
      } else if (operationType === CoreOperationType.OWNERSHIP_TRANSFER) {
        params = { newOwner: newValue as Address }
      } else {
        // For custom operations
        params = { newValue }
      }
      
      
      // Sign the operation - Guardian SDK will handle storage
      await signSinglePhaseOperation(operationType as CoreOperationType, params)
      
      // Show success toast
      toast({
        title: "Success",
        description: "Operation signed successfully",
      })
      
      // Close the dialog on success
      onOpenChange(false)
      
      // Refresh all data after successful operation
      if (refreshData) {
        refreshData()
      }
    } catch (error: any) {
      console.error("Submit error:", error)
      
      // Use SDK error extraction for better error messages
      let errorMessage = error.message || "Operation failed"
      
      if (error.message && error.message.includes('revert')) {
        try {
          const errorInfo = extractErrorInfo(error.message)
          if (errorInfo.isKnownError && errorInfo.error) {
            errorMessage = errorInfo.userMessage
          }
        } catch (extractError) {
          console.warn("Could not extract error info:", extractError)
        }
      }
      
      // Show error toast to user
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
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