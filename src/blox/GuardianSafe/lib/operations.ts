import { Address, Chain, Hex, PublicClient, WalletClient, keccak256 } from 'viem';
import { TransactionOptions } from '../../../Guardian/sdk/typescript/interfaces/base.index';
import { BaseBloxOperationsHandler } from '../../../types/BloxOperationsHandler';
import { MetaTransaction, TxRecord } from '../../../Guardian/sdk/typescript/interfaces/lib.index';
import { MultiPhaseOperationFunctions, SinglePhaseOperationFunctions } from '../../../types/OperationRegistry';
import GuardianSafe, { SafeTx } from '../GuardianSafe';
import { SecureOwnable, OPERATION_TYPES } from '../../../Guardian/sdk/typescript';
import { SafeMetaTxParams, SafeTxRecord } from './types';
import { MetaTransactionManager } from '../../../services/MetaTransactionManager';

/**
 * Get meta transaction settings from local storage
 * @returns SafeMetaTxParams with stored or default settings
 */
export const getStoredMetaTxSettings = (): SafeMetaTxParams => {
  try {
    const stored = localStorage.getItem('guardianSafe.metaTxSettings');
    if (!stored) return {
      deadline: BigInt(3600), // 1 hour in seconds
      maxGasPrice: BigInt(50000000000) // 50 gwei default
    };
    
    const parsed = JSON.parse(stored);
    // Ensure maxGasPrice is at least 50 gwei
    const maxGasPrice = BigInt(parsed.maxGasPrice) < BigInt(50000000000) 
      ? BigInt(50000000000) 
      : BigInt(parsed.maxGasPrice);
    
    return {
      deadline: BigInt(parsed.deadline),
      maxGasPrice
    };
  } catch (error) {
    console.error('Failed to load meta tx settings:', error);
    return {
      deadline: BigInt(3600),
      maxGasPrice: BigInt(50000000000) // 50 gwei default
    };
  }
};

/**
 * Create SafeMetaTxParams with absolute deadline from settings
 * @param settings SafeMetaTxParams containing relative deadline
 * @returns SafeMetaTxParams with absolute deadline
 */
export const createSafeMetaTxParams = (settings: SafeMetaTxParams): SafeMetaTxParams => {
  // Get current timestamp in seconds
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  
  // Convert deadline from seconds to actual timestamp by adding to current time
  const deadlineTimestamp = currentTimestamp + BigInt(settings.deadline);
  
  return {
    deadline: deadlineTimestamp,
    maxGasPrice: settings.maxGasPrice
  };
};

/**
 * Helper function to compute keccak256 of a string and take first 4 bytes (function selector)
 */
const computeFunctionSelector = (signature: string): Hex => {
  const hash = keccak256(signature as `0x${string}`);
  return `0x${hash.slice(2, 10)}` as Hex;
};

/**
 * Operation handler for GuardianSafe Blox
 */
export default class GuardianSafeOperationsHandler extends BaseBloxOperationsHandler {
  // Operation type constants
  static readonly EXEC_SAFE_TX = "EXEC_SAFE_TX";
  
