import React, { createContext, useContext, ReactNode } from 'react';
import { useWorkflowManager } from '@/hooks/useWorkflowManager';
import { Address, Hash } from 'viem';
import { TransactionOptions } from '@/particle-core/sdk/typescript/interfaces/base.index';
import { OperationPhase, OperationType } from '@/types/OperationRegistry';
import { WorkflowManager } from '@/lib/WorkflowManager';

// Define context type
interface WorkflowContextType {
  manager: WorkflowManager | null;
  isLoading: boolean;
  isOwner: boolean;
  isBroadcaster: boolean;
  isRecovery: boolean;
  ownerAddress?: Address;
  broadcasterAddress?: Address;
  recoveryAddress?: Address;
  requestOperation: (operationType: OperationType, params: any) => Promise<Hash | undefined>;
  approveOperation: (operationType: OperationType, txId: bigint | number) => Promise<Hash | undefined>;
  cancelOperation: (operationType: OperationType, txId: bigint | number) => Promise<Hash | undefined>;
  signApproval: (operationType: OperationType, txId: bigint | number) => Promise<string | undefined>;
  signCancellation: (operationType: OperationType, txId: bigint | number) => Promise<string | undefined>;
  signSinglePhaseOperation: (operationType: OperationType, params: any) => Promise<string | undefined>;
  executeMetaTransaction: (signedMetaTxJson: string, operationType: OperationType, action: 'approve' | 'cancel' | 'requestAndApprove') => Promise<Hash | undefined>;
  canExecutePhase: (operationType: OperationType, phase: OperationPhase, connectedAddress?: Address) => boolean;
  getRequiredRoleForOperation: (operationType: OperationType, phase: OperationPhase) => string;
  refreshAllData: () => Promise<void>;
}

// Create the context with a default value
const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

// Props for the provider component
interface WorkflowProviderProps {
  children: ReactNode;
  contractAddress?: Address;
  bloxId?: string;
}

/**
 * WorkflowProvider provides the WorkflowManager and related utilities to all children
 */
export function WorkflowProvider({ children, contractAddress, bloxId }: WorkflowProviderProps) {
  // Use the hook to get all workflow functionality
  const workflowState = useWorkflowManager(contractAddress, bloxId);
  
  // Provide the workflow state to all children
  return (
    <WorkflowContext.Provider value={workflowState}>
      {children}
    </WorkflowContext.Provider>
  );
}

/**
 * Hook to use the workflow context
 * @returns The workflow context
 * @throws If used outside of a WorkflowProvider
 */
export function useWorkflow(): WorkflowContextType {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

// Export a component that can be used to wrap a component that needs workflow functionality
interface WithWorkflowProps {
  children: ReactNode;
  contractAddress?: Address;
  bloxId?: string;
}

/**
 * Component that wraps children with a WorkflowProvider
 */
export function WithWorkflow({ children, contractAddress, bloxId }: WithWorkflowProps) {
  return (
    <WorkflowProvider contractAddress={contractAddress} bloxId={bloxId}>
      {children}
    </WorkflowProvider>
  );
} 