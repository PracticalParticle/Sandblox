import { useState } from 'react'
import { Button } from './ui/button'
import { Download, ArrowRight, Loader2 } from 'lucide-react'
import { ImportContractDialog } from './ImportContractDialog'
import { useToast } from './ui/use-toast'
import { useSecureContract } from '@/hooks/useSecureContract'
import { Address } from 'viem'

interface ImportContractProps {
  onImportSuccess?: (contractInfo: any) => void
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
      const contractInfo = await validateAndLoadContract(address as Address)
      
      toast({
        title: "Contract validated",
        description: "The contract has been validated successfully.",
        variant: "default"
      })

      onImportSuccess?.(contractInfo)
    } catch (error) {
      console.error('Error validating contract:', error)
      toast({
        title: "Validation failed",
        description: error instanceof Error ? error.message : 'Failed to validate contract',
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