  // Function selectors for operations
  static readonly FUNCTION_SELECTORS = {
    REQUEST_TRANSACTION: computeFunctionSelector("requestTransaction((address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes))"),
    APPROVE_TRANSACTION: computeFunctionSelector("approveTransactionAfterDelay(uint256)"),
    CANCEL_TRANSACTION: computeFunctionSelector("cancelTransaction(uint256)"),
    APPROVE_TRANSACTION_META_TX: computeFunctionSelector("approveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    CANCEL_TRANSACTION_META_TX: computeFunctionSelector("cancelTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    REQUEST_APPROVE_META_TX: computeFunctionSelector("requestAndApproveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
  } as const;

  // Map to store operation type hashes by name
  private operationTypeMap: Map<string, Hex> = new Map();

  protected client!: PublicClient;

  constructor() {
    super("guardian-safe", ["GuardianSafe"]);
  }

  /**
   * Register all operations for GuardianSafe
   */
  async registerOperations(
    contract: GuardianSafe,
    contractAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    chain?: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, any>) => void
  ): Promise<void> {
    // Initialize the handler and set the client
    this.initialize(contract, contractAddress, publicClient, walletClient, chain);
    this.client = publicClient;
    this.storeTransaction = storeTransaction;
    
    // Load operation types
    await this.loadOperationTypes();
    
    // Register operations
    this.registerExecuteSafeTransactionOperation(contract);
    this.registerSinglePhaseExecuteSafeTransactionOperation(contract);
  }

  /**
   * Load operation types from contract
   */
  private async loadOperationTypes(): Promise<void> {
    try {
      if (!this.contractAddress || !this.publicClient) {
        throw new Error("Contract address or public client not available");
      }

      // Create an instance of SecureOwnable to access the contract's operation types
      if (!this.chain) {
        throw new Error("Chain information is required to load operation types");
      }

      const secureOwnable = new SecureOwnable(
        this.publicClient, 
        this.walletClient || undefined, 
        this.contractAddress, 
        this.chain
      );
      
      // Fetch operation types from the contract
      const operationTypeHashes = await secureOwnable.getSupportedOperationTypes();
      
      // Create a reverse mapping from hash to name
      const hashToNameMap = new Map<string, string>()
      Object.entries(OPERATION_TYPES).forEach(([name, hash]) => {
        hashToNameMap.set(hash.toLowerCase(), name)
      })
      
      // Create a map of operation names to operation type hashes
      operationTypeHashes.forEach((hash) => {
        const name = hashToNameMap.get(hash.toLowerCase())
        if (name) {
          const normalizedName = name.toUpperCase().replace(/\s/g, '_');
          this.operationTypeMap.set(normalizedName, hash as Hex);
        }
      });
      
      // Validate that the required operation type is available
      const requiredTypes = [
        GuardianSafeOperationsHandler.EXEC_SAFE_TX
      ];
      
      const missingTypes = requiredTypes.filter(type => !this.operationTypeMap.has(type));
      if (missingTypes.length > 0) {
        console.warn(`Some required operation types are missing from contract: ${missingTypes.join(', ')}`);
        
        // Attempt to find close matches by name similarity
        operationTypeHashes.forEach((hash) => {
          const name = hashToNameMap.get(hash.toLowerCase())
          if (name) {
            for (const missingType of missingTypes) {
            // Check if the contract-provided name contains parts of our expected names
            if (name.toUpperCase().includes(missingType.replace(/_/g, ' ')) || 
                missingType.includes(name.toUpperCase().replace(/\s/g, '_'))) {
              console.log(`Using "${name}" (${hash}) for "${missingType}"`);
              this.operationTypeMap.set(missingType, hash as Hex);
            }
          }
        }
        });
      }
      
      console.log(`Loaded ${this.operationTypeMap.size} operation types for GuardianSafe`);
    } catch (error) {
      console.error('Failed to load operation types for GuardianSafe:', error);
      throw error;
    }
  }

  /**
   * Get operation type hash by name
   */
  private getOperationTypeHash(name: string): Hex {
    const hash = this.operationTypeMap.get(name);
    if (!hash) {
      throw new Error(`Operation type hash not found for name: ${name}`);
    }
    return hash;
  }

  /**
   * Register the multi-phase EXEC_SAFE_TX operation
   */
  private registerExecuteSafeTransactionOperation(contract: GuardianSafe): void {
    // Define the functions for the execute safe transaction operation
    const functions: MultiPhaseOperationFunctions = {
      // Request phase
      request: async (params: { safeTx: SafeTx }, options: TransactionOptions) => {
        return contract.requestTransaction(params.safeTx, options);
      },
      
      // Approval phase
      approve: async (txId: bigint, options: TransactionOptions) => {
        return contract.approveTransactionAfterDelay(txId, options);
      },
      
      approveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.approveTransactionWithMetaTx(metaTx, options);
      },
      
      // Cancellation phase
      cancel: async (txId: bigint, options: TransactionOptions) => {
        return contract.cancelTransaction(txId, options);
      },
      
      cancelWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.cancelTransactionWithMetaTx(metaTx, options);
      },
      
      // Meta-transaction preparation helpers
      prepareMetaTxApprove: async (txId: bigint, options: TransactionOptions) => {
        // This would be implemented to generate the signed meta-transaction
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
        // Get stored settings and create meta tx params
        const storedSettings = getStoredMetaTxSettings();
        const metaTxParams = createSafeMetaTxParams(storedSettings);
        
        const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForExisting(
          txId,
          metaTxParams,
          true // isApproval = true
        );
        
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
        
        return JSON.stringify(signedMetaTx);
      },
      
      prepareMetaTxCancel: async (txId: bigint, options: TransactionOptions) => {
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
        // Get stored settings and create meta tx params
        const storedSettings = getStoredMetaTxSettings();
        const metaTxParams = createSafeMetaTxParams(storedSettings);
        
        const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForExisting(
          txId,
          metaTxParams,
          false // isApproval = false
        );
        
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
        
        return JSON.stringify(signedMetaTx);
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(GuardianSafeOperationsHandler.EXEC_SAFE_TX);
      
      // Register the operation
      this.registerMultiPhaseOperation(
        GuardianSafeOperationsHandler.EXEC_SAFE_TX,
        operationTypeHash,
        "EXEC_SAFE_TX",
        "Execute a transaction through the Safe",
        GuardianSafeOperationsHandler.FUNCTION_SELECTORS.REQUEST_TRANSACTION,
        functions,
        {
          request: 'owner',
          approve: 'owner',
          cancel: 'owner',
          metaApprove: 'owner',
          metaCancel: 'owner'
        }
      );
    } catch (error) {
      console.error(`Failed to register EXEC_SAFE_TX operation: ${error}`);
    }
  }

