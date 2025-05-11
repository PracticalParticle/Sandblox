import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, X, CheckCircle2, Clock, Shield, Wallet } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TxRecord } from "../../particle-core/sdk/typescript/interfaces/lib.index"
import { formatAddress } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { useState, useEffect, FormEvent } from "react"
import { TxInfoCard } from "../TxInfoCard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useWorkflowManager } from "@/hooks/useWorkflowManager"
import { CoreOperationType, OperationPhase } from "../../types/OperationRegistry"
import { Address } from "viem"
import { toast } from "@/components/ui/use-toast"

interface TemporalActionDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  contractInfo: {
    contractAddress: string
    timeLockPeriodInMinutes: number
    chainId: number
    chainName: string
    broadcaster: string
    owner: string
    recoveryAddress: string
    [key: string]: any
  }
  actionType: string
  currentValue: string
  currentValueLabel: string
  actionLabel: string
  isLoading?: boolean
  onSubmit?: (newValue: string) => Promise<void>
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  requiredRole: string
  connectedAddress?: string
  pendingTx?: TxRecord
  showNewValueInput?: boolean
  newValueLabel?: string
  newValuePlaceholder?: string
  showMetaTxOption?: boolean
  metaTxDescription?: string
  operationName?: string
  refreshData?: () => void
  refreshSignedTransactions?: () => void
}

