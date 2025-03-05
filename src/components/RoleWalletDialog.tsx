import type { ReactNode } from 'react'
import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SecureContractInfo } from '@/lib/types'
import { Loader2 } from 'lucide-react'

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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      await onSubmit()
    } catch (error) {
      console.error('Transaction error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isSubmitting) {
        onOpenChange(open)
      }
    }}>
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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 