import React, { createContext, useContext, ReactNode } from 'react'
import { useSecurityWorkflow, UseSecurityWorkflowProps, WorkflowState, ActionType, ActionPhase } from '@/hooks/useSecurityWorkflow'

export type { ActionType, ActionPhase }

interface SecurityWorkflowContextValue {
  currentRole: string
  workflowState: WorkflowState
  activeAction: ActionType | null
  isActionAllowed: (action: ActionType, phase: ActionPhase) => boolean
  startAction: (action: ActionType) => boolean
  progressAction: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
  getNextPhase: (action: ActionType, currentPhase: ActionPhase) => ActionPhase | null
}

const SecurityWorkflowContext = createContext<SecurityWorkflowContextValue | null>(null)

export function SecurityWorkflowProvider({
  children,
  ...props
}: UseSecurityWorkflowProps & { children: ReactNode }) {
  const workflowState = useSecurityWorkflow(props)

  return (
    <SecurityWorkflowContext.Provider value={workflowState}>
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