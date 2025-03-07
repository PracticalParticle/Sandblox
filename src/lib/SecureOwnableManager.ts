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

export class SecureOwnableManager {
  private contract: SecureOwnable;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private chain: Chain;
  private address: Address;

  constructor(
    publicClient: PublicClient, 
    walletClient: WalletClient | undefined, 
    address: Address, 
    chain: Chain
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.chain = chain;
    this.address = address;
    this.contract = new SecureOwnable(publicClient, walletClient, address, chain);
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
  private mapOperationType(operationType: Hex): OperationType {
    const opTypeStr = Buffer.from(operationType.slice(2), 'hex')
      .toString('utf8')
      .replace(/\0/g, '');

    switch (opTypeStr) {
      case 'OWNERSHIP_TRANSFER':
        return 'ownership';
      case 'BROADCASTER_UPDATE':
        return 'broadcaster';
      case 'RECOVERY_UPDATE':
        return 'recovery';
      case 'TIMELOCK_UPDATE':
        return 'timelock';
      default:
        throw new Error(`Unknown operation type: ${opTypeStr}`);
    }
  }

  /**
   * Converts a TxRecord to a SecurityOperationEvent
   * @param op The transaction record from the contract
   * @returns A SecurityOperationEvent or null if conversion fails
   */
  private convertToSecurityEvent(op: TxRecord): SecurityOperationEvent | null {
    try {
      const status = this.mapTxStatusToString(Number(op.status));
      const type = this.mapOperationType(op.params.operationType as Hex);
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
        description: `${type.toUpperCase()} operation`,
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
      const events = history
        .map(op => this.convertToSecurityEvent(op))
        .filter((event): event is SecurityOperationEvent => event !== null);

      return {
        address: this.address,
        contractAddress: this.address,
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInMinutes: Number(timeLockPeriodInMinutes),
        pendingOperations: events.filter(e => e.status === 'pending'),
        recentEvents: events.filter(e => e.status !== 'pending').slice(0, 5),
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

  // Recovery Management
  async updateRecoveryAddress(newRecoveryAddress: Address, options: { from: Address }): Promise<Hash> {
    const executionOptions = await this.contract.updateRecoveryExecutionOptions(newRecoveryAddress, options);
    const metaTxParams = await this.generateMetaTxParams(options.from);
    const metaTx = await this.generateUnsignedMetaTransactionForNew(
      options.from,
      'RECOVERY_UPDATE',
      executionOptions,
      metaTxParams
    );
    const result = await this.contract.updateRecoveryRequestAndApprove(metaTx, options);
    return result.hash;
  }

  // TimeLock Management
  async updateTimeLockPeriod(newPeriodInMinutes: bigint, options: { from: Address }): Promise<Hash> {
    const executionOptions = await this.contract.updateTimeLockExecutionOptions(newPeriodInMinutes, options);
    const metaTxParams = await this.generateMetaTxParams(options.from);
    const metaTx = await this.generateUnsignedMetaTransactionForNew(
      options.from,
      'TIMELOCK_UPDATE',
      executionOptions,
      metaTxParams
    );
    const result = await this.contract.updateTimeLockRequestAndApprove(metaTx, options);
    return result.hash;
  }

  private async generateMetaTxParams(signer: Address) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    return this.contract.createMetaTxParams(
      this.address,
      '0x' as Hex, // Will be set by the contract
      deadline,
      0n, // No max gas price limit
      signer
    );
  }

  private async generateUnsignedMetaTransactionForNew(
    requester: Address,
    operationType: string,
    executionOptions: Hex,
    metaTxParams: any
  ) {
    const operationTypeHex = ('0x' + Buffer.from(operationType, 'utf8').toString('hex')) as Hex;
    
    return this.contract.generateUnsignedMetaTransactionForNew(
      requester,
      this.address,
      0n, // no value
      500000n, // gas limit
      operationTypeHex,
      ExecutionType.STANDARD,
      executionOptions,
      metaTxParams
    );
  }
} 