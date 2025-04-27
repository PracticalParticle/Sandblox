import { Address, Hex, toHex } from 'viem';
import { SecureOwnable } from '../particle-core/sdk/typescript/SecureOwnable';
import { TransactionOptions } from '../particle-core/sdk/typescript/interfaces/base.index';
import {
  operationRegistry,
  OperationRegistryEntry,
  WorkflowType,
  MultiPhaseOperationFunctions,
  OperationType,
  CoreOperationType
} from '../types/OperationRegistry';

/**
 * Example of how to register a custom operation for a SimpleVault module
 * 
 * This shows how to extend the operation registry with a new multi-phase operation
 * that follows the same workflow pattern as the core operations
 */

// Define a custom operation type string
export const VAULT_WITHDRAWAL_OPERATION = 'VAULT_WITHDRAWAL';

// Define the Hex hash for the operation (used at contract level)
export const VAULT_WITHDRAWAL_OPERATION_HASH = toHex(
  new TextEncoder().encode("VAULT_WITHDRAWAL"),
  { size: 32 }
) as Hex;

// Define the execution function selector
export const EXECUTE_VAULT_WITHDRAWAL = toHex(
  new TextEncoder().encode("executeVaultWithdrawal(address,uint256)").slice(0, 4),
  { size: 4 }
) as Hex;

// Define the approval and cancellation function selectors
export const VAULT_WITHDRAWAL_APPROVE_META = toHex(
  new TextEncoder().encode("vaultWithdrawalApprovalWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))").slice(0, 4),
  { size: 4 }
) as Hex;

export const VAULT_WITHDRAWAL_CANCEL_META = toHex(
  new TextEncoder().encode("vaultWithdrawalCancellationWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))").slice(0, 4),
  { size: 4 }
) as Hex;

/**
 * Custom SimpleVault contract interface - represents an extension to SecureOwnable
 */
interface SimpleVault extends SecureOwnable {
  // Request phase
  withdrawalRequest: (recipient: Address, amount: bigint, options: TransactionOptions) => Promise<any>;
  
  // Approval phase
  withdrawalDelayedApproval: (txId: bigint, options: TransactionOptions) => Promise<any>;
  withdrawalApprovalWithMetaTx: (metaTx: any, options: TransactionOptions) => Promise<any>;
  
  // Cancellation phase
  withdrawalCancellation: (txId: bigint, options: TransactionOptions) => Promise<any>;
  withdrawalCancellationWithMetaTx: (metaTx: any, options: TransactionOptions) => Promise<any>;
}

/**
 * Register vault withdrawal operation to the registry
 * @param vaultContract The SimpleVault contract instance
 */
export function registerVaultOperations(vaultContract: SimpleVault): void {
  // Define the operation functions
  const functions: MultiPhaseOperationFunctions = {
    // Request phase
    request: async (params: { recipient: Address, amount: bigint }, options: TransactionOptions) => {
      return vaultContract.withdrawalRequest(params.recipient, params.amount, options);
    },
    
    // Approval phase
    approve: async (txId: bigint, options: TransactionOptions) => {
      return vaultContract.withdrawalDelayedApproval(txId, options);
    },
    
    approveWithMetaTx: async (metaTx, options) => {
      return vaultContract.withdrawalApprovalWithMetaTx(metaTx, options);
    },
    
    // Cancellation phase
    cancel: async (txId: bigint, options: TransactionOptions) => {
      return vaultContract.withdrawalCancellation(txId, options);
    },
    
    cancelWithMetaTx: async (metaTx, options) => {
      return vaultContract.withdrawalCancellationWithMetaTx(metaTx, options);
    },
    
    // These would be implemented in a VaultOperationManager class similar to SecureOwnableManager
    prepareMetaTxApprove: async (txId, options) => {
      throw new Error('Not implemented in this layer');
    },
    
    prepareMetaTxCancel: async (txId, options) => {
      throw new Error('Not implemented in this layer');
    }
  };
  
  // Create the operation registry entry
  const operationEntry: OperationRegistryEntry = {
    operationType: VAULT_WITHDRAWAL_OPERATION,
    operationTypeHash: VAULT_WITHDRAWAL_OPERATION_HASH,
    name: 'Vault Withdrawal',
    workflowType: WorkflowType.MULTI_PHASE,
    requiredRoles: {
      request: 'owner',
      approve: 'owner',
      cancel: 'owner'
    },
    functionSelector: EXECUTE_VAULT_WITHDRAWAL,
    description: 'Withdraw funds from the vault to a recipient',
    functions
  };
  
  // Register the operation to the global registry
  operationRegistry.registerOperation(operationEntry);
}

/**
 * Example usage of the vault operations with the WorkflowManager
 */
export function vaultOperationsExample(): void {
  // This is a pseudocode example of how to use the operations with the WorkflowManager
  
  /*
  // Create a WorkflowManager and initialize it
  const workflowManager = new WorkflowManager(
    publicClient, 
    walletClient, 
    vaultAddress, 
    chain,
    storeTransaction
  );
  
  // Initialize the manager
  await workflowManager.initialize();
  
  // Register the vault operations
  registerVaultOperations(vaultContract as SimpleVault);
  
  // Request a withdrawal
  const hash = await workflowManager.requestOperation(
    VAULT_WITHDRAWAL_OPERATION,
    { recipient: recipientAddress, amount: ethers.parseEther("1.0") },
    { from: ownerAddress }
  );
  
  // Later, approve the withdrawal
  const approvalHash = await workflowManager.approveOperation(
    VAULT_WITHDRAWAL_OPERATION,
    txId,
    { from: ownerAddress }
  );
  
  // Or cancel the withdrawal
  const cancelHash = await workflowManager.cancelOperation(
    VAULT_WITHDRAWAL_OPERATION,
    txId,
    { from: ownerAddress }
  );
  
  // Or prepare and sign a meta-transaction for approval
  const signedMetaTx = await workflowManager.prepareAndSignApproval(
    VAULT_WITHDRAWAL_OPERATION,
    txId,
    { from: ownerAddress }
  );
  
  // Execute the meta-transaction later
  const metaTxHash = await workflowManager.executeMetaTransaction(
    signedMetaTx,
    VAULT_WITHDRAWAL_OPERATION,
    'approve',
    { from: broadcasterAddress }
  );
  */
} 