  /**
   * Register the single-phase EXEC_SAFE_TX operation (request and approve in one step)
   */
  private registerSinglePhaseExecuteSafeTransactionOperation(contract: GuardianSafe): void {
    // Define the functions for the single-phase safe transaction operation
    const functions: SinglePhaseOperationFunctions = {
      // Request and approve in one step with meta transaction
      requestAndApproveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        if (!this.walletClient?.account) {
          throw new Error("Wallet not connected");
        }
        return contract.requestAndApproveTransactionWithMetaTx(metaTx, options);
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(GuardianSafeOperationsHandler.EXEC_SAFE_TX);
      
      // Register the operation as single-phase
      this.registerSinglePhaseOperation(
        `${GuardianSafeOperationsHandler.EXEC_SAFE_TX}_SINGLE_PHASE`,
        operationTypeHash,
        "EXEC_SAFE_TX_SINGLE_PHASE",
        "Execute a transaction through the Safe in a single step",
        GuardianSafeOperationsHandler.FUNCTION_SELECTORS.REQUEST_APPROVE_META_TX,
        functions,
        {
          request: 'owner'
        }
      );
    } catch (error) {
      console.error(`Failed to register single-phase EXEC_SAFE_TX operation: ${error}`);
    }
  }

  /**
   * Handle approval of a transaction
   */
  async handleApprove(txId: number): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as GuardianSafe;
    const tx = await contract.approveTransactionAfterDelay(BigInt(txId), {
      from: this.walletClient.account.address
    });
    await tx.wait();
  }

  /**
   * Handle cancellation of a transaction
   */
  async handleCancel(txId: number): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as GuardianSafe;
    const tx = await contract.cancelTransaction(BigInt(txId), {
      from: this.walletClient.account.address
    });
    await tx.wait();
  }

  /**
   * Handle meta-transaction signing
   */
  async handleMetaTxSign(tx: TxRecord, type: 'approve' | 'cancel'): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as GuardianSafe;
    
    // Get stored settings and create meta tx params
    const storedSettings = getStoredMetaTxSettings();
    const metaTxParams = createSafeMetaTxParams(storedSettings);
    
    // Generate unsigned meta-transaction
    const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForExisting(
      BigInt(tx.txId),
      metaTxParams,
      type === 'approve' // isApproval is true for approve, false for cancel
    );
    
    // Get the message hash and sign it
    const messageHash = unsignedMetaTx.message;
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash as Hex },
      account: this.walletClient.account.address
    });

    // Create the complete signed meta transaction
    const signedMetaTx = {
      ...unsignedMetaTx,
      signature
    };

    // Convert BigInt values to strings recursively for serialization
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      // For approve/cancel meta transactions, always use the multi-phase operation name
      // This ensures we don't accidentally use the single-phase operation name
      const operationName = GuardianSafeOperationsHandler.EXEC_SAFE_TX;
      
      this.storeTransaction(
        tx.txId.toString(),
        JSON.stringify(serializableMetaTx),
        {
          type: operationName,
          timestamp: Date.now(),
          action: type,
          broadcasted: false,
          status: 'PENDING',
          operationType: tx.params.operationType,
          bloxId: this.bloxId
        }
      );
    }
  }

  /**
   * Handle creating and signing a new single-phase meta-transaction for a safe transaction
   */
  async handleSinglePhaseMetaTxSign(safeTx: SafeTx): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as GuardianSafe;
    
    // Get stored settings and create meta tx params
    const storedSettings = getStoredMetaTxSettings();
    const metaTxParams = createSafeMetaTxParams(storedSettings);
    
    // Generate unsigned meta-transaction for new transaction
    const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForNew(
      safeTx,
      metaTxParams
    );
    
    // Get the message hash and sign it
    const messageHash = unsignedMetaTx.message;
    const signature = await this.walletClient.signMessage({
      message: { raw: messageHash as Hex },
      account: this.walletClient.account.address
    });

    // Create the complete signed meta transaction
    const signedMetaTx = {
      ...unsignedMetaTx,
      signature
    };

    // Convert BigInt values to strings recursively for serialization
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    // Generate a temporary ID for the transaction
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      this.storeTransaction(
        tempId,
        JSON.stringify(serializableMetaTx),
        {
          type: GuardianSafeOperationsHandler.EXEC_SAFE_TX,
          timestamp: Date.now(),
          action: 'singlePhase',
          broadcasted: false,
          status: 'PENDING',
          operationType: this.getOperationTypeHash(GuardianSafeOperationsHandler.EXEC_SAFE_TX),
          bloxId: this.bloxId,
          safeTx
        }
      );
    }
  }

  /**
   * Handle meta-transaction broadcasting
   */
  async handleBroadcast(tx: TxRecord, type: 'approve' | 'cancel' | 'singlePhase'): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    if (!this.client) {
      throw new Error("Public client not initialized");
    }

    // Handle single-phase transactions differently
    if (type === 'singlePhase') {
      // For single-phase transactions, we need to find the stored transaction by txId
      const txId = tx.txId.toString();
      await this.handleSinglePhaseBroadcast(txId);
      return;
    }

    const contract = this.contract as GuardianSafe;
    
    // Get the stored transaction data
    const txId = tx.txId.toString();
    console.log(`Processing ${type} transaction #${txId}`);
    
    // Get the stored transaction from localStorage
    const storedTxKey = `dapp_signed_transactions`;
    const storedData = localStorage.getItem(storedTxKey);
    
    if (!storedData) {
      throw new Error("No stored transactions found");
    }

    const parsedData = JSON.parse(storedData);
    const contractTransactions = parsedData[this.contractAddress];
    
    if (!contractTransactions || !contractTransactions[txId]) {
      throw new Error(`No stored transaction found for ID: ${txId}`);
    }

    const storedTx = contractTransactions[txId];
    console.log(`Found stored transaction:`, storedTx);
    
    let signedMetaTx;
    
    try {
      // Parse the original signed data
      signedMetaTx = JSON.parse(storedTx.signedData);
      
      // Verify broadcaster role before proceeding
      console.log(`Verifying broadcaster role for ${this.walletClient.account.address}`);
      const secureOwnable = new SecureOwnable(
        this.client,
        this.walletClient,
        this.contractAddress,
        this.chain as Chain
      );
      
      // Get the broadcaster address from the contract
      const broadcasterAddress = await secureOwnable.getBroadcaster();
      console.log(`Contract broadcaster address: ${broadcasterAddress}`);
      
      // Check if current wallet is the broadcaster
      if (this.walletClient.account.address.toLowerCase() !== broadcasterAddress.toLowerCase()) {
        throw new Error(`Only the broadcaster can execute this transaction. Current account (${this.walletClient.account.address}) is not the broadcaster (${broadcasterAddress})`);
      }
      
      console.log(`Confirmed broadcaster role for account: ${this.walletClient.account.address}`);

      // Convert string values back to BigInts where needed
      const metaTxWithBigInts = {
        ...signedMetaTx,
        params: {
          ...signedMetaTx.params,
          chainId: BigInt(signedMetaTx.params.chainId),
          nonce: BigInt(signedMetaTx.params.nonce),
          deadline: BigInt(signedMetaTx.params.deadline),
          maxGasPrice: BigInt(signedMetaTx.params.maxGasPrice)
        }
      };

      // Set transaction options
      const transactionOptions = { 
        from: this.walletClient.account.address,
        chain: this.chain
      };
      
      // Execute the transaction through contract methods
      let result;
      if (type === 'approve') {
        console.log('Executing approveTransactionWithMetaTx...');
        result = await contract.approveTransactionWithMetaTx(
          metaTxWithBigInts,
          transactionOptions
        );
      } else {
        console.log('Executing cancelTransactionWithMetaTx...');
        result = await contract.cancelTransactionWithMetaTx(
          metaTxWithBigInts,
          transactionOptions
        );
      }
      
      console.log(`Transaction submitted: ${result.hash}`);
      
      // Wait for confirmation
      const receipt = await result.wait();
      console.log('Transaction receipt:', receipt);
      
      // Remove the transaction after successful broadcast
      if (this.storeTransaction) {
        console.log(`Removing transaction ${txId} from storage after successful broadcast`);
        const txManager = new MetaTransactionManager();
        txManager.removeSignedTransaction(this.contractAddress, txId);
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle broadcasting a single-phase meta-transaction
   */
  async handleSinglePhaseBroadcast(txId: string): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    if (!this.client) {
      throw new Error("Public client not initialized");
    }

    const contract = this.contract as GuardianSafe;
    
    // Get the stored transaction from localStorage
    const storedTxKey = `dapp_signed_transactions`;
    const storedData = localStorage.getItem(storedTxKey);
    
    if (!storedData) {
      throw new Error("No stored transactions found");
    }

    const parsedData = JSON.parse(storedData);
    const contractTransactions = parsedData[this.contractAddress];
    
    if (!contractTransactions || !contractTransactions[txId]) {
      throw new Error(`No stored transaction found for ID: ${txId}`);
    }

    const storedTx = contractTransactions[txId];
    console.log(`Found stored transaction:`, storedTx);
    
    try {
      // Parse the original signed data
      const signedMetaTx = JSON.parse(storedTx.signedData);
      
      // Verify broadcaster role before proceeding
      console.log(`Verifying broadcaster role for ${this.walletClient.account.address}`);
      const secureOwnable = new SecureOwnable(
        this.client,
        this.walletClient,
        this.contractAddress,
        this.chain as Chain
      );
      
      // Get the broadcaster address from the contract
      const broadcasterAddress = await secureOwnable.getBroadcaster();
      console.log(`Contract broadcaster address: ${broadcasterAddress}`);
      
      // Check if current wallet is the broadcaster
      if (this.walletClient.account.address.toLowerCase() !== broadcasterAddress.toLowerCase()) {
        throw new Error(`Only the broadcaster can execute this transaction. Current account (${this.walletClient.account.address}) is not the broadcaster (${broadcasterAddress})`);
      }
      
      // Convert string values back to BigInts where needed
      const metaTxWithBigInts = {
        ...signedMetaTx,
        params: {
          ...signedMetaTx.params,
          chainId: BigInt(signedMetaTx.params.chainId),
          nonce: BigInt(signedMetaTx.params.nonce),
          deadline: BigInt(signedMetaTx.params.deadline),
          maxGasPrice: BigInt(signedMetaTx.params.maxGasPrice)
        }
      };

      // Set transaction options
      const transactionOptions = { 
        from: this.walletClient.account.address,
        chain: this.chain
      };
      
      // Execute the transaction
      console.log('Executing requestAndApproveTransactionWithMetaTx...');
      const result = await contract.requestAndApproveTransactionWithMetaTx(
        metaTxWithBigInts,
        transactionOptions
      );
      
      console.log(`Transaction submitted: ${result.hash}`);
      
      // Wait for confirmation
      const receipt = await result.wait();
      console.log('Transaction receipt:', receipt);
      
      // Remove the transaction after successful broadcast
      if (this.storeTransaction) {
        console.log(`Removing transaction ${txId} from storage after successful broadcast`);
        const txManager = new MetaTransactionManager();
        txManager.removeSignedTransaction(this.contractAddress, txId);
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert a TxRecord to a SafeTxRecord
   */
  convertRecord(record: TxRecord): SafeTxRecord | null {
    try {
      const operationName = this.getOperationName(record);
      
      // Only convert if this is an execute safe transaction operation
      if (operationName !== GuardianSafeOperationsHandler.EXEC_SAFE_TX) {
        return null;
      }
      
      // Type assertion for dynamic access to params
      const params = record.params as any;
      
      console.log('Full transaction params:', params);
      
      // Extract necessary data from the parameters
      // This depends on how the execution options are stored in the transaction
      let safeTx: SafeTx | undefined;
      let to: Address;
      let value = BigInt(0);
      let operation = 0;
      let data: Hex | undefined;
      
      // Try to extract safe transaction data from execution options if available
      if (params.executionOptions) {
        try {      
          // If we have metadata in the record with the safeTx
          // Use type assertion to access potential metadata
          const recordWithMetadata = record as TxRecord & { metadata?: Record<string, any> };
          if (recordWithMetadata.metadata && recordWithMetadata.metadata.safeTx) {
            safeTx = recordWithMetadata.metadata.safeTx as SafeTx;
            to = safeTx.to;
            value = safeTx.value;
            operation = safeTx.operation;
            data = safeTx.data;
          } else {
            // Fall back to target and value from params
            to = params.target as Address;
            value = BigInt(params.value);
          }
        } catch (error) {
          console.error('Error parsing execution options:', error);
          // Fall back to target from params
          to = params.target as Address;
          value = BigInt(params.value);
        }
      } else {
        // Fall back to target from params
        to = params.target as Address;
        value = BigInt(params.value);
      }
      
      // Create SafeTxRecord
      const safeTxRecord: SafeTxRecord = {
        ...record,
        status: record.status,
        safeTx,
        to,
        value,
        operation,
        data,
        type: 'TRANSACTION',
        params: {
          ...params,
          operationType: record.params.operationType
        }
      };
      
      return safeTxRecord;
    } catch (error) {
      console.error('Error converting to SafeTxRecord:', error);
      return null;
    }
  }
}
