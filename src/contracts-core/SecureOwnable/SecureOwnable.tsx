import { 
  Address, 
  PublicClient, 
  WalletClient,
  Chain,
  Abi
} from 'viem';
import SecureOwnableABIJson from './SecureOwnable.abi.json';

// Parse and type the ABI
const SecureOwnableABI = SecureOwnableABIJson as Abi;

import { 
  TransactionOptions,
  SecurityOperationType,
  TxRecord,
  MetaTransaction,
  TxStatus,
  ExecutionType,
  TransactionResult,
  PaymentDetails
} from '../iCore';
import { ContractValidations } from '../validations';

/**
 * @title SecureOwnableContract
 * @notice Abstract contract providing secure ownership management with timelock and recovery features
 * @dev Implements secure ownership transfer, broadcaster updates, and recovery mechanisms
 */
class SecureOwnable {
  protected client: PublicClient;
  protected walletClient?: WalletClient;
  protected contractAddress: Address;
  protected validations: ContractValidations;
  protected chain: Chain;

  // Static constants for easy access to operation types
  static readonly SecurityOperationType = SecurityOperationType;
  static readonly TxStatus = TxStatus;
  static readonly ExecutionType = ExecutionType;

  /**
   * @notice Creates a new SecureOwnableContract instance
   * @param client The viem PublicClient instance for blockchain interactions
   * @param walletClient Optional WalletClient for signing transactions
   * @param contractAddress The address of the contract
   * @param chain The chain object for the network
   */
  constructor(client: PublicClient, walletClient: WalletClient | undefined, contractAddress: Address, chain: Chain) {
    this.client = client;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
    this.validations = new ContractValidations(client);
    this.chain = chain;
  }

