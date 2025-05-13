import { Address, Chain, Hex, PublicClient, WalletClient, keccak256, toHex } from 'viem';
import { TransactionOptions } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { BaseBloxOperationsHandler } from '../../../types/BloxOperationsHandler';
import { MetaTransaction, TxRecord } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { MultiPhaseOperationFunctions, SinglePhaseOperationFunctions } from '../../../types/OperationRegistry';
import SimpleRWA20 from '../SimpleRWA20';
import { TxStatus } from '../../../particle-core/sdk/typescript/types/lib.index';
import { SecureOwnable } from '../../../particle-core/sdk/typescript/SecureOwnable';
import { RWA20TxRecord, TokenMetaTxParams } from './types';
import { MetaTransactionManager } from '../../../services/MetaTransactionManager';

/**
 * Get meta transaction settings from local storage
 * @returns TokenMetaTxParams with stored or default settings
 */
export const getStoredMetaTxSettings = (): TokenMetaTxParams => {
  try {
    const stored = localStorage.getItem('simpleRWA20.metaTxSettings');
    if (!stored) return {
      deadline: BigInt(3600), // 1 hour in seconds
      maxGasPrice: BigInt(50000000000) // 50 gwei
    };
    
    const parsed = JSON.parse(stored);
    return {
      deadline: BigInt(parsed.deadline),
      maxGasPrice: BigInt(parsed.maxGasPrice)
    };
  } catch (error) {
    console.error('Failed to load meta tx settings:', error);
    return {
      deadline: BigInt(3600),
      maxGasPrice: BigInt(50000000000)
    };
  }
};

/**
 * Create TokenMetaTxParams with absolute deadline from settings
 * @param settings TokenMetaTxParams containing relative deadline
 * @returns TokenMetaTxParams with absolute deadline
 */
export const createRWA20MetaTxParams = (settings: TokenMetaTxParams): TokenMetaTxParams => {
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
  return (toHex(keccak256(new TextEncoder().encode(signature))).slice(0, 10)) as Hex;
};

/**
 * Operation handler for SimpleRWA20 Blox
 */
export default class SimpleRWA20OperationsHandler extends BaseBloxOperationsHandler {
  // Operation type constants - use human-readable names
  static readonly MINT_TOKENS = "MINT_TOKENS";
  static readonly BURN_TOKENS = "BURN_TOKENS";
  
