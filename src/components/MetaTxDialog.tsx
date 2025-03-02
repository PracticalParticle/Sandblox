import { useState, useEffect, ReactNode } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2, X, Wallet } from 'lucide-react'
import { SingleWalletManagerProvider, useSingleWallet } from '@/components/SingleWalletManager'
import { formatAddress } from '@/lib/utils'
import { SecureContractInfo } from '@/lib/types'
import { useToast } from '@/components/ui/use-toast'

// Base component for wallet connection content
interface WalletConnectionContentProps {
  contractInfo: SecureContractInfo | null
  walletType: 'owner' | 'broadcaster' | 'recovery'
  onSuccess: () => void
  onClose: () => void
  actionLabel?: string
  newValue?: string
  children?: ReactNode
}

export function WalletConnectionContent({
  contractInfo,
  walletType,
  onSuccess,
  onClose,
  actionLabel = "Confirm Update",
  newValue = "",
  children
}: WalletConnectionContentProps) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet()
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const { toast } = useToast()

  // Get the appropriate address based on wallet type
  const getRequiredAddress = (): string => {
    if (!contractInfo) return ''
    
    switch (walletType) {
      case 'owner':
        return contractInfo.owner
      case 'broadcaster':
        return contractInfo.broadcaster
      case 'recovery':
        return contractInfo.recoveryAddress
      default:
        return ''
    }
  }

  // Get the appropriate wallet type label
  const getWalletTypeLabel = (): string => {
    switch (walletType) {
      case 'owner':
        return 'Owner'
      case 'broadcaster':
        return 'Broadcaster'
      case 'recovery':
        return 'Recovery'
      default:
        return 'Required'
    }
  }

  useEffect(() => {
    if (session && contractInfo && session.account) {
      const requiredAddress = getRequiredAddress()
      setIsWalletConnected(
        session.account.toLowerCase() === requiredAddress.toLowerCase()
      )
    } else {
      setIsWalletConnected(false)
    }
  }, [session, contractInfo, walletType])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {session && session.account ? formatAddress(session.account) : 'No account'}
                  </span>
                </div>
                <Button
                  onClick={() => void disconnect()}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!isWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected wallet does not match the {getWalletTypeLabel().toLowerCase()} address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isWalletConnected && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-500">
                      {getWalletTypeLabel()} wallet connected successfully!
                    </AlertDescription>
                  </Alert>
                  {newValue && (
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-sm font-medium">New Value:</p>
                      <code className="text-xs">{newValue}</code>
                    </div>
                  )}
                  {children}
                  <Button 
                    onClick={onSuccess}
                    className="w-full"
                    variant="default"
                  >
                    {actionLabel}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : `Connect ${getWalletTypeLabel()} Wallet`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Main MetaTxDialog component
interface MetaTxDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contractInfo: SecureContractInfo | null
  walletType: 'owner' | 'broadcaster' | 'recovery'
  currentValue?: string | number
  currentValueLabel?: string
  actionLabel?: string
  newValue?: string
  onSubmit: () => Promise<void>
  children?: ReactNode
}

export function MetaTxDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  walletType,
  currentValue,
  currentValueLabel = "Current Value",
  actionLabel = "Confirm Update",
  newValue = "",
  onSubmit,
  children
}: MetaTxDialogProps) {
  const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID
  
  if (!projectId) {
    throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable')
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle>{title}</DialogTitle>
          {currentValue && (
            <div className="p-2 bg-muted rounded-lg text-sm">
              <p className="font-medium">{currentValueLabel}:</p>
              <code className="text-xs">{currentValue}</code>
            </div>
          )}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        <div className="space-y-4">
          {children}
          
          <SingleWalletManagerProvider
            projectId={projectId}
            autoConnect={false}
            metadata={{
              name: 'SandBlox Security',
              description: 'SandBlox Security Wallet Connection',
              url: window.location.origin,
              icons: ['https://avatars.githubusercontent.com/u/37784886']
            }}
          >
            <WalletConnectionContent
              contractInfo={contractInfo}
              walletType={walletType}
              onSuccess={onSubmit}
              onClose={() => onOpenChange(false)}
              actionLabel={actionLabel}
              newValue={newValue}
            />
          </SingleWalletManagerProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
} 