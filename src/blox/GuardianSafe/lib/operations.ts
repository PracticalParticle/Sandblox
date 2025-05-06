import { Address, Chain, Hex, PublicClient, WalletClient, keccak256, toHex } from 'viem';
import { TransactionOptions, TransactionResult } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { BaseBloxOperationsHandler } from '../../../types/BloxOperationsHandler';
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { MultiPhaseOperationFunctions } from '../../../types/OperationRegistry';
import GuardianSafe, { SafeTx, SafeMetaTxParams } from '../GuardianSafe';

/**
 * Helper function to compute keccak256 of a string and take first 4 bytes (function selector)
 */
const computeFunctionSelector = (signature: string): Hex => {
  return (toHex(keccak256(new TextEncoder().encode(signature))).slice(0, 10)) as Hex;
};

/**
 * Operation handler for GuardianSafe Blox
 */
export default class GuardianSafeOperationsHandler extends BaseBloxOperationsHandler {
  // Operation type constants - use human-readable names
  static readonly EXEC_SAFE_TX = "EXEC_SAFE_TX";
  
  // Function selectors for operations - computed explicitly
  static readonly FUNCTION_SELECTORS = {
    REQUEST_TRANSACTION: computeFunctionSelector("requestTransaction((address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes))"),
    APPROVE_TRANSACTION: computeFunctionSelector("approveTransactionAfterDelay(uint256)"),
    CANCEL_TRANSACTION: computeFunctionSelector("cancelTransaction(uint256)"),
    APPROVE_TRANSACTION_META_TX: computeFunctionSelector("approveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    CANCEL_TRANSACTION_META_TX: computeFunctionSelector("cancelTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    REQUEST_AND_APPROVE_META_TX: computeFunctionSelector("requestAndApproveTransactionWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
  } as const;

  // Store the wallet client for later use
  private walletClient?: WalletClient;
  private publicClient?: PublicClient;
  // Map to store operation type hashes by name
  private operationTypeMap: Map<string, Hex> = new Map();
  // Store contract reference
  private contract?: GuardianSafe;

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
    chain?: Chain
  ): Promise<void> {
    // Store client references
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.contract = contract;
    
    // Load operation types from contract
    await this.loadOperationTypes(contract);
    
    // Register operations
    this.registerExecuteSafeTxOperation(contract);
  }

  /**
   * Load operation types map from contract
   */
  private async loadOperationTypes(contract: GuardianSafe): Promise<void> {
    try {
      // Get operation types from contract
      const operationTypes = await contract.getSafeOperationTypes();
      
      // Store inverse mapping (name -> hash)
      for (const [hash, name] of operationTypes.entries()) {
        if (name === GuardianSafeOperationsHandler.EXEC_SAFE_TX) {
          this.operationTypeMap.set(name, hash);
        }
      }
      
      console.log(`Loaded ${this.operationTypeMap.size} operation types for GuardianSafe`);
    } catch (error) {
      console.error('Failed to load operation types for GuardianSafe:', error);
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
   * Helper method to handle request and approve with meta-transaction 
   * This is separate from the operation functions since it's not in the standard interface
   */
  private async handleRequestAndApproveWithMetaTx(metaTx: MetaTransaction, options: TransactionOptions): Promise<TransactionResult> {
    const contract = this.getBloxContract();
    if (!contract) {
      throw new Error("Contract not initialized");
    }
    return await contract.requestAndApproveTransactionWithMetaTx(metaTx, options);
  }

  /**
   * Register the EXEC_SAFE_TX operation
   */
  private registerExecuteSafeTxOperation(contract: GuardianSafe): void {
    // Define the functions for the execute safe transaction operation
    const functions: MultiPhaseOperationFunctions = {
      // Request phase
      request: async (params: { safeTx: SafeTx }, options: TransactionOptions) => {
        return contract.requestTransaction(params.safeTx, options);
      },
      
      // Approval phase
      approve: async (txId: bigint, options: TransactionOptions) => {
        return contract.approveTransactionAfterDelay(Number(txId), options);
      },
      
      approveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.approveTransactionWithMetaTx(metaTx, options);
      },
      
      // Cancellation phase
      cancel: async (txId: bigint, options: TransactionOptions) => {
        return contract.cancelTransaction(Number(txId), options);
      },
      
      cancelWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.cancelTransactionWithMetaTx(metaTx, options);
      },
      
      // Meta-transaction preparation helpers
      prepareMetaTxApprove: async (txId: bigint, options: TransactionOptions) => {
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
        const metaTxParams: SafeMetaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForExisting(
          Number(txId),
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
        
        const metaTxParams: SafeMetaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedSafeMetaTxForExisting(
          Number(txId),
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
        "Execute Safe Transaction",
        "Submit, approve, and execute a transaction through the Guardian Safe",
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
   * Get typed contract instance
   */
  private getBloxContract(): GuardianSafe | undefined {
    return this.contract;
  }
}
