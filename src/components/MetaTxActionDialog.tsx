import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Radio, Network } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { formatAddress } from "@/lib/utils"
import { useSinglePhaseMetaTxAction } from "@/hooks/useSinglePhaseMetaTxAction"

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
    [key: string]: any
  }
  actionType: string
  currentValue: string
  currentValueLabel: string
  actionLabel: string
  isLoading?: boolean
  onSubmit?: (newValue: string) => Promise<void>
  requiredRole: string
  connectedAddress?: string
  newValue: string
  onNewValueChange: (value: string) => void
  newValueLabel: string
  newValuePlaceholder?: string
  validateNewValue?: (value: string) => { isValid: boolean; message?: string }
  isSigning?: boolean
  customInput?: React.ReactNode
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
  isLoading = false,
  onSubmit,
  requiredRole,
  connectedAddress,
  newValue,
  onNewValueChange,
  newValueLabel,
  newValuePlaceholder,
  validateNewValue,
  isSigning = false,
  customInput
}: MetaTxActionDialogProps) {
  const {
    validationResult,
    handleSubmit,
    isConnectedWalletValid: checkWalletValidity
  } = useSinglePhaseMetaTxAction({
    isOpen,
    onSubmit,
    onNewValueChange,
    newValue,
    validateNewValue,
  })

  const isConnectedWalletValid = checkWalletValidity(connectedAddress, requiredRole, contractInfo)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Network className="h-3 w-3" />
                    <span>Meta Tx</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Single-phase meta tx security</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DialogDescription>
            {description || `Update the ${actionType}. This will be executed via meta-transaction.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                        disabled={isLoading || isSigning}
                        className={!validationResult.isValid && newValue ? "border-destructive" : ""}
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

                  {!isConnectedWalletValid && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Please connect the {requiredRole} wallet to proceed
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="submit"
                      disabled={!newValue || !validationResult.isValid || !isConnectedWalletValid || isLoading || isSigning}
                      className="w-full"
                    >
                      {isSigning ? (
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
                    <Button 
                      type="button"
                      variant="outline"
                      disabled={!isConnectedWalletValid || isLoading}
                      className="w-full"
                    >
                      <Radio className="mr-2 h-4 w-4" />
                      Broadcast
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