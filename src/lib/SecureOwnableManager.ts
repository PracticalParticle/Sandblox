import { 
  Address, 
  PublicClient, 
  WalletClient,
  Chain,
  Hash
} from 'viem';
import { 
  SecureContractInfo, 
  SecurityOperationEvent, 
  SecurityOperationDetails,
  OperationType
} from './types';
import { getChainName } from './utils';
import SecureOwnable from '../particle-core/sdk/typescript/SecureOwnable';

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

  async loadContractInfo(): Promise<SecureContractInfo> {
    try {
      // Fetch contract details using Promise.all for better performance
      const [owner, broadcaster, recoveryAddress, timeLockPeriodInMinutes] = await Promise.all([
        this.contract.owner(),
        this.contract.getBroadcaster(),
        this.contract.getRecoveryAddress(),
        this.contract.getTimeLockPeriodInMinutes()
      ]);

      // Get operation history
      const history = await this.contract.getOperationHistory();
      const events: SecurityOperationEvent[] = history.map(op => {
        try {
          const operationType = op.operationType ? 
            Buffer.from(op.operationType.slice(2), 'hex')
              .toString('utf8')
              .replace(/\0/g, '') : '';

          const status = op.status === 0 ? 'pending' :
                       op.status === 1 ? 'completed' : 'cancelled';

          const timestamp = Number(op.releaseTime);
          const details: SecurityOperationDetails = {
            oldValue: op.executionOptions,
            newValue: op.value.toString(),
            remainingTime: Number(op.releaseTime) > Date.now() / 1000 ? 
              Math.floor(Number(op.releaseTime) - Date.now() / 1000) : 0
          };

          return {
            type: operationType === 'OWNERSHIP_UPDATE' ? 'ownership' :
                  operationType === 'BROADCASTER_UPDATE' ? 'broadcaster' :
                  operationType === 'RECOVERY_UPDATE' ? 'recovery' : 'timelock',
            status,
            timestamp,
            description: `${operationType.replace(/_/g, ' ')} operation`,
            details
          };
        } catch (error) {
          console.warn('Failed to parse operation:', error);
          return null;
        }
      }).filter((event): event is SecurityOperationEvent => event !== null);

      const chainId = await this.publicClient.getChainId();

      return {
        address: this.address,
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInMinutes: Number(timeLockPeriodInMinutes),
        pendingOperations: events.filter(e => e.status === 'pending'),
        recentEvents: events.filter(e => e.status !== 'pending').slice(0, 5),
        chainId,
        chainName: getChainName(chainId, [this.chain])
      };
    } catch (error) {
      console.error('Contract loading error:', error);
      throw error;
    }
  }

  // Ownership Management
  async transferOwnership(options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipRequest({ from: options.from });
    return result.hash;
  }

  async approveOwnershipTransfer(txId: number, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipDelayedApproval(txId, { from: options.from });
    return result.hash;
  }

  async cancelOwnershipTransfer(txId: number, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.transferOwnershipCancellation(txId, { from: options.from });
    return result.hash;
  }

  // Broadcaster Management
  async updateBroadcaster(newBroadcaster: Address, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterRequest(newBroadcaster, { from: options.from });
    return result.hash;
  }

  async approveBroadcasterUpdate(txId: number, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterDelayedApproval(txId, { from: options.from });
    return result.hash;
  }

  async cancelBroadcasterUpdate(txId: number, options: { from: Address }): Promise<Hash> {
    const result = await this.contract.updateBroadcasterCancellation(txId, { from: options.from });
    return result.hash;
  }

  // Recovery Management
  async updateRecoveryAddress(newRecoveryAddress: Address, options: { from: Address }): Promise<Hash> {
    const executionOptions = await this.contract.updateRecoveryExecutionOptions(newRecoveryAddress);
    const metaTx = await this.generateMetaTransaction(
      options.from,
      'RECOVERY_UPDATE',
      executionOptions
    );
    const result = await this.contract.updateRecoveryRequestAndApprove(metaTx, { from: options.from });
    return result.hash;
  }

  // TimeLock Management
  async updateTimeLockPeriod(newPeriodInMinutes: number, options: { from: Address }): Promise<Hash> {
    const executionOptions = await this.contract.updateTimeLockExecutionOptions(newPeriodInMinutes);
    const metaTx = await this.generateMetaTransaction(
      options.from,
      'TIMELOCK_UPDATE',
      executionOptions
    );
    const result = await this.contract.updateTimeLockRequestAndApprove(metaTx, { from: options.from });
    return result.hash;
  }

  private async generateMetaTransaction(
    requester: Address,
    operationType: string,
    executionOptions: string
  ) {
    const txRecord = await this.contract.createNewTxRecord(
      requester,
      this.address,
      operationType,
      SecureOwnable.ExecutionType.STANDARD,
      executionOptions,
      0,
      500000
    );

    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    return this.contract.generateUnsignedMetaTransaction(
      txRecord,
      this.address,
      '0x',
      deadline,
      0,
      requester
    );
  }
} 