export function TemporalActionDialog({
  isOpen,
  onOpenChange,
  title,
  contractInfo,
  actionType,
  currentValue,
  currentValueLabel,
  actionLabel,
  isLoading: externalIsLoading = false,
  onApprove,
  onCancel,
  requiredRole,
  connectedAddress,
  pendingTx,
  showNewValueInput = true,
  newValueLabel,
  newValuePlaceholder,
  showMetaTxOption,
  metaTxDescription,
  operationName,
  refreshData,
  refreshSignedTransactions
}: TemporalActionDialogProps): JSX.Element {
  // Use the WorkflowManager hook with enhanced role validation
  const {
    isLoading: workflowIsLoading,
    requestOperation,
    approveOperation,
    cancelOperation,
    signApproval,
    signCancellation,
    canExecutePhase,
    isOwner,
    isRecovery
  } = useWorkflowManager(contractInfo.contractAddress as `0x${string}`)

  // Local state
  const [newValue, setNewValue] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue("")
      setIsApproving(false)
      setIsCancelling(false)
      setIsSigning(false)
    }
  }, [isOpen])

  // Map the actionType to a core operation type
  const getOperationType = () => {
    switch (actionType) {
      case 'ownership':
        return CoreOperationType.OWNERSHIP_TRANSFER
      case 'broadcaster':
        return CoreOperationType.BROADCASTER_UPDATE
      case 'recovery':
        return CoreOperationType.RECOVERY_UPDATE
      case 'timelock':
        return CoreOperationType.TIMELOCK_UPDATE
      default:
        return actionType // Custom operation type
    }
  }

  // Handle submit (request phase)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!showNewValueInput || newValue) {
      try {
        const operationType = getOperationType()
        // Prepare parameters based on operation type
        let params: any = {}
        
        if (operationType === CoreOperationType.OWNERSHIP_TRANSFER) {
          // No params needed for ownership transfer
        } else if (operationType === CoreOperationType.BROADCASTER_UPDATE) {
          params = { newBroadcaster: newValue }
        } else if (operationType === CoreOperationType.RECOVERY_UPDATE) {
          params = { newRecoveryAddress: newValue }
        } else if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
          params = { newTimeLockPeriodInMinutes: BigInt(newValue) }
        } else {
          // For custom operations
          params = { newValue }
        }
        
        // Only call requestOperation, let the parent handle the rest
        await requestOperation(operationType, params)
        setNewValue("")
        
        // Close the dialog on success
        onOpenChange(false)
        
        // Refresh data after successful operation
        if (refreshData) {
          await refreshData()
        }
        if (refreshSignedTransactions) {
          await refreshSignedTransactions()
        }
      } catch (error) {
        // Error handling is done in the hook
        console.error("Submit error:", error)
      }
    }
  }

  // Handle approve
  const handleApprove = async (txId: number) => {
    setIsApproving(true)
    try {
      const operationType = getOperationType()
      await approveOperation(operationType, txId)
      
      // Call the parent callback if provided
      if (onApprove) {
        await onApprove(txId)
      }
      
      // Refresh data
      if (refreshData) {
        refreshData()
      }
      if (refreshSignedTransactions) {
        refreshSignedTransactions()
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Approve error:", error)
    } finally {
      setIsApproving(false)
    }
  }

  // Handle cancel
  const handleCancel = async (txId: number) => {
    if (isCancelling) return; // Prevent duplicate calls
    
    setIsCancelling(true);
    try {
      const operationType = getOperationType();
      
      // Call the parent callback first if provided
      if (onCancel) {
        await onCancel(txId);
      } else {
        // Only call cancelOperation if no parent callback
        await cancelOperation(operationType, txId);
      }
      
      // Refresh data
      if (refreshData) {
        refreshData();
      }
      if (refreshSignedTransactions) {
        refreshSignedTransactions();
      }
      
      // Close the dialog on success
      onOpenChange(false);
    } catch (error) {
      console.error("Cancel error:", error);
      // Show error toast
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel operation',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  }

  // Handle meta transaction signing
  const handleMetaTxSign = async (type: 'approve' | 'cancel'): Promise<void> => {
    setIsSigning(true)
    try {
      if (!pendingTx?.txId) {
        throw new Error('Transaction ID is required for signing meta transactions')
      }
      
      const txId = parseInt(pendingTx.txId.toString())
      const operationType = getOperationType()
      
      if (type === 'approve') {
        await signApproval(operationType, txId)
      } else {
        await signCancellation(operationType, txId)
      }
      
      // Refresh data
      if (refreshData) {
        refreshData()
      }
      if (refreshSignedTransactions) {
        refreshSignedTransactions()
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error("Meta TX sign error:", error)
    } finally {
      setIsSigning(false)
    }
  }

  // Check if wallet is valid for request phase using both direct role check and canExecutePhase
  const isWalletValidForRequest = canExecutePhase(getOperationType(), OperationPhase.REQUEST, connectedAddress as Address)

  // Check if wallet is valid for approval phase
  const isWalletValidForApproval = canExecutePhase(getOperationType(), OperationPhase.APPROVE, connectedAddress as Address)

  // Check if wallet is valid for cancellation phase
  const isWalletValidForCancellation = canExecutePhase(getOperationType(), OperationPhase.CANCEL, connectedAddress as Address)
  
  // Check if wallet is valid for meta approval phase
  const isWalletValidForMetaApproval = canExecutePhase(getOperationType(), OperationPhase.META_APPROVE, connectedAddress as Address)

  // Check if wallet is valid for meta cancellation phase
  const isWalletValidForMetaCancellation = canExecutePhase(getOperationType(), OperationPhase.META_CANCEL, connectedAddress as Address)
  
  // Check if the action is an ownership transfer
  const isOwnershipAction = actionType === 'ownership'

  // Determine if we should show the meta transaction tab
  const showMetaTxTab = showMetaTxOption !== undefined ? showMetaTxOption : !(isOwnershipAction && isRecovery)

  // Determine if time lock is complete for a pending transaction
  const getTimeLockProgress = () => {
    if (!pendingTx) return { currentProgress: 0, isTimeLockComplete: false }
    
    const now = Math.floor(Date.now() / 1000)
    const releaseTime = Number(pendingTx.releaseTime)
    const timeLockPeriod = (contractInfo.timeLockPeriodInMinutes || 0) * 60
    const startTime = releaseTime - timeLockPeriod
    const progress = Math.min(((now - startTime) / timeLockPeriod) * 100, 100)
    
    return {
      currentProgress: progress,
      isTimeLockComplete: progress >= 100
    }
  }
  
  // Get role message for wallet validation errors
  const getRequiredRoleMessage = () => {
    if (isOwnershipAction && getTimeLockProgress().isTimeLockComplete) {
      return "Please connect the owner or recovery wallet to proceed"
    } else if (isOwnershipAction) {
      return "Please connect the owner wallet to proceed"
    } else if (requiredRole === 'broadcaster') {
      return "Please connect the broadcaster wallet to proceed"
    } else if (requiredRole === 'recovery') {
      return "Please connect the recovery wallet to proceed"
    } else {
      return `Please connect the ${requiredRole} wallet to proceed`
    }
  }

  // For ownership transfer with completed timelock, either owner or recovery can approve
  const isWalletValidForActionWithTimelock = () => {
    if (isOwnershipAction && getTimeLockProgress().isTimeLockComplete) {
      return isOwner || isRecovery
    }
    return isWalletValidForApproval
  }

  // Combined loading state
  const isLoadingState = externalIsLoading || workflowIsLoading || isApproving || isCancelling || isSigning

  // Render the request phase UI
  const renderRequestPhase = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{currentValueLabel}</Label>
          <div className="p-2 bg-muted rounded-lg">
            <code className="text-sm">{currentValue}</code>
          </div>
        </div>

        {showNewValueInput && (
          <div className="space-y-2">
            <Label>{newValueLabel || `New ${actionType} Address`}</Label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={newValuePlaceholder || "Enter Ethereum address"}
              disabled={isLoadingState}
            />
          </div>
        )}

        {!isWalletValidForRequest && (
          <Alert variant="destructive">
            <AlertDescription>
              {getRequiredRoleMessage()}
            </AlertDescription>
          </Alert>
        )}

        <Button 
          type="submit" 
          disabled={showNewValueInput ? (!newValue || !isWalletValidForRequest || isLoadingState) : (!isWalletValidForRequest || isLoadingState)}
          className="w-full"
        >
          {isLoadingState ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            actionLabel
          )}
        </Button>
      </div>
    </form>
  )

  // Render the approval phase UI
  const renderApprovalPhase = () => {
    if (!pendingTx) return null

    const { currentProgress, isTimeLockComplete } = getTimeLockProgress()

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Transaction #{pendingTx.txId.toString()}
        </div>

        {!isWalletValidForActionWithTimelock() && (
          <Alert variant="destructive">
            <AlertDescription>
              {getRequiredRoleMessage()}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="timelock" className={`w-full ${showMetaTxTab ? 'grid-cols-2' : 'grid-cols-1'} bg-background p-1 rounded-lg`}>
          <TabsList className="grid w-full grid-cols-2 bg-background p-1 rounded-lg">
            <TabsTrigger value="timelock" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
              <Shield className="h-4 w-4 mr-2" />
              TimeLock
            </TabsTrigger>
            {showMetaTxTab && (
              <TabsTrigger value="metatx" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                <Wallet className="h-4 w-4 mr-2" />
                MetaTx
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="timelock" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Approve using the standard timelock mechanism. This requires gas fees.
                  </div>

                  <div className="flex justify-between text-sm">
                    <span>Time Lock Progress</span>
                    <span>{Math.round(currentProgress)}%</span>
                  </div>
                  <Progress 
                    value={currentProgress} 
                    className={`h-2 ${isTimeLockComplete ? 'bg-muted' : ''}`}
                    aria-label="Time lock progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(currentProgress)}
                  />

                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Button
                              onClick={() => handleApprove(Number(pendingTx.txId))}
                              disabled={isLoadingState || !isWalletValidForActionWithTimelock() || (!isTimeLockComplete && isRecovery)}
                              className={cn(
                                "w-full transition-all duration-200 flex items-center justify-center",
                                isTimeLockComplete 
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700",
                                "hover:opacity-90"
                              )}
                              variant="outline"
                            >
                              {isApproving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  {isTimeLockComplete && <CheckCircle2 className="mr-2 h-4 w-4" />}
                                  Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="bottom" 
                          align="center"
                          sideOffset={4}
                          className="max-w-[200px] text-xs bg-popover/95 backdrop-blur-sm"
                        >
                          {!isWalletValidForActionWithTimelock()
                            ? getRequiredRoleMessage()
                            : !isTimeLockComplete
                              ? "Time lock period not complete"
                              : "Approve this request using the timelock mechanism"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Button
                              onClick={() => handleCancel(Number(pendingTx.txId))}
                              disabled={isLoadingState || !isWalletValidForCancellation}
                              className={cn(
                                "w-full transition-all duration-200 flex items-center justify-center",
                                "bg-rose-50 text-rose-700 hover:bg-rose-100",
                                "dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
                                "border border-rose-200 dark:border-rose-800",
                                "hover:opacity-90"
                              )}
                              variant="outline"
                            >
                              {isCancelling ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel
                                </>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="bottom" 
                          align="center"
                          sideOffset={4}
                          className="max-w-[200px] text-xs bg-popover/95 backdrop-blur-sm"
                        >
                          {!isWalletValidForCancellation
                            ? getRequiredRoleMessage()
                            : "Cancel this request"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {showMetaTxTab && (
            <TabsContent value="metatx" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {metaTxDescription || "Sign a meta transaction that will be broadcasted by the broadcaster wallet. This doesn't require gas fees."}
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>Broadcaster Required</span>
                      <span className="text-muted-foreground">{formatAddress(contractInfo.broadcaster)}</span>
                    </div>

                    <div className="flex space-x-2">
                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div className="flex-1">
                              <Button
                                onClick={() => handleMetaTxSign('approve')}
                                disabled={isLoadingState || !isWalletValidForMetaApproval}
                                className={cn(
                                  "w-full transition-all duration-200 flex items-center justify-center",
                                  "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                                  "dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
                                  "border border-emerald-200 dark:border-emerald-800"
                                )}
                                variant="outline"
                              >
                                {isSigning ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Sign Approval
                                  </>
                                )}
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="bottom" 
                            align="center"
                            className="max-w-[200px]"
                          >
                            Approve this request using meta-transactions (delegated)
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div className="flex-1">
                              <Button
                                onClick={() => handleMetaTxSign('cancel')}
                                disabled={isLoadingState || !isWalletValidForMetaCancellation}
                                className={cn(
                                  "w-full transition-all duration-200 flex items-center justify-center",
                                  "bg-rose-50 text-rose-700 hover:bg-rose-100",
                                  "dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
                                  "border border-rose-200 dark:border-rose-800"
                                )}
                                variant="outline"
                              >
                                {isSigning ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing...
                                  </>
                                ) : (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Sign Cancel
                                  </>
                                )}
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="bottom" 
                            align="center"
                            className="max-w-[200px]"
                          >
                            Cancel this request
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  <span>Time Lock</span>
                </Badge>
              </div>
            </div>
            <DialogDescription>
              {pendingTx ? (
                <>Review and approve the pending {actionType} change request.</>
              ) : (
                <>Submit a new {actionType} change request. This will require approval after the timelock period.</>
              )}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display TxInfoCard when a pending transaction exists */}
          {pendingTx && (
            <TxInfoCard 
              record={pendingTx}
              operationName={operationName || actionType}
              showExecutionType={true}
              showStatus={true}
            />
          )}
          
          {pendingTx ? renderApprovalPhase() : renderRequestPhase()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 