  /**
   * @notice Gets the current owner of the contract
   * @return The address of the current owner
   */
  async owner(): Promise<Address> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'owner'
    }) as Address;
    return result;
  }

  /**
   * @notice Gets the current broadcaster address
   * @return The address of the current broadcaster
   */
  async getBroadcaster(): Promise<Address> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'getBroadcaster'
    }) as Address;
    return result;
  }

  /**
   * @notice Gets the current recovery address
   * @return The address of the recovery wallet
   */
  async getRecoveryAddress(): Promise<Address> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'getRecoveryAddress'
    }) as Address;
    return result;
  }

  /**
   * @notice Gets the current timelock period in days
   * @return The number of days in the timelock period
   */
  async getTimeLockPeriodInDays(): Promise<number> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'getTimeLockPeriodInDays'
    }) as number;
    return result;
  }

  /**
   * @notice Gets a specific operation by its transaction ID
   * @param txId The ID of the transaction to retrieve
   * @return The transaction record for the given ID
   */
  async getOperation(txId: number): Promise<TxRecord> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'getOperation',
      args: [txId]
    }) as TxRecord;
    return result;
  }

  /**
   * @notice Gets the operation history for a specific operation type
   * @return Array of transaction records matching the operation type
   */
  async getOperationHistory(): Promise<TxRecord[]> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'getOperationHistory'
    }) as TxRecord[];
    return result;
  }

  /**
   * @notice Gets all pending transactions
   * @return Array of transaction records with pending status
   */
  async getPendingTransactions(): Promise<TxRecord[]> {
    try {
      const operations = await this.getOperationHistory();
      return operations.filter(op => op.status === TxStatus.PENDING);
    } catch (error) {
      console.error('Failed to get pending transactions:', error);
      return [];
    }
  }

  /**
   * @notice Initiates a transfer ownership request
   * @dev Can only be called by the recovery address
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async transferOwnershipRequest(options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const recoveryAddress = await this.getRecoveryAddress();
    await this.validations.validateRole(options.from, recoveryAddress, "recovery owner");
    
    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipRequest',
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approves a delayed ownership transfer
   * @dev Can only be called by the owner or recovery address after timelock period
   * @param txId The ID of the ownership transfer transaction to approve
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async transferOwnershipDelayedApproval(txId: number, options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const [owner, recoveryAddress] = await Promise.all([
      this.owner(),
      this.getRecoveryAddress()
    ]);
    
    await this.validations.validateMultipleRoles(options.from, owner, recoveryAddress, "owner or recovery");

    const operation = await this.getOperation(txId);
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < operation.releaseTime) {
      throw new Error("Current time is before release time");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipDelayedApproval',
      args: [txId],
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancels a pending ownership transfer request
   * @dev Can only be called by the recovery address after 1 hour
   * @param txId The ID of the ownership transfer transaction to cancel
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async transferOwnershipCancellation(txId: number, options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const recoveryAddress = await this.getRecoveryAddress();
    await this.validations.validateRole(options.from, recoveryAddress, "recovery owner");

    const operation = await this.getOperation(txId);
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeLockPeriod = await this.getTimeLockPeriodInDays();
    if (currentTimestamp < operation.releaseTime - (timeLockPeriod * 24 * 60 * 60) + 3600) {
      throw new Error("Cannot cancel within first hour");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipCancellation',
      args: [txId],
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Requests an update to the broadcaster address
   * @dev Can only be called by the owner
   * @param newBroadcaster The address of the new broadcaster
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async updateBroadcasterRequest(newBroadcaster: Address, options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const currentBroadcaster = await this.getBroadcaster();
    if (newBroadcaster === currentBroadcaster) {
      throw new Error("New broadcaster must be different");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterRequest',
      args: [newBroadcaster],
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approves a delayed broadcaster update
   * @dev Can only be called by the owner after timelock period
   * @param txId The ID of the broadcaster update transaction to approve
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async updateBroadcasterDelayedApproval(txId: number, options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(txId);
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterDelayedApproval',
      args: [txId],
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancels a pending broadcaster update request
   * @dev Can only be called by the owner after 1 hour
   * @param txId The ID of the broadcaster update transaction to cancel
   * @param options Transaction options including the sender address
   * @return TransactionResult containing hash and wait function
   */
  async updateBroadcasterCancellation(txId: number, options: TransactionOptions = {}): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");
    
    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(txId);
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeLockPeriod = await this.getTimeLockPeriodInDays();
    if (currentTimestamp < operation.releaseTime - (timeLockPeriod * 24 * 60 * 60) + 3600) {
      throw new Error("Cannot cancel within first hour");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterCancellation',
      args: [txId],
      account: options.from as Address
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Gets the execution options for updating the recovery address
   * @param newRecoveryAddress The address of the new recovery wallet
   * @return The encoded execution options
   */
  async updateRecoveryExecutionOptions(newRecoveryAddress: Address): Promise<string> {
    const [currentRecovery, currentOwner] = await Promise.all([
      this.getRecoveryAddress(),
      this.owner()
    ]);

    if (newRecoveryAddress === currentRecovery) {
      throw new Error("New recovery must be different");
    }
    if (newRecoveryAddress === currentOwner) {
      throw new Error("Recovery address cannot be owner");
    }

    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateRecoveryExecutionOptions',
      args: [newRecoveryAddress]
    });

    return result as string;
  }

  /**
   * @notice Gets the execution options for updating the timelock period
   * @param newTimeLockPeriodInDays The new timelock period in days
   * @return The encoded execution options
   */
  async updateTimeLockExecutionOptions(newTimeLockPeriodInDays: number): Promise<string> {
    this.validations.validateTimePeriod(newTimeLockPeriodInDays, "Invalid timelock period");

    const currentPeriod = await this.getTimeLockPeriodInDays();
    if (newTimeLockPeriodInDays === currentPeriod) {
      throw new Error("New timelock must be different");
    }

    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateTimeLockExecutionOptions',
      args: [newTimeLockPeriodInDays]
    });

    return result as string;
  }

  /**
   * @notice Creates a new transaction record
   * @param requester The address requesting the transaction
   * @param target The target contract address
   * @param operationType The type of operation to perform
   * @param executionType The type of execution (STANDARD or RAW)
   * @param executionOptions The execution options for the transaction
   * @param value The value to send with the transaction
   * @param gasLimit The gas limit for the transaction
   * @return The created transaction record
   */
  async createNewTxRecord(
    requester: Address,
    target: Address,
    operationType: SecurityOperationType,
    executionType: ExecutionType,
    executionOptions: string,
    value: number,
    gasLimit: number
  ): Promise<TxRecord> {
    const operationTypeBytes = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: operationType
    }) as string;

    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'createNewTxRecord',
      args: [
        requester,
        target,
        operationTypeBytes,
        executionType,
        executionOptions,
        value,
        gasLimit
      ]
    });

    return result as TxRecord;
  }

  /**
   * @notice Generates an unsigned meta-transaction
   * @param txRecord The transaction record to generate the meta-transaction for
   * @param handlerContract The contract that will handle the meta-transaction
   * @param handlerSelector The function selector that will handle the meta-transaction
   * @param deadline The deadline for the meta-transaction
   * @param maxGasPrice The maximum gas price for the meta-transaction
   * @param signer The address of the signer
   * @return The generated meta-transaction
   */
  async generateUnsignedMetaTransaction(
    txRecord: TxRecord,
    handlerContract: Address,
    handlerSelector: string,
    deadline: number,
    maxGasPrice: number,
    signer: Address
  ): Promise<MetaTransaction> {
    this.validations.validateFutureTimestamp(deadline, "Meta-transaction deadline must be in the future");

    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'generateUnsignedMetaTransaction',
      args: [
        txRecord,
        handlerContract,
        handlerSelector,
        deadline,
        maxGasPrice,
        signer
      ]
    });

    return result as MetaTransaction;
  }

  /**
   * @notice Approve ownership transfer with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async transferOwnershipApprovalWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipApprovalWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancel ownership transfer with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async transferOwnershipCancellationWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipCancellationWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve broadcaster update with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async updateBroadcasterApprovalWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterApprovalWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Update recovery address with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async updateRecoveryRequestAndApprove(
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateRecoveryRequestAndApprove',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Update timelock period with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async updateTimeLockRequestAndApprove(
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'updateTimeLockRequestAndApprove',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Execute payment with meta transaction
   * @param payment The payment details
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async makePayment(
    payment: PaymentDetails,
    metaTx: MetaTransaction,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from, broadcaster);
    await this.validations.validateMetaTransaction(metaTx);

    if (metaTx.txRecord.target !== this.contractAddress) {
      throw new Error("Can only pay for own actions");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SecureOwnableABI,
      functionName: 'makePayment',
      args: [payment, metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }
}

export default SecureOwnable; 