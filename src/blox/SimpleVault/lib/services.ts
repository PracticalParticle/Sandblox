import { Address, PublicClient, WalletClient, Chain, Hex } from 'viem';
import { TransactionOptions, TransactionResult } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { TxRecord, MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { TxStatus } from '../../../particle-core/sdk/typescript/types/lib.index';
import { ContractValidations } from '../../../particle-core/sdk/typescript/utils/validations';
import SimpleVault from '../SimpleVault';
import { TokenMetadata, VaultMetaTxParams, VaultTxRecord } from './types';
import SecureOwnable from '../../../particle-core/sdk/typescript/SecureOwnable';

// Storage key for meta tx settings
const META_TX_SETTINGS_KEY = 'simpleVault.metaTxSettings';

// Default values for meta tx settings
const DEFAULT_META_TX_SETTINGS: VaultMetaTxParams = {
  deadline: BigInt(3600), // 1 hour in seconds
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

/**
 * Services class providing business logic for SimpleVault operations
 */
export class SimpleVaultService {
  private client: PublicClient;
  private walletClient?: WalletClient;
  private contractAddress: Address;
  private chain: Chain;
  private vault: SimpleVault;
  private validations: ContractValidations;
  private secureOwnable: SecureOwnable;

  constructor(
    client: PublicClient,
    walletClient: WalletClient | undefined,
    contractAddress: Address,
    chain: Chain
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
    this.chain = chain;
    this.vault = new SimpleVault(client, walletClient, contractAddress, chain);
    this.validations = new ContractValidations(client);
    this.secureOwnable = new SecureOwnable(client, walletClient, contractAddress, chain);
  }

  /**
   * Get meta transaction settings from local storage
   * @returns VaultMetaTxParams with stored or default settings
   */
  getStoredMetaTxSettings(): VaultMetaTxParams {
    try {
      const stored = localStorage.getItem(META_TX_SETTINGS_KEY);
      if (!stored) return DEFAULT_META_TX_SETTINGS;
      const parsed = JSON.parse(stored);
      return {
        deadline: BigInt(parsed.deadline),
        maxGasPrice: BigInt(parsed.maxGasPrice)
      };
    } catch (error) {
      console.error('Failed to load meta tx settings:', error);
      return DEFAULT_META_TX_SETTINGS;
    }
  }

  /**
   * Create VaultMetaTxParams with absolute deadline from settings
   * @param settings VaultMetaTxParams containing relative deadline
   * @returns VaultMetaTxParams with absolute deadline
   */
  createVaultMetaTxParams(settings: VaultMetaTxParams): VaultMetaTxParams {
    // Get current timestamp in seconds
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    
    // Convert deadline from seconds to actual timestamp by adding to current time
    const deadlineTimestamp = currentTimestamp + BigInt(settings.deadline);
    
    return {
      deadline: deadlineTimestamp,
      maxGasPrice: settings.maxGasPrice
    };
  }

  /**
   * Store meta transaction settings to local storage
   * @param settings VaultMetaTxParams to store
   */
  storeMetaTxSettings(settings: VaultMetaTxParams): void {
    try {
      localStorage.setItem(META_TX_SETTINGS_KEY, JSON.stringify({
        deadline: settings.deadline.toString(),
        maxGasPrice: settings.maxGasPrice.toString()
      }));
    } catch (error) {
      console.error('Failed to store meta tx settings:', error);
    }
  }

  /**
   * Request ETH withdrawal with validation
   */
  async withdrawEthRequest(
    to: Address,
    amount: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const currentBalance = await this.vault.getEthBalance();
    if (amount > currentBalance) {
      throw new Error("Insufficient vault balance");
    }

    return this.vault.withdrawEthRequest(to, amount, options);
  }

  /**
   * Request token withdrawal with validation
   */
  async withdrawTokenRequest(
    token: Address,
    to: Address,
    amount: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const currentBalance = await this.vault.getTokenBalance(token);
    if (amount > currentBalance) {
      throw new Error("Insufficient token balance");
    }

    return this.vault.withdrawTokenRequest(token, to, amount, options);
  }

  /**
   * Approve withdrawal with validation
   */
  async approveWithdrawalAfterDelay(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.secureOwnable.getOperation(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < Number(operation.releaseTime)) {
      throw new Error("Current time is before release time");
    }

    return this.vault.approveWithdrawalAfterDelay(BigInt(txId), options);
  }

  /**
   * Cancel withdrawal with validation
   */
  async cancelWithdrawal(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.secureOwnable.getOperation(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    const timeLockPeriod = await this.secureOwnable.getTimeLockPeriodInMinutes();
    const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
    if (currentTimestamp < operation.releaseTime - (BigInt(timeLockPeriod) * 24n * 60n * 60n) + 3600n) {
      throw new Error("Cannot cancel within first hour");
    }

    return this.vault.cancelWithdrawal(BigInt(txId), options);
  }

  /**
   * Approve withdrawal with meta-transaction
   */
  async approveWithdrawalWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.secureOwnable.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    return this.vault.approveWithdrawalWithMetaTx(metaTx, options);
  }

  /**
   * Gets a specific transaction's details
   */
  async getTransaction(txId: number): Promise<VaultTxRecord> {
    try {
      const tx = await this.secureOwnable.getOperation(BigInt(txId));
      if (!tx) throw new Error("Transaction not found");

      // Map the status directly from the transaction
      const status = tx.status;
      
      // Extract data from tx.params based on operation type
      let to: Address = '0x0000000000000000000000000000000000000000';
      let amount: bigint = BigInt(0);
      let token: Address | undefined = undefined;
      let type: "ETH" | "TOKEN" = "ETH";
      
      // Validate operation type exists
      const operationType = tx.params.operationType as Hex;
      const operationTypes = await this.getVaultOperationTypes();
      
      if (!operationTypes.has(operationType)) {
        throw new Error(`Unsupported operation type: ${operationType}`);
      }

      // Decode parameters based on operation type name
      const operationName = operationTypes.get(operationType);
      if (operationName === 'WITHDRAW_ETH') {
        type = "ETH";
        // For ETH withdrawals, params should contain 'to' and 'amount'
        to = tx.params.target as Address;
        amount = tx.params.value;
      } else if (operationName === 'WITHDRAW_TOKEN') {
        type = "TOKEN";
        // For token withdrawals, params should contain 'token', 'to', and 'amount'
        to = tx.params.target as Address;
        amount = tx.params.value;
        token = tx.params.target;
      }
      
      // Create a VaultTxRecord with the decoded information
      const vaultTx: VaultTxRecord = {
        ...tx,
        status,
        amount,
        to,
        type,
        token
      };
      
      return vaultTx;
    } catch (error) {
      console.error(`Error in getTransaction for txId ${txId}:`, error);
      throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all transactions from the operation history
   */
  async getOperationHistory(): Promise<TxRecord[]> {
    try {
      console.log("Reading operation history from contract...");
      const result = await this.secureOwnable.getOperationHistory();
      
      console.log("Raw operation history result:", result);
      
      // Ensure we have a valid array result
      if (!Array.isArray(result)) {
        console.error("Operation history is not an array:", result);
        return [];
      }
      
      // Convert and validate each record
      const records = result.map((record: any) => {
        // Ensure each record has the required fields
        if (!record || typeof record !== 'object') {
          console.warn("Invalid record in operation history:", record);
          return null;
        }
        
        try {
          // Ensure txId is a bigint
          const txId = typeof record.txId === 'bigint' ? record.txId : BigInt(record.txId || 0);
          
          return {
            ...record,
            txId,
            // Ensure other bigint fields are properly converted
            releaseTime: typeof record.releaseTime === 'bigint' ? record.releaseTime : BigInt(record.releaseTime || 0),
            value: typeof record.value === 'bigint' ? record.value : BigInt(record.value || 0),
            gasLimit: typeof record.gasLimit === 'bigint' ? record.gasLimit : BigInt(record.gasLimit || 0)
          } as TxRecord;
        } catch (error) {
          console.error("Error processing record:", error, record);
          return null;
        }
      }).filter((record): record is TxRecord => record !== null);
      
      return records;
    } catch (error) {
      console.error("Error fetching operation history:", error);
      return [];
    }
  }

  /**
   * Gets all pending transactions for the vault
   */
  async getPendingTransactions(): Promise<VaultTxRecord[]> {
    try {
      console.log("Fetching operation history...");
      const operations = await this.getOperationHistory();
      console.log("All operations count:", operations?.length || 0);
      
      // Ensure operations is an array before filtering
      if (!Array.isArray(operations)) {
        console.warn("Operations is not an array:", operations);
        return [];
      }
      
      // Filter for pending operations, with additional validation
      const pendingOps = operations.filter(op => {
        if (!op || typeof op !== 'object') return false;
        return op.status === TxStatus.PENDING;
      });
      
      console.log("Filtered pending operations count:", pendingOps.length);
      
      // Convert each pending operation to VaultTxRecord
      const pendingTxs: VaultTxRecord[] = [];
      
      for (const op of pendingOps) {
        try {
          // Ensure txId is a valid number
          if (op.txId === undefined || op.txId === null) {
            console.warn("Operation missing txId:", op);
            continue;
          }
          
          const txId = Number(op.txId);
          if (isNaN(txId)) {
            console.warn(`Invalid txId: ${op.txId}`);
            continue;
          }
          
          console.log(`Processing pending transaction with ID: ${txId}`);
          
          // Get transaction details with a timeout to prevent hanging
          const txPromise = this.getTransaction(txId);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Transaction ${txId} fetch timed out`)), 10000);
          });
          
          const tx = await Promise.race([txPromise, timeoutPromise]) as VaultTxRecord;
          pendingTxs.push(tx);
        } catch (error) {
          console.error("Error processing pending transaction:", error);
          // Continue with next transaction instead of failing the entire batch
        }
      }
      
      console.log("Final pending transactions count:", pendingTxs.length);
      return pendingTxs;
    } catch (error) {
      console.error("Error in getPendingTransactions:", error);
      // Return empty array instead of failing
      return [];
    }
  }

  /**
   * Gets the token metadata
   */
  async getTokenMetadata(token: Address): Promise<TokenMetadata> {
    const [name, symbol, decimals] = await Promise.all([
      this.client.readContract({
        address: token,
        abi: [
          { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        ],
        functionName: 'name'
      }) as Promise<string>,
      this.client.readContract({
        address: token,
        abi: [
          { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        ],
        functionName: 'symbol'
      }) as Promise<string>,
      this.client.readContract({
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
   * Check token allowance for the vault
   */
  async getTokenAllowance(token: Address, owner: Address): Promise<bigint> {
    const allowance = await this.client.readContract({
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
      args: [owner, this.contractAddress]
    }) as bigint;

    return allowance;
  }

  /**
   * Approve vault to spend tokens
   */
  async approveTokenAllowance(
    token: Address,
    amount: bigint,
    options: TransactionOptions
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
      args: [this.contractAddress, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * Revoke vault's permission to spend tokens
   */
  async revokeTokenAllowance(
    token: Address,
    options: TransactionOptions
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
      args: [this.contractAddress, BigInt(0)],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * Deposit ETH into the vault using direct wallet transfer
   */
  async depositEth(
    amount: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    // Send ETH directly to the vault contract
    const hash = await this.walletClient.sendTransaction({
      chain: this.chain,
      to: this.contractAddress,
      value: amount,
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * Deposit ERC20 tokens into the vault using safeTransfer
   */
  async depositToken(
    token: Address,
    amount: bigint,
    options: TransactionOptions
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
      args: [this.contractAddress, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * Gets a mapping of operation type hashes to names
   */
  async getVaultOperationTypes(): Promise<Map<Hex, string>> {
    const operations = await this.secureOwnable.getSupportedOperationTypes();
    return new Map(operations.map(op => [op.operationType as Hex, op.name]));
  }
}
