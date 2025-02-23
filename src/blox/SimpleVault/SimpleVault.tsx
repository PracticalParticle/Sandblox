import { 
  Address, 
  PublicClient, 
  WalletClient,
  Chain,
  Abi,
  decodeAbiParameters,
  parseAbiParameters
} from 'viem';
import SimpleVaultABIJson from './SimpleVault.abi.json';
import SecureOwnable from '../../contracts-core/SecureOwnable/SecureOwnable';
import { 
  TransactionOptions,
  TransactionResult,
  TxRecord,
  MetaTransaction,
  SecurityOperationType,
  TxStatus
} from '../../contracts-core/iCore';

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
  }

  async getEthBalance(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'getEthBalance'
    }) as unknown;
    
    // Ensure we return a bigint, defaulting to 0n if the result is falsy
    return result ? BigInt(result.toString()) : 0n;
  }

  /**
   * @notice Gets the token balance of the vault
   * @param token The token contract address
   * @return The token balance
   */
  async getTokenBalance(token: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'getTokenBalance',
      args: [token]
    }) as bigint;
    return result;
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
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'withdrawEthRequest',
      args: [to, amount],
      value: amount,
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
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
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'withdrawTokenRequest',
      args: [token, to, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
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
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalAfterDelay',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
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
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'cancelWithdrawal',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
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
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
    };
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
      parseAbiParameters('bytes4, bytes'),
      tx.executionOptions as `0x${string}`
    )[1];

    const [to, amount] = decodeAbiParameters(
      parseAbiParameters('address, uint256'),
      executionOptions
    ) as [Address, bigint];

    return {
      ...tx,
      status,
      amount,
      to,
      type: tx.operationType === SimpleVault.WITHDRAW_ETH ? "ETH" : "TOKEN",
      token: tx.operationType === SimpleVault.WITHDRAW_TOKEN ? (decodeAbiParameters(
        parseAbiParameters('address'),
        executionOptions
      )[0] as Address) : undefined
    };
  }

  async getOperationHistory(): Promise<TxRecord[]> {
    const result = await this.publicClient.readContract({
      address: this.address,
      abi: SimpleVaultABI,
      functionName: 'getOperationHistory'
    }) as TxRecord[];
    return result;
  }

  /**
   * @notice Gets all pending transactions for the vault
   * @return Array of transaction records with status
   */
    async getPendingTransactions(): Promise<VaultTxRecord[]> {
      return await super.getPendingTransactions() as VaultTxRecord[];
  }

  /**
   * @notice Gets the token metadata
   * @param token The token contract address
   * @return The token metadata including name, symbol, and decimals
   */
  async getTokenMetadata(token: Address): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    const [name, symbol, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: token,
        abi: [
          { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        ],
        functionName: 'name'
      }) as Promise<string>,
      this.publicClient.readContract({
        address: token,
        abi: [
          { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        ],
        functionName: 'symbol'
      }) as Promise<string>,
      this.publicClient.readContract({
        address: token,
        abi: [
          { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
        ],
        functionName: 'decimals'
      }) as Promise<number>
    ]);

    return { name, symbol, decimals };
  }

  /**
   * @notice Check token allowance for the vault
   * @param token Token contract address
   * @param owner Address to check allowance for
   * @return Current allowance amount
   */
  async getTokenAllowance(token: Address, owner: Address): Promise<bigint> {
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: [
        {
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          name: 'allowance',
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view',
          type: 'function'
        }
      ],
      functionName: 'allowance',
      args: [owner, this.address]
    }) as bigint;

    return allowance;
  }

  /**
   * @notice Approve vault to spend tokens
   * @param token Token contract address
   * @param amount Amount to approve
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveTokenAllowance(
    token: Address,
    amount: bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    // First check current allowance to avoid unnecessary approvals
    const currentAllowance = await this.getTokenAllowance(token, options.from);
    if (currentAllowance >= amount) {
      throw new Error("Allowance already sufficient");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: token,
      abi: [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [{ type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'approve',
      args: [this.address, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Revoke vault's permission to spend tokens
   * @param token Token contract address
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async revokeTokenAllowance(
    token: Address,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    // Check current allowance to avoid unnecessary transactions
    const currentAllowance = await this.getTokenAllowance(token, options.from);
    if (currentAllowance === BigInt(0)) {
      throw new Error("Allowance already revoked");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: token,
      abi: [
        {
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'approve',
          outputs: [{ type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'approve',
      args: [this.address, BigInt(0)],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Deposit ETH into the vault using direct wallet transfer
   * @param amount Amount of ETH to deposit in wei
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async depositEth(
    amount: bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    // Send ETH directly to the vault contract
    const hash = await this.walletClient.sendTransaction({
      chain: this.chain,
      to: this.address,
      value: amount,
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Deposit ERC20 tokens into the vault using safeTransfer
   * @param token Token contract address
   * @param amount Amount of tokens to deposit
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async depositToken(
    token: Address,
    amount: bigint,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    // Use safeTransfer to send tokens directly to the vault
    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: token,
      abi: [
        {
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'transfer',
          outputs: [{ type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'transfer',
      args: [this.address, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.publicClient.waitForTransactionReceipt({ hash })
    };
  }
}
