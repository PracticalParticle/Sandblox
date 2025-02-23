import { useState, useCallback } from 'react'
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

  const handleImportContract = useCallback(async (address: string): Promise<void> => {
    setShowImportDialog(false)
    setLoadingContracts(true)
    
    try {
      // Validate and load the SecureOwnable contract
      const contractInfo = await validateAndLoadContract(address as Address)
      
      // Pass the validated contract info to the parent component first
      onImportSuccess?.(contractInfo)

      // Show success toast after state updates are complete
      setTimeout(() => {
        toast({
          title: "Contract validated successfully",
          description: `Imported SecureOwnable contract at ${address.slice(0, 6)}...${address.slice(-4)}${
            contractInfo.chainName ? ` on ${contractInfo.chainName}` : ''
          }`,
          variant: "default"
        })
      }, 0)
    } catch (error) {
      console.error('Error validating contract:', error)
      
      // Show error toast after a tick
      setTimeout(() => {
        toast({
          title: "Contract validation failed",
          description: error instanceof Error ? error.message : 'Failed to validate SecureOwnable contract',
          variant: "destructive"
        })
      }, 0)
    } finally {
      setLoadingContracts(false)
    }
  }, [toast, validateAndLoadContract, onImportSuccess])

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