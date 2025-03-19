import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface UseSinglePhaseMetaTxActionProps {
  isOpen: boolean
  onSubmit?: (newValue: string) => Promise<void>
  onNewValueChange?: (value: string) => void
  newValue?: string
  validateNewValue?: (value: string) => { isValid: boolean; message?: string }
}

interface UseSinglePhaseMetaTxActionState {
  validationResult: { isValid: boolean; message?: string }
  isSigning: boolean
}

interface UseSinglePhaseMetaTxActionActions {
  handleSubmit: (e: React.FormEvent) => Promise<void>
  getRoleAddress: (role: string, contractInfo: { owner: string; broadcaster: string; [key: string]: any }) => string | string[] | null
  isConnectedWalletValid: (
    connectedAddress: string | undefined,
    requiredRole: string,
    contractInfo: { owner: string; broadcaster: string; [key: string]: any }
  ) => boolean
}

export function useSinglePhaseMetaTxAction({
  isOpen,
  onSubmit,
  onNewValueChange,
  newValue = "",
  validateNewValue,
}: UseSinglePhaseMetaTxActionProps): UseSinglePhaseMetaTxActionState & UseSinglePhaseMetaTxActionActions {
  const { toast } = useToast()
  const [isSigning, setIsSigning] = useState(false)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      onNewValueChange?.("")
      setIsSigning(false)
    }
  }, [isOpen, onNewValueChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSubmit) return

    try {
      setIsSigning(true)
      await onSubmit(newValue)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      })
    } finally {
      setIsSigning(false)
    }
  }

  const getRoleAddress = (role: string, contractInfo: { owner: string; broadcaster: string; [key: string]: any }) => {
    if (!contractInfo) return null;
    switch (role) {
      case 'owner':
        return contractInfo.owner;
      case 'broadcaster':
        return contractInfo.broadcaster;
      default:
        return null;
    }
  }

  const isConnectedWalletValid = (
    connectedAddress: string | undefined,
    requiredRole: string,
    contractInfo: { owner: string; broadcaster: string; [key: string]: any }
  ) => {
    if (!connectedAddress || !requiredRole || !contractInfo) return false;
    
    const roleAddress = getRoleAddress(requiredRole, contractInfo);
    if (!roleAddress) return false;
    
    return connectedAddress.toLowerCase() === roleAddress.toLowerCase();
  }

  const validationResult = validateNewValue ? validateNewValue(newValue) : { isValid: true }

  return {
    // State
    validationResult,
    isSigning,
    // Actions
    handleSubmit,
    getRoleAddress,
    isConnectedWalletValid
  }
} 