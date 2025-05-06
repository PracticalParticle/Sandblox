import { Address, PublicClient, WalletClient, Chain, Abi, Hex } from 'viem';
import GuardianSafeABIJson from './GuardianSafe.abi.json';
import SecureOwnable from '../../particle-core/sdk/typescript/SecureOwnable';
import { TxRecord, MetaTransaction } from '../../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionOptions, TransactionResult } from '../../particle-core/sdk/typescript/interfaces/base.index';
import { TxStatus } from '../../particle-core/sdk/typescript/types/lib.index';
import { ContractValidations } from '../../particle-core/sdk/typescript/utils/validations';

// Parse and type the ABI
const GuardianSafeABI = GuardianSafeABIJson as Abi;

/**
 * Safe transaction structure matching the contract's SafeTx struct
 */
export interface SafeTx {
  to: Address;             // Destination address
  value: bigint;          // Ether value
  data: Hex;             // Data payload
  operation: number;     // Operation type (0=Call, 1=DelegateCall)
  safeTxGas: bigint;      // Gas for Safe transaction
  baseGas: bigint;        // Gas costs for data
  gasPrice: bigint;       // Maximum gas price
  gasToken: Address;      // Token for gas payment (0 for ETH)
  refundReceiver: Address;  // Refund receiver address
  signatures: Hex;       // Packed signature data
}

/**
 * Parameters for meta-transaction generation
 */
export interface SafeMetaTxParams {
  deadline: bigint;
  maxGasPrice: bigint;
}

/**
 * Transaction record with Safe transaction details
 */
export interface SafeTxRecord extends TxRecord {
  safeTx?: SafeTx;
  operationType: string;
}

/**
 * @title GuardianSafe
 * @notice TypeScript interface for GuardianSafe smart contract
 * @dev Extends SecureOwnable to provide secure wrapper for Safe wallet functionality
 */
export default class GuardianSafe extends SecureOwnable {
  protected validations: ContractValidations;
  // Constants for operation types
  static readonly EXEC_SAFE_TX = "EXEC_SAFE_TX";

  /**
   * @notice Creates a new GuardianSafe instance
   * @param client The viem PublicClient instance for blockchain interactions
   * @param walletClient Optional WalletClient for signing transactions
   * @param contractAddress The address of the contract
   * @param chain The chain object for the network
   */
  constructor(
    client: PublicClient,
    walletClient: WalletClient | undefined,
    contractAddress: Address,
    chain: Chain
  ) {
    super(client, walletClient, contractAddress, chain);
    this.validations = new ContractValidations(client);
  }

  /**
   * @notice Get the Safe contract address
   * @return The Safe contract address
   */
  async getSafeAddress(): Promise<Address> {
    try {
      // Read the Safe address from the contract
      // Note: This assumes the Safe address is exposed via a getter
      const result = await this.client.readContract({
        address: this.contractAddress,
        abi: GuardianSafeABI,
        functionName: 'safe'
      }) as Address;
      return result;
    } catch (error) {
      console.error("Error getting Safe address:", error);
      throw new Error("Failed to get Safe address");
    }
  }

