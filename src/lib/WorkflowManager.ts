import { Address, Chain, Hash, Hex, PublicClient, WalletClient } from 'viem';
import { MetaTransaction } from '../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionOptions, TransactionResult } from '../particle-core/sdk/typescript/interfaces/base.index';
import { SecureOwnable } from '../particle-core/sdk/typescript/SecureOwnable';
import { 
  OperationPhase, 
  WorkflowType, 
  operationRegistry,
  isMultiPhaseOperation,
  isSinglePhaseOperation,
  canExecuteOperationPhase,
  ContractRoleInfo,
  OperationType,
  CoreOperationType
} from '../types/OperationRegistry';
import { registerCoreOperations } from '../registrations/CoreOperations';
import { ExecutionType } from '../particle-core/sdk/typescript/types/lib.index';
import { SecureContractInfo } from './types';
import { OPERATION_TYPES, FUNCTION_SELECTORS } from '../particle-core/sdk/typescript/types/core.access.index';

/**
 * Maps human-readable operation types to contract-level hashes
 */
const OPERATION_TYPE_HASH_MAP: Record<CoreOperationType, Hex> = {
  [CoreOperationType.OWNERSHIP_TRANSFER]: OPERATION_TYPES.OWNERSHIP_TRANSFER as Hex,
  [CoreOperationType.BROADCASTER_UPDATE]: OPERATION_TYPES.BROADCASTER_UPDATE as Hex,
  [CoreOperationType.RECOVERY_UPDATE]: OPERATION_TYPES.RECOVERY_UPDATE as Hex,
  [CoreOperationType.TIMELOCK_UPDATE]: OPERATION_TYPES.TIMELOCK_UPDATE as Hex
};

/**
 * WorkflowManager provides a simplified interface for executing all types of operations
 * using the operation registry to standardize workflows.
 */
