import { Address, Chain, Hex, PublicClient, WalletClient } from 'viem';
import {
  OperationRegistryEntry,
  operationRegistry,
  WorkflowType,
  MultiPhaseOperationFunctions,
  SinglePhaseOperationFunctions,
  OperationType
} from './OperationRegistry';
import { SecureOwnable } from '../particle-core/sdk/typescript/SecureOwnable';

/**
 * Base abstract class for Blox operations handlers
 * All Blox-specific operation handlers should extend this class
 */
export abstract class BaseBloxOperationsHandler {
  protected bloxId: string;
  protected contractTypes: string[];

  /**
   * @param bloxId The unique identifier for this Blox
   * @param contractTypes Array of contract type names this handler supports
   */
  constructor(bloxId: string, contractTypes: string[]) {
    this.bloxId = bloxId;
    this.contractTypes = contractTypes;
  }

  /**
   * Get the Blox ID
   * @returns The Blox ID
   */
  getBloxId(): string {
    return this.bloxId;
  }

  /**
   * Check if this handler can handle a given contract type
   * @param contractType The contract type to check
   * @returns True if this handler can handle the contract type
   */
  canHandle(contractType: string): boolean {
    return this.contractTypes.includes(contractType);
  }

  /**
   * Register all operations for this Blox
   * This method must be implemented by subclasses
   * It is async to allow loading operation types from contracts
   */
  abstract registerOperations(
    contract: any,
    contractAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    chain?: Chain
  ): Promise<void>;

  /**
   * Helper method to register a multi-phase operation
   */
  protected registerMultiPhaseOperation(
    operationType: OperationType,
    operationTypeHash: Hex,
    name: string,
    description: string,
    functionSelector: Hex,
    functions: MultiPhaseOperationFunctions,
    requiredRoles: {
      request?: 'owner' | 'recovery' | string[];
      approve?: 'owner' | 'recovery' | string[];
      cancel?: 'owner' | 'recovery' | string[];
      metaApprove?: 'owner' | string[];
      metaCancel?: 'owner' | string[];
    }
  ): void {
    const operationEntry: OperationRegistryEntry = {
      operationType,
      operationTypeHash,
      name,
      workflowType: WorkflowType.MULTI_PHASE,
      requiredRoles,
      functionSelector,
      description,
      functions
    };

    operationRegistry.registerOperation(operationEntry);
  }

  /**
   * Helper method to register a single-phase operation
   */
  protected registerSinglePhaseOperation(
    operationType: OperationType,
    operationTypeHash: Hex,
    name: string,
    description: string,
    functionSelector: Hex,
    functions: SinglePhaseOperationFunctions,
    requiredRoles: {
      request?: 'owner' | 'recovery' | string[];
    }
  ): void {
    const operationEntry: OperationRegistryEntry = {
      operationType,
      operationTypeHash,
      name,
      workflowType: WorkflowType.SINGLE_PHASE,
      requiredRoles,
      functionSelector,
      description,
      functions
    };

    operationRegistry.registerOperation(operationEntry);
  }
} 