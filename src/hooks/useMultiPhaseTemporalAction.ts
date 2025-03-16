import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useTransactionManager } from '@/hooks/useTransactionManager'
import { useSecureContract } from "./useSecureContract"
// import { broadcastMetaTransaction } from "@/utils/metaTransaction"
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
}

interface UseMultiPhaseTemporalActionActions {
  setNewValue: (value: string) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  handleApprove: (txId: number) => Promise<void>
  handleCancel: (txId: number) => Promise<void>
  handleMetaTxSign: (type: 'approve' | 'cancel', metaTxType: 'broadcaster' | 'ownership') => Promise<void>
}

export function useMultiPhaseTemporalAction({
  isOpen,
  // onOpenChange,
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
  const { signBroadcasterUpdateApproval, signTransferOwnershipApproval, signBroadcasterUpdateCancellation, signTransferOwnershipCancellation } = useSecureContract()
  const { storeTransaction } = useTransactionManager(pendingTx?.contractAddress || '')
  const { toast } = useToast()

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNewValue("")
      setIsApproving(false)
      setIsCancelling(false)
      setIsSigning(false)
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

      if (metaTxType === 'broadcaster' && type === 'approve') {
        await signBroadcasterUpdateApproval(pendingTx?.contractAddress, txId,
          (txId, signedData, metadata) => storeTransaction(txId, signedData, {
            ...metadata,
            type: 'BROADCASTER_UPDATE',
            action: type,
            broadcasted: false
          })
        );
      } else if (metaTxType === 'broadcaster' && type === 'cancel') {
        await signBroadcasterUpdateCancellation(pendingTx?.contractAddress, txId,
          (txId, signedData, metadata) => storeTransaction(txId, signedData, {
            ...metadata,
            type: 'BROADCASTER_UPDATE',
            action: type,
            broadcasted: false
          })
        );
      } else if (metaTxType === 'ownership' && type === 'approve') {
        await signTransferOwnershipApproval(pendingTx?.contractAddress, txId,
          (txId, signedData, metadata) => storeTransaction(txId, signedData, {
            ...metadata,
            type: 'OWNERSHIP_TRANSFER',
            action: type,
            broadcasted: false
          })
        );
      } else if (metaTxType === 'ownership' && type === 'cancel') {
        await signTransferOwnershipCancellation(pendingTx?.contractAddress, txId,
          (txId, signedData, metadata) => storeTransaction(txId, signedData, {
            ...metadata,
            type: 'OWNERSHIP_TRANSFER',
            action: type,
            broadcasted: false
          })
        );
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

  return {
    // State
    newValue,
    isApproving,
    isCancelling,
    isSigning,
    // Actions
    setNewValue,
    handleSubmit,
    handleApprove,
    handleCancel,
    handleMetaTxSign
  }
} 