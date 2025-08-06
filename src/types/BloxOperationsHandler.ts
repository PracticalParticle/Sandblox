import { Address, Chain, Hex, PublicClient, WalletClient } from 'viem';
import {
  OperationRegistryEntry,
  operationRegistry,
  WorkflowType,
  MultiPhaseOperationFunctions,
  SinglePhaseOperationFunctions,
  OperationType
} from './OperationRegistry';
import { TxRecord } from '../Guardian/sdk/typescript/interfaces/lib.index';

/**
 * Base abstract class for Blox operations handlers
 * All Blox-specific operation handlers should extend this class
 */
export abstract class BaseBloxOperationsHandler {
  protected bloxId: string;
  protected contractTypes: string[];
  protected contract: any | null = null;
  protected contractAddress: Address | null = null;
  protected publicClient: PublicClient | null = null;
  protected walletClient: WalletClient | null = null;
  protected chain: Chain | null = null;
  protected storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, any>) => void;

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
    chain?: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, any>) => void
  ): Promise<void>;

  /**
   * Initialize the handler with contract instance and clients
   */
  protected initialize(
    contract: any,
    contractAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    chain?: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, any>) => void
  ): void {
    this.contract = contract;
    this.contractAddress = contractAddress;
    this.publicClient = publicClient;
    this.walletClient = walletClient || null;
    this.chain = chain || null;
    this.storeTransaction = storeTransaction;
  }

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
      functions,
      bloxId: this.bloxId
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
      functions,
      bloxId: this.bloxId
    };

    operationRegistry.registerOperation(operationEntry);
  }

  /**
   * Get operation name for a transaction
   */
  getOperationName(tx: TxRecord): string {
    const operation = operationRegistry.getOperationByHash(tx.params.operationType as Hex);
    return operation?.name || 'Unknown Operation';
  }

  /**
   * Convert a TxRecord to a blox-specific record type
   * This method must be implemented by subclasses
   */
  abstract convertRecord(record: TxRecord): any;

  /**
   * Handle approval of a transaction
   */
  abstract handleApprove(txId: number): Promise<void>;

  /**
   * Handle cancellation of a transaction
   */
  abstract handleCancel(txId: number): Promise<void>;

  /**
   * Handle meta-transaction signing
   */
  abstract handleMetaTxSign(tx: TxRecord, type: 'approve' | 'cancel'): Promise<void>;

  /**
   * Handle meta-transaction broadcasting
   */
  abstract handleBroadcast(tx: TxRecord, type: 'approve' | 'cancel'): Promise<void>;
} 