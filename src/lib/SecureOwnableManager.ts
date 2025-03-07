import { 
  Address, 
  PublicClient, 
  WalletClient,
  Chain,
  Hash,
  Hex
} from 'viem';
import { 
  SecureContractInfo, 
  SecurityOperationEvent, 
  SecurityOperationDetails,
  OperationType
} from './types';
import { getChainName } from './utils';
import SecureOwnable from '../particle-core/sdk/typescript/SecureOwnable';
import { ExecutionType, TxStatus } from '../particle-core/sdk/typescript/types/lib.index';
import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index';
import { FUNCTION_SELECTORS, OPERATION_TYPES } from '../particle-core/sdk/typescript/types/core.access.index';

export class SecureOwnableManager {
  private contract: SecureOwnable;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private chain: Chain;
  private address: Address;
  private storeTransaction?: (txId: string, signedData: string, metadata: any) => void;
  private operationTypeMap: Map<string, string> | null = null;

  constructor(
    publicClient: PublicClient, 
    walletClient: WalletClient | undefined, 
    address: Address, 
    chain: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata: any) => void
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.chain = chain;
    this.address = address;
    this.contract = new SecureOwnable(publicClient, walletClient, address, chain);
    this.storeTransaction = storeTransaction;
  }

  /**
   * Maps a TxStatus enum value to a string status
   * @param status The numeric status from the contract
   * @returns A string representation of the status
   */
  private mapTxStatusToString(status: number): 'pending' | 'completed' | 'cancelled' {
    switch (status) {
      case TxStatus.PENDING:
        return 'pending';
      case TxStatus.COMPLETED:
        return 'completed';
      case TxStatus.CANCELLED:
      case TxStatus.FAILED:
      case TxStatus.REJECTED:
      case TxStatus.UNDEFINED:
      default:
        return 'cancelled';
    }
  }

  /**
   * Calculates remaining time for a transaction
   * @param releaseTime The release time as a bigint
   * @returns The remaining time in seconds
   */
  private calculateRemainingTime(releaseTime: bigint): number {
    const currentTimeBigInt = BigInt(Math.floor(Date.now() / 1000));
    return releaseTime > currentTimeBigInt ? 
      Number(releaseTime - currentTimeBigInt) : 0;
  }

  /**
   * Maps an operation type hex to a human-readable type
   * @param operationType The operation type as a hex string
   * @returns The operation type as a string
   */
  private async mapOperationType(operationType: Hex): Promise<OperationType> {
    try {
      // Initialize operation type map if not already done
      if (!this.operationTypeMap) {
        const supportedTypes = await this.contract.getSupportedOperationTypes();
        // Only map our core operation types
        const coreOperations = supportedTypes.filter(({ name }) => [
          'OWNERSHIP_TRANSFER',
          'BROADCASTER_UPDATE',
          'RECOVERY_UPDATE',
          'TIMELOCK_UPDATE'
        ].includes(name));
        
        this.operationTypeMap = new Map(
          coreOperations.map(({ operationType, name }) => [operationType, name])
        );
      }

      // Get the operation name from the map
      const operationName = this.operationTypeMap.get(operationType);
      if (!operationName) {
        // If not one of our core operations, return null to be filtered out
        return null as unknown as OperationType;
      }

      // Map the operation name to our internal type
      switch (operationName) {
        case 'OWNERSHIP_TRANSFER':
          return 'ownership';
        case 'BROADCASTER_UPDATE':
          return 'broadcaster';
        case 'RECOVERY_UPDATE':
          return 'recovery';
        case 'TIMELOCK_UPDATE':
          return 'timelock';
        default:
          return null as unknown as OperationType;
      }
    } catch (error) {
      console.error('Error mapping operation type:', error);
      return null as unknown as OperationType;
    }
  }

  /**
   * Converts a TxRecord to a SecurityOperationEvent
   * @param op The transaction record from the contract
   * @returns A SecurityOperationEvent or null if conversion fails
   */
  private async convertToSecurityEvent(op: TxRecord): Promise<SecurityOperationEvent | null> {
    try {
      const status = this.mapTxStatusToString(Number(op.status));
      const type = await this.mapOperationType(op.params.operationType as Hex);
      const remainingTime = this.calculateRemainingTime(op.releaseTime);

      const details: SecurityOperationDetails = {
        oldValue: op.params.executionOptions,
        newValue: op.params.value.toString(),
        remainingTime
      };

      return {
        type,
        status,
        timestamp: Number(op.releaseTime),
        description: `${type?.toUpperCase() || 'Unknown'} operation`,
        details
      };
    } catch (error) {
      console.warn('Failed to parse operation:', error);
      return null;
    }
  }

  async loadContractInfo(): Promise<SecureContractInfo> {
    try {
      // Fetch contract details using Promise.all for better performance
      const [
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInMinutes,
        history,
        chainId
      ] = await Promise.all([
        this.contract.owner(),
        this.contract.getBroadcaster(),
        this.contract.getRecoveryAddress(),
        this.contract.getTimeLockPeriodInMinutes(),
        this.contract.getOperationHistory(),
        this.publicClient.getChainId()
      ]);

      // Convert operation history to SecurityOperationEvents
      const events = await Promise.all(
        history.map(op => this.convertToSecurityEvent(op))
      );
      const validEvents = events.filter((event): event is SecurityOperationEvent => event !== null);

      return {
        address: this.address,
        contractAddress: this.address,
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInMinutes: Number(timeLockPeriodInMinutes),
        pendingOperations: validEvents.filter(e => e.status === 'pending'),
        recentEvents: validEvents.filter(e => e.status !== 'pending').slice(0, 5),
        chainId,
        chainName: getChainName(chainId, [this.chain]),
        operationHistory: history
      };
    } catch (error) {
      console.error('Contract loading error:', error);
      throw error;
    }
  }

  // Ownership Management
  async transferOwnership(options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipRequest(options);
    return result.hash;
  }

  async approveOwnershipTransfer(txId: bigint, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipDelayedApproval(txId, options);
    return result.hash;
  }

  async cancelOwnershipTransfer(txId: bigint, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipCancellation(txId, options);
    return result.hash;
  }

  // Broadcaster Management
  async updateBroadcaster(newBroadcaster: Address, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterRequest(newBroadcaster, options);
    return result.hash;
  }

  async approveBroadcasterUpdate(txId: bigint, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterDelayedApproval(txId, options);
    return result.hash;
  }

  async cancelBroadcasterUpdate(txId: bigint, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterCancellation(txId, options);
    return result.hash;
  }

  // Enhanced Recovery Management
  async prepareAndSignRecoveryUpdate(
    newRecoveryAddress: Address,
    options: { from: Address }
  ): Promise<void> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required');
    }

    // Get execution options for recovery update
    const executionOptions = await this.contract.updateRecoveryExecutionOptions(
      newRecoveryAddress,
      options
    );

    // Generate meta transaction parameters
    const metaTxParams = await this.contract.createMetaTxParams(
      this.address,
      FUNCTION_SELECTORS.UPDATE_RECOVERY as Hex,
      BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
      BigInt(0), // No max gas price
      options.from
    );

    // Generate unsigned meta transaction
    const unsignedMetaTx = await this.contract.generateUnsignedMetaTransactionForNew(
      options.from,
      this.address,
      BigInt(0), // No value
      BigInt(0), // No gas limit
      OPERATION_TYPES.RECOVERY_UPDATE as Hex,
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
      signature: signature as Hex
    };

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      this.storeTransaction(
        '0', // txId 0 is used for single phase meta transactions
        JSON.stringify(signedMetaTx),
        {
          type: 'RECOVERY_UPDATE',
          newRecoveryAddress,
          timestamp: Date.now()
        }
      );
    }
  }

  // Enhanced TimeLock Management
  async prepareAndSignTimeLockUpdate(
    newPeriodInMinutes: bigint,
    options: { from: Address }
  ): Promise<void> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required');
    }

    // Get execution options for timelock update
    const executionOptions = await this.contract.updateTimeLockExecutionOptions(
      newPeriodInMinutes,
      options
    );

    // Generate meta transaction parameters
    const metaTxParams = await this.contract.createMetaTxParams(
      this.address,
      FUNCTION_SELECTORS.UPDATE_TIMELOCK as Hex,
      BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
      BigInt(0), // No max gas price
      options.from
    );

    // Generate unsigned meta transaction
    const unsignedMetaTx = await this.contract.generateUnsignedMetaTransactionForNew(
      options.from,
      this.address,
      BigInt(0), // No value
      BigInt(0), // No gas limit
      OPERATION_TYPES.TIMELOCK_UPDATE as Hex,
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
      signature: signature as Hex
    };

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      this.storeTransaction(
        '0', // txId 0 is used for single phase meta transactions
        JSON.stringify(signedMetaTx),
        {
          type: 'TIMELOCK_UPDATE',
          newTimeLockPeriod: Number(newPeriodInMinutes),
          timestamp: Date.now()
        }
      );
    }
  }
} 