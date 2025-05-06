import { Address, Chain, Hex, PublicClient, WalletClient, keccak256, toHex } from 'viem';
import { TransactionOptions, TransactionResult } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { BaseBloxOperationsHandler } from '../../../types/BloxOperationsHandler';
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { MultiPhaseOperationFunctions, SinglePhaseOperationFunctions } from '../../../types/OperationRegistry';
import SimpleRWA20 from '../SimpleRWA20';

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
    MINT: computeFunctionSelector("mint(address,uint256)"),
    BURN: computeFunctionSelector("burn(address,uint256)"),
    MINT_WITH_META_TX: computeFunctionSelector("mintWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"),
    BURN_WITH_META_TX: computeFunctionSelector("burnWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
  } as const;

  // Store the wallet client for later use
  private walletClient?: WalletClient;
  private publicClient?: PublicClient;
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
    chain?: Chain
  ): Promise<void> {
    // Store client references
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    
    // Load operation types from contract
    await this.loadOperationTypes(contract);
    
    // Register operations
    this.registerMintOperation(contract);
    this.registerBurnOperation(contract);
  }

  /**
   * Load operation types map from contract
   */
  private async loadOperationTypes(contract: SimpleRWA20): Promise<void> {
    try {
      // Get operation types from contract
      const operationTypes = await contract.getTokenOperationTypes();
      
      // Store inverse mapping (name -> hash)
      for (const [hash, name] of operationTypes.entries()) {
        if (name === SimpleRWA20OperationsHandler.MINT_TOKENS || name === SimpleRWA20OperationsHandler.BURN_TOKENS) {
          this.operationTypeMap.set(name, hash);
        }
      }
      
      console.log(`Loaded ${this.operationTypeMap.size} operation types for SimpleRWA20`);
    } catch (error) {
      console.error('Failed to load operation types for SimpleRWA20:', error);
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
  private registerMintOperation(contract: SimpleRWA20): void {
    // Define the functions for the mint operation
    const functions: SinglePhaseOperationFunctions = {
      // Get execution options for meta-transaction
      getExecutionOptions: async (params: { to: Address, amount: bigint }) => {
        return "0x" as Hex; // This would be implemented to encode the parameters
      },
      
      // Combined request and approval with meta-transaction
      requestAndApproveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.mintWithMetaTx(metaTx, options);
      },
      
      // Meta-transaction preparation
      prepareMetaTx: async (params: { to: Address, amount: bigint }, options: TransactionOptions) => {
        const metaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedMintMetaTx(
          params.to,
          params.amount,
          metaTxParams
        );
        
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
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
      const operationTypeHash = this.getOperationTypeHash(SimpleRWA20OperationsHandler.MINT_TOKENS);
      
      // Register the operation
      this.registerSinglePhaseOperation(
        SimpleRWA20OperationsHandler.MINT_TOKENS,
        operationTypeHash,
        "Mint Tokens",
        "Mint new tokens to a specified address",
        SimpleRWA20OperationsHandler.FUNCTION_SELECTORS.MINT,
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
  private registerBurnOperation(contract: SimpleRWA20): void {
    // Define the functions for the burn operation
    const functions: SinglePhaseOperationFunctions = {
      // Get execution options for meta-transaction
      getExecutionOptions: async (params: { from: Address, amount: bigint }) => {
        return "0x" as Hex; // This would be implemented to encode the parameters
      },
      
      // Combined request and approval with meta-transaction
      requestAndApproveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.burnWithMetaTx(metaTx, options);
      },
      
      // Meta-transaction preparation
      prepareMetaTx: async (params: { from: Address, amount: bigint }, options: TransactionOptions) => {
        const metaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedBurnMetaTx(
          params.from,
          params.amount,
          metaTxParams
        );
        
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
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
      const operationTypeHash = this.getOperationTypeHash(SimpleRWA20OperationsHandler.BURN_TOKENS);
      
      // Register the operation
      this.registerSinglePhaseOperation(
        SimpleRWA20OperationsHandler.BURN_TOKENS,
        operationTypeHash,
        "Burn Tokens",
        "Burn tokens from a specified address",
        SimpleRWA20OperationsHandler.FUNCTION_SELECTORS.BURN,
        functions,
        {
          request: 'owner'
        }
      );
    } catch (error) {
      console.error(`Failed to register BURN_TOKENS operation: ${error}`);
    }
  }
} 