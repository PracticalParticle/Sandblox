import { useState } from 'react'
import { Button } from './ui/button'
import { Download, ArrowRight, Loader2 } from 'lucide-react'
import { ImportContractDialog } from './ImportContractDialog'
import { useToast } from './ui/use-toast'
import { useSecureContract } from '@/hooks/useSecureContract'
import { Address } from 'viem'
import type { SecureContractInfo } from '@/lib/types'

interface ImportContractProps {
  onImportSuccess?: (contractInfo: SecureContractInfo) => void
  buttonVariant?: 'default' | 'outline' | 'ghost'
  buttonText?: string
  buttonIcon?: 'download' | 'arrow'
  className?: string
}

export function ImportContract({ 
  onImportSuccess, 
  buttonVariant = 'outline',
  buttonText = 'Import Contract',
  buttonIcon = 'download',
  className = ''
}: ImportContractProps) {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [loadingContracts, setLoadingContracts] = useState(false)
  const { toast } = useToast()
  const { validateAndLoadContract } = useSecureContract()

  const handleImportContract = async (address: string): Promise<void> => {
    setShowImportDialog(false)
    setLoadingContracts(true)
    
    try {
      // Validate and load the SecureOwnable contract
      const contractInfo = await validateAndLoadContract(address as Address)
      
      // Show success toast with contract details
      toast({
        title: "Contract validated successfully",
        description: `Imported SecureOwnable contract at ${address.slice(0, 6)}...${address.slice(-4)}`,
        variant: "default"
      })

      // Pass the validated contract info to the parent component
      onImportSuccess?.(contractInfo)
    } catch (error) {
      console.error('Error validating contract:', error)
      
      // Show detailed error message to help users understand validation failures
      toast({
        title: "Contract validation failed",
        description: error instanceof Error ? error.message : 'Failed to validate SecureOwnable contract',
        variant: "destructive"
      })
    } finally {
      setLoadingContracts(false)
    }
  }

  const IconComponent = buttonIcon === 'download' ? Download : ArrowRight
  const iconPosition = buttonIcon === 'download' ? 'left' : 'right'

  return (
    <>
      <Button
        variant={buttonVariant}
        onClick={() => setShowImportDialog(true)}
        disabled={loadingContracts}
        aria-label={buttonText}
        className={className}
      >
        {loadingContracts ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
        ) : iconPosition === 'left' ? (
          <IconComponent className="h-4 w-4 mr-2" aria-hidden="true" />
        ) : null}
        {buttonText}
        {!loadingContracts && iconPosition === 'right' && (
          <IconComponent className="h-4 w-4 ml-2" aria-hidden="true" />
        )}
      </Button>

      <ImportContractDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportContract}
      />
    </>
  )
} 