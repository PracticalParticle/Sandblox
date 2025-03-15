import { useAccount } from 'wagmi'
import { useState, useCallback, useMemo } from 'react'
import { SecureContractInfo, TxRecord } from '@/lib/types'

// Define the possible roles
export type SecurityRole = 'owner' | 'recovery' | 'broadcaster' | 'observer'

// Define the transaction types
export type TransactionType = 'temporal' | 'meta'

// Define the action types
export type ActionType = 
  | 'transfer_ownership' 
  | 'update_broadcaster'
  | 'update_recovery'
  | 'update_timelock'

// Define the action phases
export type ActionPhase = 'request' | 'approve' | 'broadcast'

// Define the workflow state
export interface WorkflowState {
  role: SecurityRole
  canRequest: boolean
  canApprove: boolean
  canBroadcast: boolean
  pendingActions: {
    [key in ActionType]?: {
      txRecord?: TxRecord
      phase: ActionPhase
      type: TransactionType
    }
  }
}

// Define the permissions matrix
const ACTION_PERMISSIONS: {
  [key in ActionType]: {
    type: TransactionType
    roles: {
      [key in ActionPhase]: SecurityRole[]
    }
  }
} = {
  transfer_ownership: {
    type: 'temporal',
    roles: {
      request: ['recovery'],
      approve: ['owner', 'recovery'],
      broadcast: ['broadcaster']
    }
  },
  update_broadcaster: {
    type: 'temporal',
    roles: {
      request: ['owner'],
      approve: ['owner'],
      broadcast: ['broadcaster']
    }
  },
  update_recovery: {
    type: 'meta',
    roles: {
      request: ['owner'],
      approve: [], // Meta transactions don't have approval phase
      broadcast: ['broadcaster']
    }
  },
  update_timelock: {
    type: 'meta',
    roles: {
      request: ['owner'],
      approve: [], // Meta transactions don't have approval phase
      broadcast: ['broadcaster']
    }
  }
}

export interface UseSecurityWorkflowProps {
  contractInfo: SecureContractInfo
  pendingTransactions?: TxRecord[]
}

export function useSecurityWorkflow({ 
  contractInfo, 
  pendingTransactions = [] 
}: UseSecurityWorkflowProps) {
  const { address: connectedAddress } = useAccount()
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)

  // Determine the connected wallet's role
  const currentRole = useMemo((): SecurityRole => {
    if (!connectedAddress || !contractInfo) return 'observer'
    
    const addressLower = connectedAddress.toLowerCase()
    if (addressLower === contractInfo.owner.toLowerCase()) return 'owner'
    if (addressLower === contractInfo.recoveryAddress.toLowerCase()) return 'recovery'
    if (addressLower === contractInfo.broadcaster.toLowerCase()) return 'broadcaster'
    return 'observer'
  }, [connectedAddress, contractInfo])

  // Get the current workflow state
  const workflowState = useMemo((): WorkflowState => {
    const state: WorkflowState = {
      role: currentRole,
      canRequest: false,
      canApprove: false,
      canBroadcast: currentRole === 'broadcaster',
      pendingActions: {}
    }

    // Process each action type
    Object.entries(ACTION_PERMISSIONS).forEach(([action, permissions]) => {
      const actionType = action as ActionType
      
      // Check if user can request this action
      state.canRequest = state.canRequest || permissions.roles.request.includes(currentRole)
      
      // Check if user can approve this action (for temporal transactions)
      if (permissions.type === 'temporal') {
        state.canApprove = state.canApprove || permissions.roles.approve.includes(currentRole)
      }

      // Find any pending transactions for this action
      const pendingTx = pendingTransactions.find(tx => {
        // Match transaction operation type to our action type
        const txType = tx.params.operationType?.toLowerCase()
        switch(actionType) {
          case 'transfer_ownership':
            return txType === 'ownership'
          case 'update_broadcaster':
            return txType === 'broadcaster'
          case 'update_recovery':
            return txType === 'recovery'
          case 'update_timelock':
            return txType === 'timelock'
          default:
            return false
        }
      })

      if (pendingTx) {
        state.pendingActions[actionType] = {
          txRecord: pendingTx,
          phase: 'approve', // You'll need logic to determine the actual phase
          type: permissions.type
        }
      }
    })

    return state
  }, [currentRole, contractInfo, pendingTransactions])

  // Check if an action is allowed for the current role and phase
  const isActionAllowed = useCallback((
    action: ActionType,
    phase: ActionPhase
  ): boolean => {
    const permissions = ACTION_PERMISSIONS[action]
    if (!permissions) return false

    // For meta transactions, only request and broadcast phases are valid
    if (permissions.type === 'meta' && phase === 'approve') return false

    return permissions.roles[phase].includes(currentRole)
  }, [currentRole])

  // Get the next allowed phase for an action
  const getNextPhase = useCallback((
    action: ActionType,
    currentPhase: ActionPhase
  ): ActionPhase | null => {
    const phases: ActionPhase[] = ['request', 'approve', 'broadcast']
    const currentIndex = phases.indexOf(currentPhase)
    
    if (currentIndex === -1) return null
    
    // For meta transactions, skip approval phase
    if (ACTION_PERMISSIONS[action].type === 'meta') {
      return currentPhase === 'request' ? 'broadcast' : null
    }

    // For temporal transactions, follow the normal flow
    return phases[currentIndex + 1] || null
  }, [])

  // Start a new action workflow
  const startAction = useCallback((action: ActionType) => {
    if (isActionAllowed(action, 'request')) {
      setActiveAction(action)
      return true
    }
    return false
  }, [isActionAllowed])

  // Progress to the next phase of the action
  const progressAction = useCallback((action: ActionType, currentPhase: ActionPhase) => {
    const nextPhase = getNextPhase(action, currentPhase)
    if (nextPhase && isActionAllowed(action, nextPhase)) {
      return nextPhase
    }
    return null
  }, [getNextPhase, isActionAllowed])

  return {
    currentRole,
    workflowState,
    activeAction,
    isActionAllowed,
    startAction,
    progressAction,
    getNextPhase
  }
} 