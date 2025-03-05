import type { ReactNode } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SecureContractInfo } from '@/lib/types'

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
  currentValue,
  currentValueLabel = "Current Value",
  actionLabel = "Submit Transaction",
  children,
  onSubmit
}: RoleWalletDialogProps) {
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
          
          <Button 
            onClick={onSubmit} 
            className="w-full"
          >
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 