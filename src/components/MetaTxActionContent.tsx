import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Radio } from "lucide-react"
import { formatAddress } from "@/lib/utils"
import { useSinglePhaseMetaTxAction } from "@/hooks/useSinglePhaseMetaTxAction"

interface MetaTxActionContentProps {
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
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function MetaTxActionContent({
  contractInfo,
  currentValue,
  currentValueLabel,
  actionLabel,
  isLoading = false,
  onSubmit,
  requiredRole,
  connectedAddress,
  isOpen,
  onOpenChange
}: MetaTxActionContentProps) {
  const {
    validationResult,
    handleSubmit,
    isConnectedWalletValid: checkWalletValidity,
    isSigning
  } = useSinglePhaseMetaTxAction({
    onSubmit,
    isOpen
  })

  const isConnectedWalletValid = checkWalletValidity(connectedAddress, requiredRole, contractInfo)
  const isOwnerWallet = connectedAddress?.toLowerCase() === contractInfo.owner?.toLowerCase()
  const isBroadcasterWallet = connectedAddress?.toLowerCase() === contractInfo.broadcaster?.toLowerCase()

  return (
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
                disabled={!isConnectedWalletValid || !isOwnerWallet || isLoading || isSigning}
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
                disabled={!isConnectedWalletValid || !isBroadcasterWallet || isLoading || isSigning}
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
  )
} 