export class WorkflowManager {
  private contract: SecureOwnable;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private contractAddress: Address;
  private chain: Chain;
  private broadcaster: Address = '0x0000000000000000000000000000000000000000' as Address;
  private contractInfo?: SecureContractInfo;
  private storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, unknown>) => void;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient | undefined,
    contractAddress: Address,
    chain: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, unknown>) => void
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
    this.chain = chain;
    this.contract = new SecureOwnable(publicClient, walletClient, contractAddress, chain);
    this.storeTransaction = storeTransaction;

    // Register core operations with the registry
    registerCoreOperations(this.contract);
  }

  /**
   * Initializes the workflow manager by loading contract information
   */
  async initialize(): Promise<SecureContractInfo> {
    // Load contract info and set broadcaster
    this.contractInfo = await this.loadContractInfo();
    this.broadcaster = this.contractInfo.broadcaster as Address;
    return this.contractInfo;
  }

  /**
   * Loads basic contract information
   */
  private async loadContractInfo(): Promise<SecureContractInfo> {
    const [owner, broadcaster, recovery, timeLockPeriodInMinutes, chainId] = await Promise.all([
      this.contract.owner(),
      this.contract.getBroadcaster(),
      this.contract.getRecoveryAddress(),
      this.contract.getTimeLockPeriodInMinutes(),
      this.publicClient.getChainId()
    ]);

    // Get a properly typed chain name
    const chainName = typeof this.chain.name === 'string' ? this.chain.name : 'Unknown Chain';

    return {
      address: this.contractAddress,
      contractAddress: this.contractAddress,
      owner,
      broadcaster,
      recoveryAddress: recovery,
      timeLockPeriodInMinutes: Number(timeLockPeriodInMinutes),
      pendingOperations: [],
      recentEvents: [],
      chainId,
      chainName,
      operationHistory: []
    };
  }

  /**
   * Gets the contract-level hash for an operation type
   */
  private getOperationTypeHash(operationType: OperationType): Hex {
    const operation = operationRegistry.getOperation(operationType);
    if (operation) {
      return operation.operationTypeHash;
    }
    
    // Fallback to the map for core operations
    if (operationType in OPERATION_TYPE_HASH_MAP) {
      return OPERATION_TYPE_HASH_MAP[operationType as CoreOperationType];
    }
    
    throw new Error(`Unknown operation type: ${operationType}`);
  }

  /**
   * Checks if the connected wallet is authorized to perform a specific operation phase
   */
  canExecutePhase(
    operationType: OperationType,
    phase: OperationPhase,
    connectedAddress?: Address
  ): boolean {
    if (!connectedAddress || !this.contractInfo) return false;
    
    // Map SecureContractInfo to ContractRoleInfo interface
    const contractInfoForAuth: ContractRoleInfo = {
      owner: this.contractInfo.owner as Address,
      broadcaster: this.contractInfo.broadcaster as Address,
      recovery: this.contractInfo.recoveryAddress as Address
    };
    
    // Special case for ownership transfer cancellation
    if (operationType === CoreOperationType.OWNERSHIP_TRANSFER && phase === OperationPhase.CANCEL) {
      return contractInfoForAuth.recovery?.toLowerCase() === connectedAddress.toLowerCase();
    }
    
    return canExecuteOperationPhase(
      operationType,
      phase,
      connectedAddress,
      contractInfoForAuth
    );
  }

  // MULTI-PHASE OPERATION METHODS

  /**
   * Initiates a request for a multi-phase operation
   */
  async requestOperation(
    operationType: OperationType,
    params: any,
    options: TransactionOptions
  ): Promise<Hash> {
    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isMultiPhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a multi-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.REQUEST, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to request this operation`);
    }

    const result = await operation.functions.request(params, options);
    return result.hash;
  }

  /**
   * Approves a pending multi-phase operation
   */
  async approveOperation(
    operationType: OperationType,
    txId: bigint,
    options: TransactionOptions
  ): Promise<Hash> {
    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isMultiPhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a multi-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.APPROVE, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to approve this operation`);
    }

    const result = await operation.functions.approve(txId, options);
    return result.hash;
  }

  /**
   * Cancels a pending multi-phase operation
   */
  async cancelOperation(
    operationType: OperationType,
    txId: bigint,
    options: TransactionOptions
  ): Promise<Hash> {
    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isMultiPhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a multi-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.CANCEL, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to cancel this operation`);
    }

    const result = await operation.functions.cancel(txId, options);
    return result.hash;
  }

  /**
   * Prepares and signs a meta-transaction for approving a pending operation
   */
  async prepareAndSignApproval(
    operationType: OperationType,
    txId: bigint,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required');
    }

    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isMultiPhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a multi-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.META_APPROVE, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to approve this operation via meta-transaction`);
    }

    // Get the function selector for the approve meta-tx function
    let functionSelector: Hex;
    functionSelector = this.getMetaTxFunctionSelector(operationType, 'approve');

    // Generate meta-transaction parameters
    const metaTxParams = await this.contract.createMetaTxParams(
      this.broadcaster,
      functionSelector,
      BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
      BigInt(0), // No max gas price
      options.from
    );

    // Generate unsigned meta-transaction for existing tx
    const unsignedMetaTx = await this.contract.generateUnsignedMetaTransactionForExisting(
      txId,
      metaTxParams
    );

    // Get the message hash and sign it
    const messageHash = unsignedMetaTx.message;
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash as Hex },
      account: options.from
    });

    // Create the complete signed meta transaction
    const signedMetaTx = {
      ...unsignedMetaTx,
      signature
    };

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      this.storeTransaction(
        txId.toString(),
        JSON.stringify(signedMetaTx, this.bigIntReplacer),
        {
          type: operation.name.replace(/\s+/g, '_').toUpperCase(),
          operationType,
          action: 'approve',
          broadcasted: false,
          timestamp: Date.now(),
          status: 'PENDING'
        }
      );
    }

    return JSON.stringify(signedMetaTx, this.bigIntReplacer);
  }

  /**
   * Prepares and signs a meta-transaction for canceling a pending operation
   */
  async prepareAndSignCancellation(
    operationType: OperationType,
    txId: bigint,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required');
    }

    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isMultiPhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a multi-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.META_CANCEL, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to cancel this operation via meta-transaction`);
    }

    // Get the function selector for the cancel meta-tx function
    let functionSelector: Hex;
    functionSelector = this.getMetaTxFunctionSelector(operationType, 'cancel');

    // Generate meta-transaction parameters
    const metaTxParams = await this.contract.createMetaTxParams(
      this.broadcaster,
      functionSelector,
      BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
      BigInt(0), // No max gas price
      options.from
    );

    // Generate unsigned meta-transaction for existing tx
    const unsignedMetaTx = await this.contract.generateUnsignedMetaTransactionForExisting(
      txId,
      metaTxParams
    );

    // Get the message hash and sign it
    const messageHash = unsignedMetaTx.message;
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash as Hex },
      account: options.from
    });

    // Create the complete signed meta transaction
    const signedMetaTx = {
      ...unsignedMetaTx,
      signature
    };

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      this.storeTransaction(
        txId.toString(),
        JSON.stringify(signedMetaTx, this.bigIntReplacer),
        {
          type: operation.name.replace(/\s+/g, '_').toUpperCase(),
          operationType,
          action: 'cancel',
          broadcasted: false,
          timestamp: Date.now(),
          status: 'PENDING'
        }
      );
    }

    return JSON.stringify(signedMetaTx, this.bigIntReplacer);
  }

  // SINGLE-PHASE OPERATION METHODS

  /**
   * Prepares and signs a meta-transaction for a single-phase operation
   */
  async prepareAndSignSinglePhaseOperation(
    operationType: OperationType,
    params: any,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required');
    }

    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    if (!isSinglePhaseOperation(operation)) {
      throw new Error(`Operation ${operation.name} is not a single-phase operation`);
    }

    if (!this.canExecutePhase(operationType, OperationPhase.REQUEST, options.from)) {
      throw new Error(`Account ${options.from} is not authorized to request this operation`);
    }

    // Get execution options for the operation
    const executionOptions = await operation.functions.getExecutionOptions(params);

    // Get the function selector
    let functionSelector: Hex;
    functionSelector = this.getMetaTxFunctionSelector(operationType, 'requestAndApprove');

    // Generate meta-transaction parameters
    const metaTxParams = await this.contract.createMetaTxParams(
      this.broadcaster,
      functionSelector,
      BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
      BigInt(0), // No max gas price
      options.from
    );

    // Process the parameters based on operation type
    let actualParams = params;

    // Generate unsigned meta-transaction for new operation
    const unsignedMetaTx = await this.contract.generateUnsignedMetaTransactionForNew(
      options.from,
      this.contractAddress,
      BigInt(0), // No value
      BigInt(0), // No gas limit
      this.getOperationTypeHash(operationType),
      ExecutionType.STANDARD,
      executionOptions,
      metaTxParams
    );

    // Get the message hash and sign it
    const messageHash = unsignedMetaTx.message;
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash as Hex },
      account: options.from
    });

    // Create the complete signed meta transaction
    const signedMetaTx = {
      ...unsignedMetaTx,
      signature
    };

    return JSON.stringify(signedMetaTx, this.bigIntReplacer);
  }

  /**
   * Executes a signed meta-transaction
   */
  async executeMetaTransaction(
    signedMetaTxJson: string,
    operationType: OperationType,
    action: 'approve' | 'cancel' | 'requestAndApprove',
    options: TransactionOptions
  ): Promise<Hash> {
    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    // Parse the signed meta-transaction
    const signedMetaTx = JSON.parse(signedMetaTxJson, this.bigIntReviver) as MetaTransaction;

    // Execute the appropriate function based on operation type and action
    if (isMultiPhaseOperation(operation)) {
      if (action === 'approve') {
        const result = await operation.functions.approveWithMetaTx(signedMetaTx, options);
        return result.hash;
      } else if (action === 'cancel') {
        const result = await operation.functions.cancelWithMetaTx(signedMetaTx, options);
        return result.hash;
      }
    } else if (isSinglePhaseOperation(operation)) {
      if (action === 'requestAndApprove') {
        const result = await operation.functions.requestAndApproveWithMetaTx(signedMetaTx, options);
        return result.hash;
      }
    }

    throw new Error(`Unsupported action '${action}' for operation type '${operation.name}'`);
  }

  // HELPER METHODS

  /**
   * Gets the appropriate function selector for a meta-transaction based on operation type and action
   */
  private getMetaTxFunctionSelector(operationType: OperationType, action: 'approve' | 'cancel' | 'requestAndApprove'): Hex {
    // Get operation from registry
    const operation = operationRegistry.getOperation(operationType);
    if (!operation) {
      throw new Error(`Unknown operation type: ${operationType}`);
    }

    // If we're using core operations, look them up directly
    if (operationType === CoreOperationType.OWNERSHIP_TRANSFER) {
      if (action === 'approve') return FUNCTION_SELECTORS.TRANSFER_OWNERSHIP_APPROVE_META as Hex;
      if (action === 'cancel') return FUNCTION_SELECTORS.TRANSFER_OWNERSHIP_CANCEL_META as Hex;
    } else if (operationType === CoreOperationType.BROADCASTER_UPDATE) {
      if (action === 'approve') return FUNCTION_SELECTORS.UPDATE_BROADCASTER_APPROVE_META as Hex;
      if (action === 'cancel') return FUNCTION_SELECTORS.UPDATE_BROADCASTER_CANCEL_META as Hex;
    } else if (operationType === CoreOperationType.RECOVERY_UPDATE) {
      if (action === 'requestAndApprove') return FUNCTION_SELECTORS.UPDATE_RECOVERY_META as Hex;
    } else if (operationType === CoreOperationType.TIMELOCK_UPDATE) {
      if (action === 'requestAndApprove') return FUNCTION_SELECTORS.UPDATE_TIMELOCK_META as Hex;
    }

    // For custom operations, this information should be stored in the operation's metadata
    // This is a simplified version - in a real implementation, this information would be
    // part of the operation registration
    throw new Error(`No function selector found for operation ${operationType} and action ${action}`);
  }

  /**
   * Handles BigInt serialization for JSON
   */
  private bigIntReplacer(_key: string, value: any): any {
    if (typeof value === "bigint") {
      return value.toString() + 'n';
    }
    return value;
  }

  /**
   * Handles BigInt deserialization from JSON
   */
  private bigIntReviver(_key: string, value: any): any {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }
} 