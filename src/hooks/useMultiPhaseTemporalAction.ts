import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useTransactionManager } from '@/hooks/useTransactionManager'
import { useSecureOwnable } from "./useSecureOwnable"
// import { broadcastMetaTransaction } from "@/utils/metaTransaction"
import { TxRecord } from "../particle-core/sdk/typescript/interfaces/lib.index"
import { Address } from "viem"
import { usePublicClient } from "wagmi"

interface UseMultiPhaseTemporalActionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (newValue: string) => Promise<void>
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  pendingTx?: TxRecord & { contractAddress: Address, timeLockPeriodInMinutes: number }
  showNewValueInput?: boolean
  onMetaTxSignSuccess?: () => void
  refreshSignedTransactions?: () => void
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
  handleMetaTxSign: (type: 'approve' | 'cancel', metaTxType: 'broadcaster' | 'ownership' | 'recovery' | 'timelock') => Promise<void>
}

export function useMultiPhaseTemporalAction({
  isOpen,
  // onOpenChange,
  onSubmit,
  onApprove,
  onCancel,
  pendingTx,
  showNewValueInput = true,
  onMetaTxSignSuccess,
  refreshSignedTransactions
}: UseMultiPhaseTemporalActionProps): UseMultiPhaseTemporalActionState & UseMultiPhaseTemporalActionActions {
  const [newValue, setNewValue] = useState("")
  const [isApproving, setIsApproving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const { signBroadcasterUpdateApproval, signTransferOwnershipApproval, signBroadcasterUpdateCancellation, signTransferOwnershipCancellation } = useSecureOwnable()
  const { storeTransaction } = useTransactionManager(pendingTx?.contractAddress || '')
  const { toast } = useToast()
  const publicClient = usePublicClient()

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
      // Check if we're within the first hour of transaction creation
      if (pendingTx && pendingTx.releaseTime) {
        if (!publicClient) {
          throw new Error("Blockchain client not initialized")
        }
        const block = await publicClient.getBlock()
        const now = Number(block.timestamp)
        const timeLockPeriodInSeconds = pendingTx.timeLockPeriodInMinutes * 60
        const startTime = Number(pendingTx.releaseTime) - timeLockPeriodInSeconds
        const elapsedTime = now - startTime
        
        if (elapsedTime < 3600) { // 3600 seconds = 1 hour
          throw new Error("Cannot cancel within first hour of creation")
        }
      }
      
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

  const handleMetaTxSign = async (type: 'approve' | 'cancel', metaTxType: 'broadcaster' | 'ownership' | 'recovery' | 'timelock') => {
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

      // Map the metaTxType to the correct transaction type for metadata
      let transactionType: 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE' | 'RECOVERY_UPDATE' | 'TIMELOCK_UPDATE';
      
      switch (metaTxType) {
        case 'ownership':
          transactionType = 'OWNERSHIP_TRANSFER';
          break;
        case 'broadcaster':
          transactionType = 'BROADCASTER_UPDATE';
          break;
        case 'recovery':
          transactionType = 'RECOVERY_UPDATE';
          break;
        case 'timelock':
          transactionType = 'TIMELOCK_UPDATE';
          break;
        default:
          // Fallback to OWNERSHIP_TRANSFER if unknown type
          transactionType = 'OWNERSHIP_TRANSFER';
      }

      // Prepare the callback to store transaction and trigger refresh
      const storeAndRefresh = (txId: string, signedData: string, metadata: any) => {
        storeTransaction(txId, signedData, { 
          ...metadata, 
          type: transactionType,
          action: type,
          broadcasted: false 
        });
        
        // Refresh signed transactions state if the callback is provided
        if (refreshSignedTransactions) {
          refreshSignedTransactions();
        }
        
        // Call the success callback if provided
        if (onMetaTxSignSuccess) {
          onMetaTxSignSuccess();
        }
      };

      if (metaTxType === 'broadcaster' && type === 'approve') {
        await signBroadcasterUpdateApproval(pendingTx?.contractAddress, txId, 
          (txId, signedData, metadata) => storeAndRefresh(txId, signedData, { 
            ...metadata, 
            type: 'BROADCASTER_UPDATE',
            action: type,
            broadcasted: false 
          })
        );
      } else if (metaTxType === 'broadcaster' && type === 'cancel') {
        await signBroadcasterUpdateCancellation(pendingTx?.contractAddress, txId, 
          (txId, signedData, metadata) => storeAndRefresh(txId, signedData, { 
            ...metadata, 
            type: 'BROADCASTER_UPDATE',
            action: type,
            broadcasted: false 
          })
        );
      } else if ((metaTxType === 'ownership' || metaTxType === 'recovery' || metaTxType === 'timelock') && type === 'approve') {
        await signTransferOwnershipApproval(pendingTx?.contractAddress, txId, 
          (txId, signedData, metadata) => storeAndRefresh(txId, signedData, { 
            ...metadata, 
            type: transactionType,
            action: type,
            broadcasted: false 
          })
        );
      } else if ((metaTxType === 'ownership' || metaTxType === 'recovery' || metaTxType === 'timelock') && type === 'cancel') {
        await signTransferOwnershipCancellation(pendingTx?.contractAddress, txId, 
          (txId, signedData, metadata) => storeAndRefresh(txId, signedData, { 
            ...metadata, 
            type: transactionType,
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
      });
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