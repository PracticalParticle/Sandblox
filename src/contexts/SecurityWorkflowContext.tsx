import { createContext, useContext, ReactNode } from 'react'
import { useSecurityWorkflow, UseSecurityWorkflowProps } from '@/hooks/useSecurityWorkflow'

// Define the possible roles
export type Role = 'owner' | 'recovery' | 'broadcaster' | 'observer'

// Define the possible actions
export type ActionType = 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE' | 'RECOVERY_UPDATE' | 'TIMELOCK_UPDATE'

// Define the possible phases for each action
export type ActionPhase = 'REQUEST' | 'APPROVE' | 'BROADCAST' | 'META_TX'

// Define action requirements type
type ActionRequirements = {
  [key in ActionType]: {
    [phase in ActionPhase]?: Role[]
  }
}

// Define transaction state
interface TransactionState {
  txId: string
  phase: ActionPhase
  signedData?: string
  broadcasted: boolean
}

// Define signed transaction state
interface SignedTransactionState {
  actionType: ActionType
  signedData: string
  broadcasted: boolean
}

// Define base workflow state from hook
interface BaseWorkflowState {
  currentRole: Role | null
  pendingActions: {
    [key in ActionType]?: TransactionState
  }
  signedActions: {
    [key: string]: SignedTransactionState
  }
}

// Define the workflow state structure
export interface WorkflowState extends BaseWorkflowState {
  pendingTransactions: {
    [key in ActionType]?: TransactionState
  }
  signedTransactions: {
    [key: string]: SignedTransactionState
  }
}

interface SecurityWorkflowContextValue {
  currentRole: Role | null
  workflowState: WorkflowState
  activeAction: ActionType | null
  
  // Check if an action is allowed based on role and current state
  isActionAllowed: (action: ActionType, phase: ActionPhase) => boolean
  
  // Start a new action workflow
  startAction: (action: ActionType) => boolean
  
  // Progress an action to its next phase
  progressAction: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
  
  // Get the next possible phase for an action
  getNextPhase: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
  
  // Check if a role can perform an action in a specific phase
  canPerformAction: (action: ActionType, phase: ActionPhase, role: Role) => boolean
  
  // Check if there's a pending transaction for an action
  hasPendingTransaction: (action: ActionType) => boolean
  
  // Check if there's a signed transaction ready for broadcast
  hasSignedTransaction: (action: ActionType) => boolean
  
  // Get action requirements
  getActionRequirements: (action: ActionType) => {
    requiredRole: Role | Role[]
    phases: ActionPhase[]
    isTemporal: boolean
    isMetaTx: boolean
  }
}

const SecurityWorkflowContext = createContext<SecurityWorkflowContextValue | null>(null)

export function SecurityWorkflowProvider({
  children,
  ...props
}: UseSecurityWorkflowProps & { children: ReactNode }) {
  const baseWorkflowState = useSecurityWorkflow(props) as unknown as { 
    currentRole: Role | null
    workflowState: BaseWorkflowState
    activeAction: ActionType | null
    isActionAllowed: (action: ActionType, phase: ActionPhase) => boolean
    startAction: (action: ActionType) => boolean
    progressAction: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
    getNextPhase: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
  }

  const actionRequirements: ActionRequirements = {
    OWNERSHIP_TRANSFER: {
      REQUEST: ['recovery'] as Role[],
      APPROVE: ['owner', 'recovery'] as Role[],
      BROADCAST: ['broadcaster'] as Role[]
    },
    BROADCASTER_UPDATE: {
      REQUEST: ['owner'] as Role[],
      APPROVE: ['owner'] as Role[],
      BROADCAST: ['broadcaster'] as Role[]
    },
    RECOVERY_UPDATE: {
      META_TX: ['owner'] as Role[],
      BROADCAST: ['broadcaster'] as Role[]
    },
    TIMELOCK_UPDATE: {
      META_TX: ['owner'] as Role[],
      BROADCAST: ['broadcaster'] as Role[]
    }
  }

  // Helper functions for transaction state
  const hasPendingTransaction = (action: ActionType): boolean => {
    return !!baseWorkflowState.workflowState.pendingActions[action]
  }

  const hasSignedTransaction = (action: ActionType): boolean => {
    return Object.values(baseWorkflowState.workflowState.signedActions).some(
      (tx: SignedTransactionState) => tx.actionType === action && !tx.broadcasted
    )
  }

  const workflowState: WorkflowState = {
    ...baseWorkflowState.workflowState,
    pendingTransactions: baseWorkflowState.workflowState.pendingActions,
    signedTransactions: baseWorkflowState.workflowState.signedActions
  }

  const contextValue: SecurityWorkflowContextValue = {
    currentRole: baseWorkflowState.currentRole,
    workflowState,
    activeAction: baseWorkflowState.activeAction,
    isActionAllowed: baseWorkflowState.isActionAllowed,
    startAction: baseWorkflowState.startAction,
    progressAction: baseWorkflowState.progressAction,
    getNextPhase: baseWorkflowState.getNextPhase,
    hasPendingTransaction,
    hasSignedTransaction,
    
    canPerformAction: (action: ActionType, phase: ActionPhase, role: Role): boolean => {
      // Get allowed roles for this action and phase
      const allowedRoles = actionRequirements[action][phase]
      if (!allowedRoles) return false

      // Check if the role is allowed
      if (!allowedRoles.includes(role)) return false

      // Additional checks based on action state
      switch (phase) {
        case 'APPROVE':
          return hasPendingTransaction(action)
        case 'BROADCAST':
          return hasSignedTransaction(action)
        default:
          return true
      }
    },

    getActionRequirements: (action: ActionType) => {
      const requirements = {
        OWNERSHIP_TRANSFER: {
          requiredRole: ['recovery', 'owner'] as Role[],
          phases: ['REQUEST', 'APPROVE', 'BROADCAST'] as ActionPhase[],
          isTemporal: true,
          isMetaTx: false
        },
        BROADCASTER_UPDATE: {
          requiredRole: 'owner' as Role,
          phases: ['REQUEST', 'APPROVE', 'BROADCAST'] as ActionPhase[],
          isTemporal: true,
          isMetaTx: false
        },
        RECOVERY_UPDATE: {
          requiredRole: 'owner' as Role,
          phases: ['META_TX', 'BROADCAST'] as ActionPhase[],
          isTemporal: false,
          isMetaTx: true
        },
        TIMELOCK_UPDATE: {
          requiredRole: 'owner' as Role,
          phases: ['META_TX', 'BROADCAST'] as ActionPhase[],
          isTemporal: false,
          isMetaTx: true
        }
      } as const

      return requirements[action]
    }
  }

  return (
    <SecurityWorkflowContext.Provider value={contextValue}>
      {children}
    </SecurityWorkflowContext.Provider>
  )
}

export function useSecurityWorkflowContext() {
  const context = useContext(SecurityWorkflowContext)
  if (!context) {
    throw new Error('useSecurityWorkflowContext must be used within a SecurityWorkflowProvider')
  }
  return context
} 