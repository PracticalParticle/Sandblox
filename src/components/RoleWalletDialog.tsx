import { useState, useEffect, ReactNode } from 'react'
import { Address } from 'viem'
import { useAccount, useDisconnect } from 'wagmi'
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

function WalletConnectionContent({
  contractInfo,
  walletType,
  onSuccess,
  onClose,
  actionLabel = "Confirm Action",
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
    <div className="space-y-4">
      {children}

      {isConnecting ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : session ? (
        isWalletConnected ? (
          <div className="space-y-4">
            <Alert variant="default" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Connected as {getWalletTypeLabel()} ({formatAddress(session.account)})
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  disconnect()
                  onClose()
                }}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
              <Button onClick={onSuccess} className="flex-1">
                <Wallet className="h-4 w-4 mr-2" />
                {actionLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connected wallet ({formatAddress(session.account)}) does not match required {getWalletTypeLabel()} address ({formatAddress(getRequiredAddress())})
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={() => disconnect()}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        )
      ) : (
        <Button onClick={() => connect()} className="w-full">
          <Wallet className="h-4 w-4 mr-2" />
          Connect {getWalletTypeLabel()} Wallet
        </Button>
      )}
    </div>
  )
}

// Main RoleWalletDialog component
interface RoleWalletDialogProps {
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

export function RoleWalletDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  walletType,
  currentValue,
  currentValueLabel = "Current Value",
  actionLabel = "Confirm Action",
  newValue = "",
  onSubmit,
  children
}: RoleWalletDialogProps) {
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