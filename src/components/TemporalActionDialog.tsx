import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, X, CheckCircle2, Clock, XCircle, Shield, Wallet } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TxRecord } from "@/particle-core/sdk/typescript/interfaces/lib.index"
import { TxStatus } from "@/particle-core/sdk/typescript/types/lib.index"
import { formatAddress } from "@/lib/utils"

interface TemporalActionDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  contractInfo: {
    owner: string
    broadcaster: string
    recoveryAddress: string
    timeLockPeriod: number
    chainId: number
    chainName: string
  }
  actionType: 'ownership' | 'broadcaster'
  currentValue: string
  currentValueLabel: string
  actionLabel: string
  isLoading?: boolean
  onSubmit: (newValue: string) => Promise<void>
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  requiredRole: string
  connectedAddress?: string
  pendingTx?: TxRecord
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
  isLoading = false,
  onSubmit,
  onApprove,
  onCancel,
  requiredRole,
  connectedAddress,
  pendingTx
}: TemporalActionDialogProps) {
  const [newValue, setNewValue] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const { toast } = useToast()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue("")
      setIsApproving(false)
      setIsCancelling(false)
      setIsSigning(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValue) return

    try {
      await onSubmit(newValue)
      setNewValue("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      })
    }
  }

  const handleApprove = async (txId: number) => {
    if (!onApprove) return
    setIsApproving(true)
    try {
      await onApprove(txId)
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve transaction",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleCancel = async (txId: number) => {
    if (!onCancel) return
    setIsCancelling(true)
    try {
      await onCancel(txId)
      toast({
        title: "Success",
        description: "Transaction cancelled successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel transaction",
        variant: "destructive",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const isConnectedWalletValid = connectedAddress && 
    requiredRole && 
    connectedAddress.toLowerCase() === (contractInfo[requiredRole as keyof typeof contractInfo] as string).toLowerCase()

  const renderRequestPhase = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{currentValueLabel}</Label>
          <div className="p-2 bg-muted rounded-lg">
            <code className="text-sm">{currentValue}</code>
          </div>
        </div>

        <div className="space-y-2">
          <Label>New {actionType === 'ownership' ? 'Owner' : 'Broadcaster'} Address</Label>
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter Ethereum address"
            disabled={isLoading}
          />
        </div>

        {!isConnectedWalletValid && (
          <Alert variant="destructive">
            <AlertDescription>
              Please connect the {requiredRole} wallet to proceed
            </AlertDescription>
          </Alert>
        )}

        <Button 
          type="submit" 
          disabled={!newValue || !isConnectedWalletValid || isLoading}
          className="w-full"
        >
          {isLoading ? (
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

  const renderApprovalPhase = () => {
    if (!pendingTx) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Transaction #{pendingTx.txId.toString()}
        </div>

        <Tabs defaultValue="timelock" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="timelock" className="gap-2">
              <Shield className="h-4 w-4" />
              TimeLock
            </TabsTrigger>
            <TabsTrigger value="metatx" className="gap-2">
              <Wallet className="h-4 w-4" />
              MetaTx
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timelock" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Approve using the standard timelock mechanism. This requires gas fees.
                  </div>

                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1">
                            <Button
                              onClick={() => handleApprove(Number(pendingTx.txId))}
                              disabled={isLoading || isApproving || !isConnectedWalletValid}
                              className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 
                                dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 
                                border border-emerald-200 dark:border-emerald-800"
                              variant="outline"
                            >
                              {isApproving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Approve this request using the timelock mechanism
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1">
                            <Button
                              onClick={() => handleCancel(Number(pendingTx.txId))}
                              disabled={isLoading || isCancelling || !isConnectedWalletValid}
                              className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 
                                dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50
                                border border-rose-200 dark:border-rose-800"
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
                        <TooltipContent side="bottom">
                          Cancel this request
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metatx" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Approve using meta-transactions. This requires no gas fees but needs the broadcaster wallet.
                  </div>

                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1">
                            <Button
                              onClick={() => handleApprove(Number(pendingTx.txId))}
                              disabled={isLoading || isSigning || !isConnectedWalletValid}
                              className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 
                                dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 
                                border border-emerald-200 dark:border-emerald-800"
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
                                  Sign & Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Approve this request using meta-transactions (gasless)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1">
                            <Button
                              onClick={() => handleCancel(Number(pendingTx.txId))}
                              disabled={isLoading || isCancelling || !isConnectedWalletValid}
                              className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 
                                dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50
                                border border-rose-200 dark:border-rose-800"
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
                        <TooltipContent side="bottom">
                          Cancel this request
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {pendingTx ? (
              <>Review and approve the pending {actionType} change request.</>
            ) : (
              <>Submit a new {actionType} change request. This will require approval after the timelock period.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pendingTx ? renderApprovalPhase() : renderRequestPhase()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 