  /**
   * @notice Check if delegated calls are enabled
   * @return Whether delegated calls are enabled
   */
  async isDelegatedCallEnabled(): Promise<boolean> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'delegatedCallEnabled'
    }) as boolean;
    return result;
  }

  /**
   * @notice Enable or disable delegated calls
   * @param enabled True to enable delegated calls, false to disable
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async setDelegatedCallEnabled(
    enabled: boolean,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'setDelegatedCallEnabled',
      args: [enabled],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Request execution of a Safe transaction with time-lock security
   * @param safeTx The Safe transaction parameters
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async requestTransaction(
    safeTx: SafeTx,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'requestTransaction',
      args: [safeTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve a pending transaction after timelock period
   * @param txId The transaction ID to approve
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveTransactionAfterDelay(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only approve pending requests");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp < Number(operation.releaseTime)) {
      throw new Error("Current time is before release time");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'approveTransactionAfterDelay',
      args: [BigInt(txId)],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancel a pending transaction
   * @param txId The transaction ID to cancel
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async cancelTransaction(
    txId: number,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const owner = await this.owner();
    await this.validations.validateRole(options.from, owner, "owner");

    const operation = await this.getOperation(BigInt(txId));
    if (operation.status !== TxStatus.PENDING) {
      throw new Error("Can only cancel pending requests");
    }

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'cancelTransaction',
      args: [BigInt(txId)],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve a pending transaction with meta transaction
   * @param metaTx Meta transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'approveTransactionWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancel a pending transaction with meta transaction
   * @param metaTx Meta transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async cancelTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'cancelTransactionWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Request and approve a Safe transaction in a single phase using meta-transaction
   * @param metaTx Meta transaction data
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async requestAndApproveTransactionWithMetaTx(
    metaTx: MetaTransaction,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const broadcaster = await this.getBroadcaster();
    await this.validations.validateBroadcaster(options.from.toLowerCase() as Address, broadcaster.toLowerCase() as Address);
    await this.validations.validateMetaTransaction(metaTx);

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'requestAndApproveTransactionWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Generate an unsigned meta-transaction for a new Safe transaction
   * @param safeTx The Safe transaction parameters
   * @param params Meta transaction parameters
   * @return The unsigned meta-transaction
   */
  async generateUnsignedSafeMetaTxForNew(
    safeTx: SafeTx,
    params: SafeMetaTxParams
  ): Promise<MetaTransaction> {
    // Validate safeTx
    if (!safeTx.to) throw new Error("Destination address required");
    
    // Call the contract method to generate the meta-transaction
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'generateUnsignedSafeMetaTxForNew',
      args: [safeTx, {
        deadline: params.deadline,
        maxGasPrice: params.maxGasPrice
      }]
    }) as MetaTransaction;
  }

  /**
   * @notice Generate an unsigned meta-transaction for an existing Safe transaction
   * @param txId The ID of the existing transaction
   * @param params Meta transaction parameters
   * @param isApproval Whether this is for approval (true) or cancellation (false)
   * @return The unsigned meta-transaction
   */
  async generateUnsignedSafeMetaTxForExisting(
    txId: number,
    params: SafeMetaTxParams,
    isApproval: boolean
  ): Promise<MetaTransaction> {
    // Call the contract method to generate the meta-transaction
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'generateUnsignedSafeMetaTxForExisting',
      args: [BigInt(txId), {
        deadline: params.deadline,
        maxGasPrice: params.maxGasPrice
      }, isApproval]
    }) as MetaTransaction;
  }

  /**
   * @notice Gets a specific transaction's details
   * @param txId Transaction ID
   * @return Safe transaction record with status
   */
  async getTransaction(txId: number): Promise<SafeTxRecord> {
    try {
      const tx = await this.getOperation(BigInt(txId));
      if (!tx) throw new Error("Transaction not found");

      // Map the status directly from the transaction
      const status = tx.status;
      
      // Parse the operation type to determine if it's a safe transaction
      let operationType = "";
      
      // Get operation types from contract
      const operationTypes = await this.getSafeOperationTypes();
      const txOperationType = tx.params.operationType as Hex;
      
      if (operationTypes.has(txOperationType)) {
        operationType = operationTypes.get(txOperationType) || "";
      } else {
        throw new Error(`Unknown operation type: ${txOperationType}`);
      }
      
      // Attempt to decode execution options to extract SafeTx details
      let safeTx: SafeTx | undefined = undefined;
      
      if (operationType === GuardianSafe.EXEC_SAFE_TX && tx.params.executionOptions) {
        try {
          // This would require more implementation to properly decode the execution options
          // and reconstruct the SafeTx from encoded data in the contract
          // For now, we just provide the basic information
          safeTx = {
            to: tx.params.target as Address,
            value: tx.params.value,
            data: '0x' as Hex,
            operation: 0,
            safeTxGas: tx.params.gasLimit || BigInt(0),
            baseGas: BigInt(0),
            gasPrice: BigInt(0),
            gasToken: '0x0000000000000000000000000000000000000000' as Address,
            refundReceiver: '0x0000000000000000000000000000000000000000' as Address,
            signatures: '0x' as Hex
          };
        } catch (error) {
          console.warn("Failed to decode SafeTx from execution options:", error);
        }
      }
      
      // Create a SafeTxRecord with the decoded information
      const safeTxRecord: SafeTxRecord = {
        ...tx,
        status,
        operationType,
        safeTx
      };
      
      return safeTxRecord;
    } catch (error) {
      console.error(`Error in getTransaction for txId ${txId}:`, error);
      throw new Error(`Failed to get transaction details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * @notice Gets all transactions for the safe
   * @return Array of safe transaction records
   */
  async getTransactions(): Promise<SafeTxRecord[]> {
    try {
      console.log("Reading operation history from contract...");
      const operations = await this.getOperationHistory();
      console.log("All operations count:", operations?.length || 0);
      
      // Ensure operations is an array before processing
      if (!Array.isArray(operations)) {
        console.warn("Operations is not an array:", operations);
        return [];
      }
      
      // Convert each operation to SafeTxRecord
      const safeTxs: SafeTxRecord[] = [];
      
      for (const op of operations) {
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
          
          // Get transaction details with a timeout to prevent hanging
          const txPromise = this.getTransaction(txId);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Transaction ${txId} fetch timed out`)), 10000);
          });
          
          const tx = await Promise.race([txPromise, timeoutPromise]) as SafeTxRecord;
          safeTxs.push(tx);
        } catch (error) {
          console.error("Error processing transaction:", error);
          // Continue with next transaction instead of failing the entire batch
        }
      }
      
      console.log("Final transactions count:", safeTxs.length);
      return safeTxs;
    } catch (error) {
      console.error("Error in getTransactions:", error);
      // Return empty array instead of failing
      return [];
    }
  }

  /**
   * @notice Gets all pending transactions for the safe
   * @return Array of pending safe transaction records
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
   * @notice Get safe operation types from the contract
   * @return Map of operation type hash to name
   */
  async getSafeOperationTypes(): Promise<Map<Hex, string>> {
    const operations = await this.getSupportedOperationTypes();
    return new Map(operations.map(op => [op.operationType, op.name]));
  }
}
