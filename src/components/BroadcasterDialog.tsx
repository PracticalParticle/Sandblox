import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Radio, Network } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { formatAddress } from "@/lib/utils"

interface BroadcasterDialogProps {
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
  requiredRole: string
  connectedAddress?: string
  onBroadcast?: () => Promise<void>
  isLoading?: boolean
}

export function BroadcasterDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  actionType,
  requiredRole,
  connectedAddress,
  onBroadcast,
  isLoading = false
}: BroadcasterDialogProps) {
  const { toast } = useToast()
  const [isBroadcasting, setIsBroadcasting] = useState(false)

  const handleBroadcast = async () => {
    if (!onBroadcast) return

    try {
      setIsBroadcasting(true)
      await onBroadcast()
      toast({
        title: "Success",
        description: "Transaction broadcasted successfully",
      })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to broadcast transaction",
        variant: "destructive",
      })
    } finally {
      setIsBroadcasting(false)
    }
  }

  const getRoleAddress = (role: string) => {
    if (!contractInfo) return null;
    switch (role) {
      case 'broadcaster':
        return contractInfo.broadcaster;
      default:
        return null;
    }
  };

  const isConnectedWalletValid = connectedAddress && 
    requiredRole && 
    contractInfo && 
    getRoleAddress(requiredRole) &&
    connectedAddress.toLowerCase() === getRoleAddress(requiredRole)?.toLowerCase();

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
            {description || `Broadcast the ${actionType} update transaction.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {!isConnectedWalletValid && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Please connect the broadcaster wallet to proceed
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleBroadcast}
                  disabled={!isConnectedWalletValid || isLoading || isBroadcasting}
                  className="w-full"
                >
                  {isBroadcasting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    <>
                      <Radio className="mr-2 h-4 w-4" />
                      Broadcast Transaction
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
} 