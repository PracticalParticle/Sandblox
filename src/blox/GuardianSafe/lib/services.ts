import { Address, PublicClient, WalletClient, Chain, Hex } from 'viem';
import { TransactionOptions, TransactionResult, TxRecord, MetaTransaction, TxStatus, SecureOwnable, OPERATION_TYPES } from '../../../Guardian/sdk/typescript';
import { ContractValidations } from '../../../Guardian/sdk/typescript/utils/validations';
import GuardianSafe, { SafeTx, SafeMetaTxParams } from '../GuardianSafe';
import { SafeTxRecord, EnhancedSafeTx } from './types';
// Using unified SDK export for SecureOwnable above

// Storage key for meta tx settings
const META_TX_SETTINGS_KEY = 'guardianSafe.metaTxSettings';

// Default values for meta tx settings
const DEFAULT_META_TX_SETTINGS: SafeMetaTxParams = {
  deadline: BigInt(3600), // 1 hour in seconds
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

/**
 * Services class providing business logic for GuardianSafe operations
 */
export class GuardianSafeService {
  private client: PublicClient;
  private walletClient?: WalletClient;
  private contractAddress: Address;
  private chain: Chain;
  private safe: GuardianSafe;
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
    this.safe = new GuardianSafe(this.client, this.walletClient, this.contractAddress, this.chain);
    this.validations = new ContractValidations(this.client);
    this.secureOwnable = new SecureOwnable(this.client, this.walletClient, this.contractAddress, this.chain);
  }

  /**
   * Get meta transaction settings from local storage
   * @returns SafeMetaTxParams with stored or default settings
   */
  getStoredMetaTxSettings(): SafeMetaTxParams {
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
   * Create SafeMetaTxParams with absolute deadline from settings
   * @param settings SafeMetaTxParams containing relative deadline
   * @returns SafeMetaTxParams with absolute deadline
   */
  createSafeMetaTxParams(settings: SafeMetaTxParams): SafeMetaTxParams {
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
   * @param settings SafeMetaTxParams to store
   */
  storeMetaTxSettings(settings: SafeMetaTxParams): void {
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
   * Get the address of the underlying Safe contract
   */
  async getSafeAddress(): Promise<Address> {
    return this.safe.getSafeAddress();
  }

  /**
   * Check if delegated calls are enabled
   */
  async isDelegatedCallEnabled(): Promise<boolean> {
    return this.safe.delegatedCallEnabled();
  }

  /**
   * Enable or disable delegated calls with validation
   */
  async setDelegatedCallEnabled(
    enabled: boolean,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    return this.safe.setDelegatedCallEnabled(enabled, options);
  }

  /**
   * Request execution of a Safe transaction with validation
   */
  async requestTransaction(
    safeTx: SafeTx,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    // Validate safe transaction parameters
    if (!safeTx.to) throw new Error("Transaction destination address required");
    
    // Check if the operation is a delegateCall and if it's enabled
    if (safeTx.operation === 1) {
      const delegatedCallEnabled = await this.isDelegatedCallEnabled();
      if (!delegatedCallEnabled) {
        throw new Error("Delegated calls are not enabled");
      }
    }

    return this.safe.requestTransaction(safeTx, options);
  }

  /**
   * Approve a pending transaction after timelock with validation
   */
  async approveTransactionAfterDelay(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.secureOwnable.getTransaction(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < Number(operation.releaseTime)) {
      throw new Error("Current time is before release time");
    }

    return this.safe.approveTransactionAfterDelay(BigInt(txId), options);
  }

  /**
   * Cancel a pending transaction with validation
   */
  async cancelTransaction(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.secureOwnable.getTransaction(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    return this.safe.cancelTransaction(BigInt(txId), options);
  }

  /**
   * Approve a transaction with meta-transaction
   */
  async approveTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.secureOwnable.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    return this.safe.approveTransactionWithMetaTx(metaTx, options);
  }

  /**
   * Cancel a transaction with meta-transaction
   */
  async cancelTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.secureOwnable.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    return this.safe.cancelTransactionWithMetaTx(metaTx, options);
  }

  /**
   * Request and approve a transaction in a single step with meta-transaction
   */
  async requestAndApproveTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.secureOwnable.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    return this.safe.requestAndApproveTransactionWithMetaTx(metaTx, options);
  }

  /**
   * Generate signed meta-transaction for approving an existing transaction
   */
  async generateSignedApproveMetaTx(
    txId: number,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    // Validate transaction exists and is pending
    const operation = await this.secureOwnable.getTransaction(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    // Note: Meta-transactions can be signed immediately after request phase
    // Time delay only applies to temporal (timelock) approvals
    // const currentTimestamp = Math.floor(Date.now() / 1000);
    // if (currentTimestamp < Number(operation.releaseTime)) {
    //   throw new Error("Current time is before release time");
    // }

    // Get stored settings and create meta tx params
    const storedSettings = this.getStoredMetaTxSettings();
    const metaTxParams = this.createSafeMetaTxParams(storedSettings);
    
    // Generate unsigned meta transaction
    const unsignedMetaTx = await this.safe.generateUnsignedSafeMetaTxForExisting(
      BigInt(txId),
      metaTxParams,
      true // isApproval = true
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
    
    // Convert BigInt values to strings recursively for JSON serialization
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );
    
    return JSON.stringify(serializableMetaTx);
  }

  /**
   * Generate signed meta-transaction for canceling an existing transaction
   */
  async generateSignedCancelMetaTx(
    txId: number,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    // Validate transaction exists and is pending
    const operation = await this.secureOwnable.getTransaction(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    // Get stored settings and create meta tx params
    const storedSettings = this.getStoredMetaTxSettings();
    const metaTxParams = this.createSafeMetaTxParams(storedSettings);
    
    // Generate unsigned meta transaction
    const unsignedMetaTx = await this.safe.generateUnsignedSafeMetaTxForExisting(
      BigInt(txId),
      metaTxParams,
      false // isApproval = false
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
    
    // Convert BigInt values to strings recursively for JSON serialization
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );
    
    return JSON.stringify(serializableMetaTx);
  }

  /**
   * Generate signed meta-transaction for a new transaction (single-phase)
   */
  async generateSignedNewTransactionMetaTx(
    safeTx: SafeTx,
    options: TransactionOptions
  ): Promise<string> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.secureOwnable.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    // Validate safe transaction parameters
    if (!safeTx.to) throw new Error("Transaction destination address required");
    
    // Check if the operation is a delegateCall and if it's enabled
    if (safeTx.operation === 1) {
      const delegatedCallEnabled = await this.isDelegatedCallEnabled();
      if (!delegatedCallEnabled) {
        throw new Error("Delegated calls are not enabled");
      }
    }

    // Get stored settings and create meta tx params
    const storedSettings = this.getStoredMetaTxSettings();
    const metaTxParams = this.createSafeMetaTxParams(storedSettings);
    
    // Generate unsigned meta transaction
    const unsignedMetaTx = await this.safe.generateUnsignedSafeMetaTxForNew(
      safeTx,
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
    
    // Convert BigInt values to strings recursively for JSON serialization
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );
    
    return JSON.stringify(serializableMetaTx);
  }

  /**
   * Gets a specific transaction's details
   */
  async getTransaction(txId: number): Promise<SafeTxRecord> {
    try {
      const tx = await this.secureOwnable.getTransaction(BigInt(txId));
      if (!tx) throw new Error("Transaction not found");

      // Map the status directly from the transaction
      const status = tx.status;
      
      // Extract data from tx.params based on operation type
      let to: Address = '0x0000000000000000000000000000000000000000';
      let value = BigInt(0);
      let operation = 0;
      let data: Hex | undefined = undefined;
      
      // Validate operation type exists
      const operationType = tx.params.operationType as Hex;
      const operationTypes = await this.getSafeOperationTypes();
      
      if (!operationTypes.has(operationType)) {
        throw new Error(`Unsupported operation type: ${operationType}`);
      }

      // Extract transaction details
      to = tx.params.target as Address;
      value = tx.params.value;
      
      // Try to extract operation and data from execution options
      if (tx.params.executionOptions) {
        try {
          // This is a simplified extraction - the actual implementation may need adjustment
          // based on how the data is encoded in the execution options
          // For now, we'll just use the target and value from the params
          
          // If possible, extract operation type and data here
          // This would depend on how the contract encodes this information
        } catch (error) {
          console.error('Error extracting execution options:', error);
        }
      }
      
      // Create a SafeTxRecord with the extracted information
      const safeTxRecord: SafeTxRecord = {
        ...tx,
        status,
        to,
        value,
        operation,
        data,
        type: 'TRANSACTION',
        params: {
          ...tx.params,
          operationType
        }
      };
      
      return safeTxRecord;
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
      console.log("Reading transaction history from contract...");
      const result = await this.secureOwnable.getTransactionHistory(BigInt(0), BigInt(100));
      
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
    } catch (error: any) {
      // Check if this is a revert error (function doesn't exist or contract doesn't support it)
      const errorMessage = error?.message || error?.shortMessage || String(error);
      const isRevertError = errorMessage.includes('revert') || 
                            errorMessage.includes('execution reverted') ||
                            error?.code === 'CALL_EXCEPTION';
      
      if (isRevertError) {
        // Contract function reverted - this is expected for some contracts
        console.log("ℹ️ getTransactionHistory() reverted (contract may not support this function or no history available)");
      } else {
        // Other errors (network issues, etc.) should be logged
        console.warn("⚠️ Error fetching operation history:", errorMessage);
      }
      return [];
    }
  }

  /**
   * Gets all pending transactions for the safe
   */
  async getPendingTransactions(): Promise<SafeTxRecord[]> {
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
      
      // Convert each pending operation to SafeTxRecord
      const pendingTxs: SafeTxRecord[] = [];
      
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
          
          const tx = await Promise.race([txPromise, timeoutPromise]) as SafeTxRecord;
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
   * Get all completed transactions
   */
  async getCompletedTransactions(): Promise<SafeTxRecord[]> {
    try {
      console.log("Fetching operation history...");
      const operations = await this.getOperationHistory();
      console.log("All operations count:", operations?.length || 0);
      
      // Ensure operations is an array before filtering
      if (!Array.isArray(operations)) {
        console.warn("Operations is not an array:", operations);
        return [];
      }
      
      // Filter for completed operations
      const completedOps = operations.filter(op => {
        if (!op || typeof op !== 'object') return false;
        return op.status === TxStatus.COMPLETED;
      });
      
      console.log("Filtered completed operations count:", completedOps.length);
      
      // Convert each completed operation to SafeTxRecord
      const completedTxs: SafeTxRecord[] = [];
      
      for (const op of completedOps) {
        try {
          const txId = Number(op.txId);
          if (isNaN(txId)) {
            console.warn(`Invalid txId: ${op.txId}`);
            continue;
          }
          
          console.log(`Processing completed transaction with ID: ${txId}`);
          
          // Get transaction details with a timeout
          const txPromise = this.getTransaction(txId);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Transaction ${txId} fetch timed out`)), 10000);
          });
          
          const tx = await Promise.race([txPromise, timeoutPromise]) as SafeTxRecord;
          completedTxs.push(tx);
        } catch (error) {
          console.error("Error processing completed transaction:", error);
          // Continue with next transaction
        }
      }
      
      return completedTxs;
    } catch (error) {
      console.error("Error in getCompletedTransactions:", error);
      return [];
    }
  }

  /**
   * Format a SafeTx object for display
   */
  formatSafeTxForDisplay(safeTx: SafeTx): EnhancedSafeTx {
    return {
      ...safeTx,
      description: this.generateTransactionDescription(safeTx)
    };
  }

  /**
   * Generate a human-readable description for a Safe transaction
   */
  private generateTransactionDescription(safeTx: SafeTx): string {
    if (!safeTx) return "Unknown transaction";
    
    const operationType = safeTx.operation === 0 ? "Call" : "DelegateCall";
    const valueEth = Number(safeTx.value) / 1e18;
    
    let description = `${operationType} to ${safeTx.to}`;
    
    if (safeTx.value > 0) {
      description += ` with ${valueEth} ETH`;
    }
    
    if (safeTx.data && safeTx.data.length > 2) {
      description += " with data";
    }
    
    return description;
  }

  /**
   * Gets a mapping of operation type hashes to names
   */
  async getSafeOperationTypes(): Promise<Map<Hex, string>> {
    const operationTypeHashes = await this.secureOwnable.getSupportedOperationTypes();
    
    // Create a reverse mapping from hash to name
    const hashToNameMap = new Map<string, string>()
    Object.entries(OPERATION_TYPES).forEach(([name, hash]) => {
      hashToNameMap.set(hash.toLowerCase(), name)
    })
    
    const result = new Map<Hex, string>()
    operationTypeHashes.forEach((hash) => {
      const name = hashToNameMap.get(hash.toLowerCase())
      if (name) {
        result.set(hash as Hex, name)
      }
    })
    
    return result
  }
}
