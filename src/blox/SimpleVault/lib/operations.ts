import { Address, Chain, Hex, PublicClient, WalletClient, keccak256, toHex } from 'viem';
import { TransactionOptions, TransactionResult } from '../../../particle-core/sdk/typescript/interfaces/base.index';
import { BaseBloxOperationsHandler } from '../../../types/BloxOperationsHandler';
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import { MultiPhaseOperationFunctions } from '../../../types/OperationRegistry';
import SimpleVault from '../SimpleVault';

/**
 * Helper function to compute keccak256 of a string and take first 4 bytes (function selector)
 */
const computeFunctionSelector = (signature: string): Hex => {
  return (toHex(keccak256(new TextEncoder().encode(signature))).slice(0, 10)) as Hex;
};

/**
 * Operation handler for SimpleVault Blox
 */
export default class SimpleVaultOperationsHandler extends BaseBloxOperationsHandler {
  // Operation type constants - use human-readable names
  static readonly WITHDRAW_ETH = "WITHDRAW_ETH";
  static readonly WITHDRAW_TOKEN = "WITHDRAW_TOKEN";
  
  // Function selectors for operations - computed explicitly
  static readonly FUNCTION_SELECTORS = {
    WITHDRAW_ETH: computeFunctionSelector("withdrawEthRequest(address,uint256)"),
    WITHDRAW_TOKEN: computeFunctionSelector("withdrawTokenRequest(address,address,uint256)"),
    APPROVE_WITHDRAWAL: computeFunctionSelector("approveWithdrawalAfterDelay(uint256)"),
    CANCEL_WITHDRAWAL: computeFunctionSelector("cancelWithdrawal(uint256)"),
    APPROVE_WITHDRAWAL_META_TX: computeFunctionSelector("approveWithdrawalWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
  } as const;

  // Store the wallet client for later use
  private walletClient?: WalletClient;
  private publicClient?: PublicClient;
  // Map to store operation type hashes by name
  private operationTypeMap: Map<string, Hex> = new Map();

  constructor() {
    super("simple-vault", ["SimpleVault"]);
  }

  /**
   * Register all operations for SimpleVault
   */
  async registerOperations(
    contract: SimpleVault,
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
    this.registerWithdrawEthOperation(contract);
    this.registerWithdrawTokenOperation(contract);
  }

  /**
   * Load operation types map from contract
   */
  private async loadOperationTypes(contract: SimpleVault): Promise<void> {
    try {
      // Get operation types from contract
      const operationTypes = await contract.getVaultOperationTypes();
      
      // Store inverse mapping (name -> hash)
      for (const [hash, name] of operationTypes.entries()) {
        if (name === SimpleVaultOperationsHandler.WITHDRAW_ETH || 
            name === SimpleVaultOperationsHandler.WITHDRAW_TOKEN) {
          this.operationTypeMap.set(name, hash);
        }
      }
      
      console.log(`Loaded ${this.operationTypeMap.size} operation types for SimpleVault`);
    } catch (error) {
      console.error('Failed to load operation types for SimpleVault:', error);
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
   * Register the WITHDRAW_ETH operation
   */
  private registerWithdrawEthOperation(contract: SimpleVault): void {
    // Define the functions for the withdraw ETH operation
    const functions: MultiPhaseOperationFunctions = {
      // Request phase
      request: async (params: { to: Address, amount: bigint }, options: TransactionOptions) => {
        return contract.withdrawEthRequest(params.to, params.amount, options);
      },
      
      // Approval phase
      approve: async (txId: bigint, options: TransactionOptions) => {
        return contract.approveWithdrawalAfterDelay(Number(txId), options);
      },
      
      approveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.approveWithdrawalWithMetaTx(metaTx, options);
      },
      
      // Cancellation phase
      cancel: async (txId: bigint, options: TransactionOptions) => {
        return contract.cancelWithdrawal(Number(txId), options);
      },
      
      cancelWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        // Implement this if available in the SimpleVault contract
        throw new Error("Cancel with meta-transaction not implemented");
      },
      
      // Meta-transaction preparation helpers
      prepareMetaTxApprove: async (txId: bigint, options: TransactionOptions) => {
        // This would be implemented to generate the signed meta-transaction
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
        const metaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedWithdrawalMetaTxApproval(
          txId,
          metaTxParams
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
        // Implement this if available in the SimpleVault contract
        throw new Error("Prepare meta-transaction cancel not implemented");
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(SimpleVaultOperationsHandler.WITHDRAW_ETH);
      
      // Register the operation
      this.registerMultiPhaseOperation(
        SimpleVaultOperationsHandler.WITHDRAW_ETH,
        operationTypeHash,
        "Withdraw ETH",
        "Withdraw ETH from the vault to a specified address",
        SimpleVaultOperationsHandler.FUNCTION_SELECTORS.WITHDRAW_ETH,
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
      console.error(`Failed to register WITHDRAW_ETH operation: ${error}`);
    }
  }

  /**
   * Register the WITHDRAW_TOKEN operation
   */
  private registerWithdrawTokenOperation(contract: SimpleVault): void {
    // Define the functions for the withdraw token operation
    const functions: MultiPhaseOperationFunctions = {
      // Request phase
      request: async (params: { token: Address, to: Address, amount: bigint }, options: TransactionOptions) => {
        return contract.withdrawTokenRequest(params.token, params.to, params.amount, options);
      },
      
      // Approval phase
      approve: async (txId: bigint, options: TransactionOptions) => {
        return contract.approveWithdrawalAfterDelay(Number(txId), options);
      },
      
      approveWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        return contract.approveWithdrawalWithMetaTx(metaTx, options);
      },
      
      // Cancellation phase
      cancel: async (txId: bigint, options: TransactionOptions) => {
        return contract.cancelWithdrawal(Number(txId), options);
      },
      
      cancelWithMetaTx: async (metaTx: MetaTransaction, options: TransactionOptions) => {
        // Implement this if available in the SimpleVault contract
        throw new Error("Cancel with meta-transaction not implemented");
      },
      
      // Meta-transaction preparation helpers
      prepareMetaTxApprove: async (txId: bigint, options: TransactionOptions) => {
        // This would be implemented to generate the signed meta-transaction
        if (!this.walletClient || !options.from) {
          throw new Error("Wallet client and sender address required");
        }
        
        const metaTxParams = {
          deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
          maxGasPrice: BigInt(0) // No max gas price
        };
        
        const unsignedMetaTx = await contract.generateUnsignedWithdrawalMetaTxApproval(
          txId,
          metaTxParams
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
        // Implement this if available in the SimpleVault contract
        throw new Error("Prepare meta-transaction cancel not implemented");
      }
    };
    
    try {
      // Get operation hash from name
      const operationTypeHash = this.getOperationTypeHash(SimpleVaultOperationsHandler.WITHDRAW_TOKEN);
      
      // Register the operation
      this.registerMultiPhaseOperation(
        SimpleVaultOperationsHandler.WITHDRAW_TOKEN,
        operationTypeHash,
        "Withdraw Token",
        "Withdraw ERC20 tokens from the vault to a specified address",
        SimpleVaultOperationsHandler.FUNCTION_SELECTORS.WITHDRAW_TOKEN,
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
      console.error(`Failed to register WITHDRAW_TOKEN operation: ${error}`);
    }
  }
} 