  // Function selectors for operations - computed explicitly
  static readonly FUNCTION_SELECTORS = {
    MINT_TOKENS_META_TX: computeFunctionSelector("mintWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    BURN_TOKENS_META_TX: computeFunctionSelector("burnWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
  } as const;

  // Map to store operation type hashes by name
  private operationTypeMap: Map<string, Hex> = new Map();

  constructor() {
    super("simple-rwa20", ["SimpleRWA20"]);
  }

  /**
   * Register all operations for SimpleRWA20
   */
  async registerOperations(
    contract: SimpleRWA20,
    contractAddress: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    chain?: Chain,
    storeTransaction?: (txId: string, signedData: string, metadata?: Record<string, any>) => void
  ): Promise<void> {
    // Initialize the handler
    this.initialize(contract, contractAddress, publicClient, walletClient, chain);
    this.storeTransaction = storeTransaction;
    
    // Load operation types
    await this.loadOperationTypes();
    
    // Register operations
    this.registerMintTokensOperation(contract);
    this.registerBurnTokensOperation(contract);
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
      const types = await secureOwnable.getSupportedOperationTypes();
      
      // Create a map of operation names to operation type hashes
      types.forEach(({ operationType, name }) => {
        const normalizedName = name.toUpperCase().replace(/\s/g, '_');
        this.operationTypeMap.set(normalizedName, operationType as Hex);
      });
      
      // Validate that all required operation types are available
      const requiredTypes = [
        SimpleRWA20OperationsHandler.MINT_TOKENS,
        SimpleRWA20OperationsHandler.BURN_TOKENS
      ];
      
      const missingTypes = requiredTypes.filter(type => !this.operationTypeMap.has(type));
      if (missingTypes.length > 0) {
        console.warn(`Some required operation types are missing from contract: ${missingTypes.join(', ')}`);
        
        // Attempt to find close matches by name similarity
        types.forEach(({ operationType, name }) => {
          for (const missingType of missingTypes) {
            // Check if the contract-provided name contains parts of our expected names
            if (name.toUpperCase().includes(missingType.replace(/_/g, ' ')) || 
                missingType.includes(name.toUpperCase().replace(/\s/g, '_'))) {
              console.log(`Using "${name}" (${operationType}) for "${missingType}"`);
              this.operationTypeMap.set(missingType, operationType as Hex);
            }
          }
        });
      }
      
      console.log(`Loaded ${this.operationTypeMap.size} operation types for SimpleRWA20`);
    } catch (error) {
      console.error('Failed to load operation types for SimpleRWA20:', error);
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
   * Register the MINT_TOKENS operation
   */
  private registerMintTokensOperation(contract: SimpleRWA20): void {
    // Define the functions for the mint tokens operation
    const functions: SinglePhaseOperationFunctions = {
      // For mint, we only have the meta transaction function, as minting is single-phase
      requestAndApproveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        if (!this.walletClient?.account) {
          throw new Error("Wallet not connected");
        }
        return contract.mintWithMetaTx(metaTx, { from: this.walletClient.account.address });
      },
      
      // Required by SinglePhaseOperationFunctions
      getExecutionOptions: async (params: { to: Address, amount: bigint }) => {
        return '0x' as `0x${string}`;
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(SimpleRWA20OperationsHandler.MINT_TOKENS);
      
      // Register the operation as single-phase
      this.registerSinglePhaseOperation(
        SimpleRWA20OperationsHandler.MINT_TOKENS,
        operationTypeHash,
        "MINT_TOKENS",
        "Mint tokens to a specified address",
        SimpleRWA20OperationsHandler.FUNCTION_SELECTORS.MINT_TOKENS_META_TX,
        functions,
        {
          request: 'owner'
        }
      );
    } catch (error) {
      console.error(`Failed to register MINT_TOKENS operation: ${error}`);
    }
  }

  /**
   * Register the BURN_TOKENS operation
   */
  private registerBurnTokensOperation(contract: SimpleRWA20): void {
    // Define the functions for the burn tokens operation
    const functions: SinglePhaseOperationFunctions = {
      // For burn, we only have the meta transaction function, as burning is single-phase
      requestAndApproveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        if (!this.walletClient?.account) {
          throw new Error("Wallet not connected");
        }
        return contract.burnWithMetaTx(metaTx, { from: this.walletClient.account.address });
      },
      
      // Required by SinglePhaseOperationFunctions
      getExecutionOptions: async (params: { from: Address, amount: bigint }) => {
        return '0x' as `0x${string}`;
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(SimpleRWA20OperationsHandler.BURN_TOKENS);
      
      // Register the operation as single-phase
      this.registerSinglePhaseOperation(
        SimpleRWA20OperationsHandler.BURN_TOKENS,
        operationTypeHash,
        "BURN_TOKENS",
        "Burn tokens from a specified address",
        SimpleRWA20OperationsHandler.FUNCTION_SELECTORS.BURN_TOKENS_META_TX,
        functions,
        {
          request: 'owner'
        }
      );
    } catch (error) {
      console.error(`Failed to register BURN_TOKENS operation: ${error}`);
    }
  }

  /**
   * Handler for approval actions - Required by BaseBloxOperationsHandler
   * Not applicable for RWA20 tokens, but must be implemented
   */
  async handleApprove(txId: number): Promise<void> {
    throw new Error("Direct approval not applicable for SimpleRWA20. Use mint or burn operations instead.");
  }

  /**
   * Handler for cancellation actions - Required by BaseBloxOperationsHandler
   * Not applicable for RWA20 tokens, but must be implemented
   */
  async handleCancel(txId: number): Promise<void> {
    throw new Error("Direct cancellation not applicable for SimpleRWA20. Use mint or burn operations instead.");
  }

  /**
   * Handle meta-transaction signing - This is our custom implementation for SimpleRWA20
   * Uses different type parameters than the base class
   */
  async handleRWA20MetaTxSign(tx: TxRecord, type: 'mint' | 'burn'): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as SimpleRWA20;
    
    // Get stored settings and create meta tx params
    const storedSettings = getStoredMetaTxSettings();
    const metaTxParams = createRWA20MetaTxParams(storedSettings);
    
    let unsignedMetaTx;
    
    // Parameters for the meta-transaction
    if (type === 'mint') {
      // Parameters for minting
      const to = tx.params.target as Address;
      const amount = BigInt(tx.params.value);
      
      // Generate unsigned meta-transaction
      unsignedMetaTx = await contract.generateUnsignedMintMetaTx(
        to,
        amount,
        metaTxParams
      );
    } else {
      // Parameters for burning
      const from = tx.params.target as Address;
      const amount = BigInt(tx.params.value);
      
      // Generate unsigned meta-transaction
      unsignedMetaTx = await contract.generateUnsignedBurnMetaTx(
        from,
        amount,
        metaTxParams
      );
    }
    
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

    // Convert BigInt values to strings recursively
    const serializableMetaTx = JSON.parse(
      JSON.stringify(signedMetaTx, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    // Store the transaction if storeTransaction is provided
    if (this.storeTransaction) {
      // Get operation name for the transaction type
      const operationName = type === 'mint' ? 'MINT_TOKENS' : 'BURN_TOKENS';
      
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
   * Implementation of required handleMetaTxSign method from base class
   * Maps to our custom RWA20 implementation with fixed parameters
   */
  async handleMetaTxSign(tx: TxRecord, type: 'approve' | 'cancel'): Promise<void> {
    // We adapt the base class interface to our token-specific implementation
    if (type === 'approve') {
      await this.handleRWA20MetaTxSign(tx, 'mint');
    } else {
      await this.handleRWA20MetaTxSign(tx, 'burn');
    }
  }

  /**
   * Handle RWA20-specific meta-transaction broadcasting
   */
  async handleRWA20Broadcast(tx: TxRecord, type: 'mint' | 'burn'): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as SimpleRWA20;
    
    // Get the stored transaction data
    const txId = tx.txId.toString();
    
    // Get the stored transaction from localStorage
    const storedTxKey = `dapp_signed_transactions`;
    const storedData = localStorage.getItem(storedTxKey);
    
    if (!storedData) {
      throw new Error("No stored transactions found");
    }

    const parsedData = JSON.parse(storedData);
    const contractTransactions = parsedData[this.contractAddress];
    
    if (!contractTransactions || !contractTransactions[txId]) {
      throw new Error("No stored transaction found for this ID");
    }

    const storedTx = contractTransactions[txId];
    const signedMetaTx = JSON.parse(storedTx.signedData);

    // Broadcast the transaction
    let result;
    if (type === 'mint') {
      result = await contract.mintWithMetaTx(
        signedMetaTx,
        { from: this.walletClient.account.address }
      );
    } else {
      result = await contract.burnWithMetaTx(
        signedMetaTx,
        { from: this.walletClient.account.address }
      );
    }
    
    await result.wait();
  }

  /**
   * Implementation of required handleBroadcast method from base class
   * Maps to our custom RWA20 implementation with fixed parameters
   */
  async handleBroadcast(tx: TxRecord, type: 'approve' | 'cancel'): Promise<void> {
    if (!this.contract || !this.contractAddress || !this.walletClient?.account) {
      throw new Error("Contract not initialized");
    }

    const contract = this.contract as SimpleRWA20;
    
    // Get the stored transaction from localStorage
    const storedTxKey = `dapp_signed_transactions`;
    const storedData = localStorage.getItem(storedTxKey);
    
    if (!storedData) {
      throw new Error("No stored transactions found");
    }

    // Parse stored transactions
    const parsedData = JSON.parse(storedData);
    const contractTransactions = parsedData[this.contractAddress];
    
    if (!contractTransactions) {
      throw new Error("No transactions found for this contract");
    }

    // Find the transaction by operation type
    const txId = tx.txId.toString();
    const storedTx = contractTransactions[txId];
    
    if (!storedTx || !storedTx.signedData) {
      throw new Error("No signed transaction found");
    }

    // Parse the signed meta transaction
    const signedMetaTx = JSON.parse(storedTx.signedData);

    // For RWA20, we map approve/cancel to mint/burn
    const isMintOperation = type === 'approve';
    
    try {
      // Broadcast using the appropriate contract method
      const result = isMintOperation 
        ? await contract.mintWithMetaTx(signedMetaTx, { from: this.walletClient.account.address })
        : await contract.burnWithMetaTx(signedMetaTx, { from: this.walletClient.account.address });

      // Wait for confirmation
      await result.wait();

      // Remove the transaction after successful broadcast
      const txManager = new MetaTransactionManager();
      txManager.removeSignedTransaction(this.contractAddress, txId);
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  }

  /**
   * Convert a TxRecord to a RWA20TxRecord
   */
  convertRecord(record: TxRecord): RWA20TxRecord | null {
    try {
      const operationName = this.getOperationName(record);
      
      // Only convert if this is a mint or burn operation
      if (operationName !== 'MINT_TOKENS' && operationName !== 'BURN_TOKENS') {
        return null;
      }
      
      // Extract needed parameters from the transaction record
      const isMintOperation = operationName === 'MINT_TOKENS';
      
      // Type assertion for dynamic access to params
      const params = record.params as any;
      
      console.log('Full transaction params:', params);
      
      // The "to" address for mint or "from" address for burn is stored in params.target
      if (!params.target) {
        console.error('Missing "target" address in transaction params:', params);
        throw new Error('Missing "target" address in transaction params');
      }
      
      // The amount is stored in params.value
      if (params.value === undefined) {
        console.error('Missing "value" in transaction params:', params);
        throw new Error('Missing "value" in transaction params');
      }

      // Convert address and amount to appropriate types
      const targetAddress = params.target as `0x${string}`;
      const amountBigInt = BigInt(params.value);
      
      // Initial assignment of required 'to' field
      let toAddress: `0x${string}` = '0x0000000000000000000000000000000000000000';
      let fromAddress: `0x${string}` | undefined = undefined;
      
      // Set to/from based on operation type
      if (isMintOperation) {
        toAddress = targetAddress;
      } else {
        fromAddress = targetAddress;
      }
      
      // Create RWA20TxRecord with proper 'to' field
      const rwa20Tx: RWA20TxRecord = {
        ...record,
        status: record.status,
        amount: amountBigInt,
        to: toAddress,
        from: fromAddress,
        type: isMintOperation ? "MINT" : "BURN"
      };
      
      return rwa20Tx;
    } catch (error) {
      console.error('Error converting to RWA20TxRecord:', error);
      return null;
    }
  }
}
