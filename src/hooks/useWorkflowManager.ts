import { useState, useEffect, useCallback } from "react"
import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address, Hash } from 'viem'
import { WorkflowManager } from '../lib/WorkflowManager'
import { generateNewWorkflowManager } from '@/lib/utils'
import { useMetaTransactionManager } from './useMetaTransactionManager'
import { useToast } from "@/components/ui/use-toast"
import { OperationType, CoreOperationType, OperationPhase } from '../types/OperationRegistry'
import { useRoleValidation } from './useRoleValidation'
import { getContractDetails } from '@/lib/catalog'

export function useWorkflowManager(contractAddress?: Address, bloxId?: string) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const config = useConfig()
  const { toast } = useToast()
  const { storeTransaction, removeTransaction, refreshTransactions } = useMetaTransactionManager(contractAddress || '')
  const [manager, setManager] = useState<WorkflowManager | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set())
  const [contractType, setContractType] = useState<string | undefined>(undefined)

  // Add role validation
  const { 
    isOwner, 
    isBroadcaster, 
    isRecovery,
    ownerAddress,
    broadcasterAddress,
    recoveryAddress,
    isLoading: roleValidationLoading 
  } = useRoleValidation(
    contractAddress as Address, 
    walletClient?.account?.address as Address, 
    config.chains.find(c => c.id === chainId)
  )

  // Load contract type from catalog if bloxId is provided
  useEffect(() => {
    const loadContractType = async () => {
      if (bloxId) {
        try {
          const contractDetails = await getContractDetails(bloxId);
          if (contractDetails) {
            // Extract contract type from the component path
            // e.g., "/src/blox/SimpleRWA20/SimpleRWA20.tsx" -> "SimpleRWA20"
            const folderPath = contractDetails.files.component.split('/');
            const contractType = folderPath[folderPath.length - 2];
            setContractType(contractType);
          }
        } catch (error) {
          console.error("Failed to load contract details:", error);
        }
      }
    };

    loadContractType();
  }, [bloxId]);

  // Initialize manager when dependencies change
  useEffect(() => {
    const initManager = async () => {
      if (!publicClient || !contractAddress) return

      try {
        const chain = config.chains.find(c => c.id === chainId)
        if (!chain) throw new Error("Chain not found")

        const workflowManager = await generateNewWorkflowManager(
          publicClient, 
          walletClient || undefined, 
          contractAddress,
          chain,
          storeTransaction,
          contractType
        )
        
        setManager(workflowManager)
      } catch (error) {
        console.error("Failed to initialize WorkflowManager:", error)
      }
    }

    initManager()
  }, [publicClient, walletClient, contractAddress, chainId, config.chains, storeTransaction, contractType])

  // Helper function to determine required role based on operation and phase
  const getRequiredRoleForOperation = useCallback((operationType: OperationType, phase: OperationPhase): string => {
    if (operationType === CoreOperationType.OWNERSHIP_TRANSFER) {
      if (phase === OperationPhase.REQUEST) return 'recovery'
      return 'owner'
    } else if (operationType === CoreOperationType.BROADCASTER_UPDATE) {
      if (phase === OperationPhase.META_APPROVE || phase === OperationPhase.META_CANCEL) {
        return 'owner'
      }
      return 'owner'
    } else if (operationType === CoreOperationType.RECOVERY_UPDATE) {
      return 'owner'
    } else if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
      return 'owner'
    }
    
    // Default to owner for unknown operations
    return 'owner'
  }, [])

  // Helper function to safely stringify params
  const safeStringify = (params: any): string => {
    if (params === null || params === undefined) return ''
    if (typeof params === 'bigint') return params.toString()
    if (typeof params === 'object') {
      const safeParams = Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'bigint' ? value.toString() : value
        return acc
      }, {} as Record<string, any>)
      return JSON.stringify(safeParams)
    }
    return JSON.stringify(params)
  }

  // Request an operation (first phase for multi-phase operations)
  const requestOperation = useCallback(async (
    operationType: OperationType,
    params: any
  ): Promise<Hash | undefined> => {
    if (!manager || !walletClient?.account) return
    
    // Create a unique operation key
    const operationKey = `${operationType}-${safeStringify(params)}`
    
    // Check if this operation is already pending
    if (pendingOperations.has(operationKey)) {
      console.log('Operation already pending:', operationKey)
      return
    }
    
    setIsLoading(true)
    try {
      // Add operation to pending set
      setPendingOperations(prev => new Set([...prev, operationKey]))
      
      const result = await manager.requestOperation(
        operationType,
        params,
        { from: walletClient.account.address }
      )
      
      // Refresh transactions after successful operation
      refreshTransactions()
      
      toast({
        title: "Success",
        description: "Operation requested successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request operation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      // Remove operation from pending set
      setPendingOperations(prev => {
        const next = new Set(prev)
        next.delete(operationKey)
        return next
      })
    }
  }, [manager, walletClient, toast, pendingOperations, refreshTransactions])

  // Approve a pending operation
  const approveOperation = useCallback(async (
    operationType: OperationType,
    txId: bigint | number
  ): Promise<Hash | undefined> => {
    if (!manager || !walletClient?.account) return
    
    setIsLoading(true)
    try {
      const result = await manager.approveOperation(
        operationType,
        BigInt(txId),
        { from: walletClient.account.address }
      )
      
      // Clean up the transaction from storage
      removeTransaction(txId.toString())
      
      toast({
        title: "Success",
        description: "Operation approved successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve operation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager, walletClient, toast, removeTransaction])

  // Cancel a pending operation
  const cancelOperation = useCallback(async (
    operationType: OperationType,
    txId: bigint | number
  ): Promise<Hash | undefined> => {
    if (!manager || !walletClient?.account) return
    
    setIsLoading(true)
    try {
      const result = await manager.cancelOperation(
        operationType,
        BigInt(txId),
        { from: walletClient.account.address }
      )
      
      // Clean up the transaction from storage
      removeTransaction(txId.toString())
      
      toast({
        title: "Success",
        description: "Operation cancelled successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel operation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager, walletClient, toast, removeTransaction])

  // Sign approval for a meta-transaction
  const signApproval = useCallback(async (
    operationType: OperationType,
    txId: bigint | number
  ): Promise<string | undefined> => {
    if (!manager || !walletClient?.account) return
    
    setIsLoading(true)
    try {
      const result = await manager.prepareAndSignApproval(
        operationType,
        BigInt(txId),
        { from: walletClient.account.address }
      )
      
      toast({
        title: "Success",
        description: "Approval signed successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign approval",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager, walletClient, toast])

  // Sign cancellation for a meta-transaction
  const signCancellation = useCallback(async (
    operationType: OperationType,
    txId: bigint | number
  ): Promise<string | undefined> => {
    if (!manager || !walletClient?.account) return
    
    setIsLoading(true)
    try {
      const result = await manager.prepareAndSignCancellation(
        operationType,
        BigInt(txId),
        { from: walletClient.account.address }
      )
      
      toast({
        title: "Success",
        description: "Cancellation signed successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign cancellation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager, walletClient, toast])

  // Sign single-phase operation
  const signSinglePhaseOperation = useCallback(async (
    operationType: OperationType,
    params: any
  ): Promise<string | undefined> => {
    if (!manager || !walletClient?.account) return
    
    // Create a unique operation key
    const operationKey = `${operationType}-${safeStringify(params)}`
    
    // Check if this operation is already pending
    if (pendingOperations.has(operationKey)) {
      console.log('Operation already pending:', operationKey)
      return
    }
    
    setIsLoading(true)
    try {
      // Add operation to pending set
      setPendingOperations(prev => new Set([...prev, operationKey]))
      
      const result = await manager.prepareAndSignSinglePhaseOperation(
        operationType,
        params,
        { from: walletClient.account.address }
      )
      
      // Store the transaction
      if (result) {
        const txId = Date.now().toString()
        storeTransaction(txId, result, {
          type: operationType,
          purpose: params.purpose,
          action: 'requestAndApprove',
          broadcasted: false,
          timestamp: Date.now(),
          status: 'PENDING'
        })
      }
      
      toast({
        title: "Success",
        description: "Operation signed successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign operation",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      // Remove operation from pending set
      setPendingOperations(prev => {
        const next = new Set(prev)
        next.delete(operationKey)
        return next
      })
    }
  }, [manager, walletClient, toast, pendingOperations, storeTransaction])

  // Execute meta-transaction
  const executeMetaTransaction = useCallback(async (
    signedMetaTxJson: string,
    operationType: OperationType,
    action: 'approve' | 'cancel' | 'requestAndApprove'
  ): Promise<Hash | undefined> => {
    if (!manager || !walletClient?.account) return
    
    setIsLoading(true)
    try {
      const result = await manager.executeMetaTransaction(
        signedMetaTxJson,
        operationType,
        action,
        { from: walletClient.account.address }
      )
      
      // Clean up the transaction from storage after successful execution
      if (result) {
        const txId = Date.now().toString()
        removeTransaction(txId)
      }
      
      toast({
        title: "Success",
        description: "Meta-transaction executed successfully",
      })
      
      return result
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute meta-transaction",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [manager, walletClient, toast, removeTransaction])

  // Add a function to refresh all data
  const refreshAllData = useCallback(async () => {
    if (!manager) return;
    
    try {
      // Refresh contract info
      await manager.initialize();
      
      // Refresh transactions
      refreshTransactions();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [manager, refreshTransactions]);

  // Enhanced canExecutePhase that falls back to direct role checks if manager isn't initialized
  const canExecutePhase = useCallback((
    operationType: OperationType,
    phase: OperationPhase,
    connectedAddress?: Address
  ): boolean => {
    // If manager is initialized, use its check
    if (manager) {
      return manager.canExecutePhase(operationType, phase, connectedAddress)
    }
    
    // Fallback to direct role checks when manager is not initialized
    if (!connectedAddress) return false
    
    // Get the connected wallet address from either the provided address or the wallet client
    const walletAddress = connectedAddress || walletClient?.account?.address
    if (!walletAddress) return false
    
    // Map phase and operation type to required role
    const requiredRole = getRequiredRoleForOperation(operationType, phase)
    
    // Use direct role validation
    if (requiredRole === 'owner') {
      return isOwner
    } else if (requiredRole === 'broadcaster') {
      return isBroadcaster
    } else if (requiredRole === 'recovery') {
      return isRecovery
    } else if (requiredRole === 'owner_or_recovery') {
      return isOwner || isRecovery
    }
    
    // Default case
    return false
  }, [manager, getRequiredRoleForOperation, isOwner, isBroadcaster, isRecovery, walletClient?.account?.address])

  // Update loading state to include role validation
  const combinedIsLoading = isLoading || roleValidationLoading
  
  return {
    manager,
    isLoading: combinedIsLoading,
    isOwner,
    isBroadcaster,
    isRecovery,
    ownerAddress,
    broadcasterAddress,
    recoveryAddress,
    requestOperation,
    approveOperation,
    cancelOperation,
    signApproval,
    signCancellation,
    signSinglePhaseOperation,
    executeMetaTransaction,
    canExecutePhase,
    getRequiredRoleForOperation,
    refreshAllData
  }
} 