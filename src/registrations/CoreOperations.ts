import { Address, Hex } from 'viem';
import { SecureOwnable } from '../Guardian/sdk/typescript/SecureOwnable';
import { OPERATION_TYPES, FUNCTION_SELECTORS } from '../Guardian/sdk/typescript/types/core.access.index';
import { TransactionOptions } from '../Guardian/sdk/typescript/interfaces/base.index';
import { 
  OperationRegistryEntry,
  WorkflowType,
  operationRegistry,
  MultiPhaseOperationFunctions,
  SinglePhaseOperationFunctions,
  CoreOperationType
} from '../types/OperationRegistry';

/**
 * Registers all core SecureOwnable operations
 * @param contract The SecureOwnable contract instance
 */
export function registerCoreOperations(contract: SecureOwnable): void {
  registerOwnershipTransferOperation(contract);
  registerBroadcasterUpdateOperation(contract);
  registerRecoveryUpdateOperation(contract);
  registerTimeLockUpdateOperation(contract);
}

/**
 * Register the OWNERSHIP_TRANSFER operation
 * @param contract The SecureOwnable contract instance
 */
function registerOwnershipTransferOperation(contract: SecureOwnable): void {
  const functions: MultiPhaseOperationFunctions = {
    // Request phase
    request: async (_params: any, options: TransactionOptions) => {
      return contract.transferOwnershipRequest(options);
    },
    
    // Approval phase
    approve: async (txId: bigint, options: TransactionOptions) => {
      return contract.transferOwnershipDelayedApproval(txId, options);
    },
    
    approveWithMetaTx: async (metaTx, options) => {
      return contract.transferOwnershipApprovalWithMetaTx(metaTx, options);
    },
    
    // Cancellation phase
    cancel: async (txId: bigint, options: TransactionOptions) => {
      return contract.transferOwnershipCancellation(txId, options);
    },
    
    cancelWithMetaTx: async (metaTx, options) => {
      return contract.transferOwnershipCancellationWithMetaTx(metaTx, options);
    }
  };
  
  const operationEntry: OperationRegistryEntry = {
    operationType: CoreOperationType.OWNERSHIP_TRANSFER,
    operationTypeHash: OPERATION_TYPES.OWNERSHIP_TRANSFER as Hex,
    name: 'Ownership Transfer',
    workflowType: WorkflowType.MULTI_PHASE,
    requiredRoles: {
      request: 'recovery',
      approve: ['owner', 'recovery'],
      cancel: 'recovery',
      metaApprove: 'owner',
      metaCancel: 'owner'
    },
    functionSelector: FUNCTION_SELECTORS.TRANSFER_OWNERSHIP as Hex,
    description: 'Transfer ownership of the contract to a new address',
    functions
  };
  
  operationRegistry.registerOperation(operationEntry);
}

/**
 * Register the BROADCASTER_UPDATE operation
 * @param contract The SecureOwnable contract instance
 */
function registerBroadcasterUpdateOperation(contract: SecureOwnable): void {
  const functions: MultiPhaseOperationFunctions = {
    // Request phase
    request: async (params: { newBroadcaster: Address }, options: TransactionOptions) => {
      return contract.updateBroadcasterRequest(params.newBroadcaster, options);
    },
    
    // Approval phase
    approve: async (txId: bigint, options: TransactionOptions) => {
      return contract.updateBroadcasterDelayedApproval(txId, options);
    },
    
    approveWithMetaTx: async (metaTx, options) => {
      return contract.updateBroadcasterApprovalWithMetaTx(metaTx, options);
    },
    
    // Cancellation phase
    cancel: async (txId: bigint, options: TransactionOptions) => {
      return contract.updateBroadcasterCancellation(txId, options);
    },
    
    cancelWithMetaTx: async (metaTx, options) => {
      return contract.updateBroadcasterCancellationWithMetaTx(metaTx, options);
    }
  };
  
  const operationEntry: OperationRegistryEntry = {
    operationType: CoreOperationType.BROADCASTER_UPDATE,
    operationTypeHash: OPERATION_TYPES.BROADCASTER_UPDATE as Hex,
    name: 'Broadcaster Update',
    workflowType: WorkflowType.MULTI_PHASE,
    requiredRoles: {
      request: 'owner',
      approve: 'owner',
      cancel: 'owner',
      metaApprove: 'owner',
      metaCancel: 'owner'
    },
    functionSelector: FUNCTION_SELECTORS.UPDATE_BROADCASTER as Hex,
    description: 'Update the broadcaster address for meta-transactions',
    functions
  };
  
  operationRegistry.registerOperation(operationEntry);
}

/**
 * Register the RECOVERY_UPDATE operation
 * @param contract The SecureOwnable contract instance
 */
function registerRecoveryUpdateOperation(contract: SecureOwnable): void {
  const functions: SinglePhaseOperationFunctions = {
    // Get execution options for meta-transaction
    getExecutionOptions: async (params: { newRecoveryAddress: Address }) => {
      return contract.updateRecoveryExecutionOptions(params.newRecoveryAddress);
    },
    
    // Combined request and approval with meta-transaction
    requestAndApproveWithMetaTx: async (metaTx, options) => {
      return contract.updateRecoveryRequestAndApprove(metaTx, options);
    }
  };
  
  const operationEntry: OperationRegistryEntry = {
    operationType: CoreOperationType.RECOVERY_UPDATE,
    operationTypeHash: OPERATION_TYPES.RECOVERY_UPDATE as Hex,
    name: 'Recovery Address Update',
    workflowType: WorkflowType.SINGLE_PHASE,
    requiredRoles: {
      request: 'owner'
    },
    functionSelector: FUNCTION_SELECTORS.UPDATE_RECOVERY as Hex,
    description: 'Update the recovery address for the contract',
    functions
  };
  
  operationRegistry.registerOperation(operationEntry);
}

/**
 * Register the TIMELOCK_UPDATE operation
 * @param contract The SecureOwnable contract instance
 */
function registerTimeLockUpdateOperation(contract: SecureOwnable): void {
  const functions: SinglePhaseOperationFunctions = {
    // Get execution options for meta-transaction
    getExecutionOptions: async (params: { newTimeLockPeriodInMinutes: bigint }) => {
      // Ensure the value is properly converted to minutes
      const minutes = BigInt(params.newTimeLockPeriodInMinutes);
      return contract.updateTimeLockExecutionOptions(minutes);
    },
    
    // Combined request and approval with meta-transaction
    requestAndApproveWithMetaTx: async (metaTx, options) => {
      return contract.updateTimeLockRequestAndApprove(metaTx, options);
    }
  };
  
  const operationEntry: OperationRegistryEntry = {
    operationType: CoreOperationType.TIMELOCK_UPDATE,
    operationTypeHash: OPERATION_TYPES.TIMELOCK_UPDATE as Hex,
    name: 'Time Lock Period Update',
    workflowType: WorkflowType.SINGLE_PHASE,
    requiredRoles: {
      request: 'owner'
    },
    functionSelector: FUNCTION_SELECTORS.UPDATE_TIMELOCK as Hex,
    description: 'Update the time lock period for operations',
    functions
  };
  
  operationRegistry.registerOperation(operationEntry);
} 