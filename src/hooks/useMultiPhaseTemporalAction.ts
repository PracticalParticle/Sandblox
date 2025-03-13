import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useTransactionManager } from '@/hooks/useTransactionManager'
import { useSecureContract } from "./useSecureContract"
import { getMetaTransactionSignature, broadcastMetaTransaction } from "@/utils/metaTransaction"
import { TxRecord } from "../particle-core/sdk/typescript/interfaces/lib.index"
import { Address } from "viem"

interface UseMultiPhaseTemporalActionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (newValue: string) => Promise<void>
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  pendingTx?: TxRecord & { contractAddress: Address }
  showNewValueInput?: boolean
}

interface UseMultiPhaseTemporalActionState {
  newValue: string
  isApproving: boolean
  isCancelling: boolean
  isSigning: boolean
  signedMetaTx: {
    type: 'approve' | 'cancel'
    signedData: string
  } | null
}

interface UseMultiPhaseTemporalActionActions {
  setNewValue: (value: string) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  handleApprove: (txId: number) => Promise<void>
  handleCancel: (txId: number) => Promise<void>
  handleMetaTxSign: (type: 'approve' | 'cancel', metaTxType: 'broadcaster' | 'ownership') => Promise<void>
  handleBroadcast: (type: 'approve' | 'cancel') => Promise<void>
}

export function useMultiPhaseTemporalAction({
  isOpen,
  onOpenChange,
  onSubmit,
  onApprove,
  onCancel,
  pendingTx,
  showNewValueInput = true
}: UseMultiPhaseTemporalActionProps): UseMultiPhaseTemporalActionState & UseMultiPhaseTemporalActionActions {
  const [newValue, setNewValue] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const { signBroadcasterUpdate, signTransferOwnership } = useSecureContract()
  const { storeTransaction } = useTransactionManager(pendingTx?.contractAddress || '')

  const [signedMetaTx, setSignedMetaTx] = useState<{
    type: 'approve' | 'cancel'
    signedData: string
  } | null>(null)
  const { toast } = useToast()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue("")
      setIsApproving(false)
      setIsCancelling(false)
      setIsSigning(false)
      setSignedMetaTx(null)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSubmit) return
    if (!showNewValueInput || newValue) {
      try {
        await onSubmit(newValue)
        setNewValue("")
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to submit request",
          variant: "destructive",
        })
      }
    }
  }

  const handleApprove = async (txId: number) => {
    if (!onApprove) return
    setIsApproving(true)
    try {
      await onApprove(txId)
      toast({
        title: "Success",
        description: "Transaction approved successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve transaction",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleCancel = async (txId: number) => {
    if (!onCancel) return
    setIsCancelling(true)
    try {
      await onCancel(txId)
      toast({
        title: "Success",
        description: "Transaction cancelled successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel transaction",
        variant: "destructive",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleMetaTxSign = async (type: 'approve' | 'cancel', metaTxType: 'broadcaster' | 'ownership') => {
    console.log('handleMetaTxSign', type, metaTxType);
    setIsSigning(true)
    try {
      if (!pendingTx?.txId) {
        throw new Error('Transaction ID is required for signing meta transactions');
      }
      const txId = parseInt(pendingTx.txId.toString())
      if (!pendingTx?.contractAddress) {
        throw new Error('Contract address is required for storing meta transactions');
      }

      let signedData: string;
      if (metaTxType === 'broadcaster') {
        signedData = await signBroadcasterUpdate(pendingTx?.contractAddress, txId, storeTransaction);
      } else if (metaTxType === 'ownership') {
        signedData = await signTransferOwnership(pendingTx?.contractAddress, txId, storeTransaction);
      } else {
        throw new Error('Unsupported meta transaction type');
      }
      
      toast({
        title: "Success",
        description: `Transaction ${type} signed successfully`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to sign ${type} transaction`,
        variant: "destructive",
      })
    } finally {
      setIsSigning(false)
    }
  }

  const handleBroadcast = async (type: 'approve' | 'cancel') => {
    if (!signedMetaTx || signedMetaTx.type !== type) return
    
    try {
      await broadcastMetaTransaction(signedMetaTx.signedData)
      
      toast({
        title: "Success",
        description: `Transaction ${type} broadcasted successfully`,
      })
      
      // Close the dialog after successful broadcast
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to broadcast ${type} transaction`,
        variant: "destructive",
      })
    }
  }

  return {
    // State
    newValue,
    isApproving,
    isCancelling,
    isSigning,
    signedMetaTx,
    // Actions
    setNewValue,
    handleSubmit,
    handleApprove,
    handleCancel,
    handleMetaTxSign,
    handleBroadcast
  }
} 