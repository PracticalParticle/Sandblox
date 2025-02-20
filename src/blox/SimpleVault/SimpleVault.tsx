import { 
  Address, 
  PublicClient, 
  WalletClient,
  Chain,
  Abi,
  decodeAbiParameters
} from 'viem';
import SimpleVaultABIJson from './SimpleVault.abi.json';
import SecureOwnable from '../../../contracts/core/SecureOwnable/SecureOwnable';
import { 
  TransactionOptions,
  TransactionResult,
  TxRecord,
  MetaTransaction,
  SecurityOperationType,
  TxStatus
} from '../../../contracts/core/iCore';

// Parse and type the ABI
const SimpleVaultABI = SimpleVaultABIJson as Abi;

/**
 * Transaction record with extended information
 */
export interface VaultTxRecord extends Omit<TxRecord, 'status'> {
  status: TxStatus;
  amount: bigint;
  to: Address;
  token?: Address;
  type: "ETH" | "TOKEN";
}

/**
 * @title SimpleVault
 * @notice TypeScript interface for SimpleVault smart contract
 * @dev Extends SecureOwnable to provide secure vault functionality for ETH and ERC20 tokens
 */
export default class SimpleVault extends SecureOwnable {
  protected publicClient: PublicClient;
  protected walletClient: WalletClient | undefined;
  protected address: Address;
  protected chain: Chain;
  private contract: any; // TODO: Add proper type

  // Constants for operation types
  static readonly WITHDRAW_ETH = "WITHDRAW_ETH" as SecurityOperationType;
  static readonly WITHDRAW_TOKEN = "WITHDRAW_TOKEN" as SecurityOperationType;

  /**
   * @notice Creates a new SimpleVault instance
   * @param client The viem PublicClient instance for blockchain interactions
   * @param walletClient Optional WalletClient for signing transactions
   * @param contractAddress The address of the contract
   * @param chain The chain object for the network
   */
  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient | undefined,
    address: Address,
    chain: Chain
  ) {
    super(publicClient, walletClient, address, chain);
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.address = address;
    this.chain = chain;
    this.contract = {
      read: {
        getPendingTransactions: async () => {
          // Implementation
          return [];
        }
      }
    };
  }

  /**
   * @notice Gets the ETH balance of the vault
   * @return The ETH balance in wei
   */
  async getEthBalance(): Promise<bigint> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'getEthBalance'
    });
    return result as bigint;
  }

  /**
   * @notice Gets the token balance of the vault
   * @param token The token contract address
   * @return The token balance
   */
  async getTokenBalance(token: Address): Promise<bigint> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'getTokenBalance',
      args: [token]
    });
    return result as bigint;
  }

  /**
   * @notice Request ETH withdrawal from the vault
   * @param to Recipient address
   * @param amount Amount of ETH to withdraw in wei
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async withdrawEthRequest(
    to: Address,
    amount: bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const currentBalance = await this.getEthBalance();
    if (amount > currentBalance) {
      throw new Error("Insufficient vault balance");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'withdrawEthRequest',
      args: [to, amount],
      value: amount,
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Request token withdrawal from the vault
   * @param token Token contract address
   * @param to Recipient address
   * @param amount Amount of tokens to withdraw
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async withdrawTokenRequest(
    token: Address,
    to: Address,
    amount: bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const currentBalance = await this.getTokenBalance(token);
    if (amount > currentBalance) {
      throw new Error("Insufficient token balance");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'withdrawTokenRequest',
      args: [token, to, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve a withdrawal after the time delay has passed
   * @param txId The ID of the withdrawal transaction to approve
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveWithdrawalAfterDelay(
    txId: number,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(txId);
    if (operation.status !== SecureOwnable.TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < operation.releaseTime) {
      throw new Error("Current time is before release time");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalAfterDelay',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancel a pending withdrawal request
   * @param txId The ID of the withdrawal transaction to cancel
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async cancelWithdrawal(
    txId: number,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(txId);
    if (operation.status !== SecureOwnable.TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    const timeLockPeriod = await this.getTimeLockPeriodInDays();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < operation.releaseTime - (timeLockPeriod * 24 * 60 * 60) + 3600) {
      throw new Error("Cannot cancel within first hour");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'cancelWithdrawal',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve withdrawal with meta transaction
   * @param metaTx The meta-transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveWithdrawalWithMetaTx(
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
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Gets all pending transactions for the vault
   * @return Array of transaction records with status
   */
  async getPendingTransactions(): Promise<VaultTxRecord[]> {
    const pendingTxs = await this.contract.read.getPendingTransactions()
    return pendingTxs.map((tx: any) => ({
      txId: Number(tx.txId),
      to: tx.to,
      amount: tx.amount,
      type: tx.type,
      releaseTime: Number(tx.releaseTime),
      status: tx.status
    }))
  }

  /**
   * @notice Gets a specific transaction's details
   * @param txId Transaction ID
   * @return Transaction record with status
   */
  async getTransaction(txId: number): Promise<VaultTxRecord> {
    const tx = await this.getOperation(txId);
    if (!tx) throw new Error("Transaction not found");

    // Map the status directly from the transaction
    let status = tx.status;
    
    // Decode the transaction parameters from the execution options
    const executionOptions = decodeAbiParameters(
      [{ type: 'bytes4' }, { type: 'bytes' }],
      tx.executionOptions as `0x${string}`
    )[1];

    const [to, amount] = decodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      executionOptions
    ) as [Address, bigint];

    return {
      ...tx,
      status,
      amount,
      to,
      type: tx.operationType === SimpleVault.WITHDRAW_ETH ? "ETH" : "TOKEN",
      token: tx.operationType === SimpleVault.WITHDRAW_TOKEN ? (decodeAbiParameters(
        [{ type: 'address' }],
        executionOptions
      )[0] as Address) : undefined
    };
  }

  async getOperationHistory(): Promise<TxRecord[]> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'getOperationHistory'
    }) as TxRecord[];
    return result;
  }
}
