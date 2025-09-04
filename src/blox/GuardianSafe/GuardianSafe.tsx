import { Address, PublicClient, WalletClient, Chain, Abi } from 'viem';
import GuardianSafeABIJson from './GuardianSafe.abi.json';
import { MetaTransaction } from '../../Guardian/sdk/typescript/interfaces/lib.index';
import { TransactionOptions, TransactionResult } from '../../Guardian/sdk/typescript/interfaces/base.index';

// Parse and type the ABI
const GuardianSafeABI = GuardianSafeABIJson as Abi;

/**
 * Safe transaction structure
 */
export interface SafeTx {
  to: Address;
  value: bigint;
  data: `0x${string}`;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  signatures: `0x${string}`;
}

/**
 * Parameters for meta-transaction generation
 */
export interface SafeMetaTxParams {
  deadline: bigint;
  maxGasPrice: bigint;
}

/**
 * @title GuardianSafe
 * @notice TypeScript interface for GuardianSafe smart contract
 * @dev Pure SDK interface that maps directly to GuardianSafe.sol contract methods
 */
export default class GuardianSafe {
  protected client: PublicClient;
  protected walletClient?: WalletClient;
  protected contractAddress: Address;
  protected chain: Chain;

  // Constants reflecting the Solidity contract
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
    this.client = client;
    this.walletClient = walletClient;
    this.contractAddress = contractAddress;
    this.chain = chain;
  }

  /**
   * @notice Gets the Safe contract address
   * @return The Safe contract address
   */
  async getSafeAddress(): Promise<Address> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'getSafeAddress'
    }) as Address;
  }

  /**
   * @notice Gets whether delegated calls are enabled
   * @return True if delegated calls are enabled, false otherwise
   */
  async delegatedCallEnabled(): Promise<boolean> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'delegatedCallEnabled'
    }) as boolean;
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


    try {
      const hash = await this.walletClient.writeContract({
        chain: this.chain,
        address: this.contractAddress,
        abi: GuardianSafeABI,
        functionName: 'requestTransaction',
        args: [safeTx],
        account: options.from
      });

      console.log('✅ Transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  /**
   * @notice Approve a pending transaction after timelock period
   * @param txId The transaction ID to approve
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveTransactionAfterDelay(
    txId: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'approveTransactionAfterDelay',
      args: [txId],
      account: options.from
    });

      console.log('✅ Transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
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

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'approveTransactionWithMetaTx',
      args: [metaTx],
      account: options.from
    });

      console.log('✅ Transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  /**
   * @notice Cancel a pending transaction
   * @param txId The transaction ID to cancel
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async cancelTransaction(
    txId: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'cancelTransaction',
      args: [txId],
      account: options.from
    });

      console.log('✅ Meta-transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Meta-transaction failed:', error);
      throw error;
    }
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

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'cancelTransactionWithMetaTx',
      args: [metaTx],
      account: options.from
    });

      console.log('✅ Meta-transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Meta-transaction failed:', error);
      throw error;
    }
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

    try {
      const hash = await this.walletClient.writeContract({
        chain: this.chain,
        address: this.contractAddress,
        abi: GuardianSafeABI,
        functionName: 'requestAndApproveTransactionWithMetaTx',
        args: [metaTx],
        account: options.from
      });

      console.log('✅ Meta-transaction submitted successfully:', hash);
      return {
        hash,
        wait: () => this.client.waitForTransactionReceipt({ hash })
      };
    } catch (error) {
      console.error('❌ Meta-transaction failed:', error);
      throw error;
    }
  }

  /**
   * @notice Generate an unsigned meta-transaction for a new Safe transaction
   * @param safeTx The Safe transaction parameters
   * @param metaTxParams Parameters for the meta-transaction
   * @return The unsigned meta-transaction
   */
  async generateUnsignedSafeMetaTxForNew(
    safeTx: SafeTx,
    metaTxParams: SafeMetaTxParams
  ): Promise<MetaTransaction> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'generateUnsignedSafeMetaTxForNew',
      args: [safeTx, {
        deadline: metaTxParams.deadline,
        maxGasPrice: metaTxParams.maxGasPrice
      }]
    }) as MetaTransaction;
  }

  /**
   * @notice Generate an unsigned meta-transaction for an existing Safe transaction
   * @param txId The ID of the existing transaction
   * @param metaTxParams Parameters for the meta-transaction
   * @param isApproval Whether this is for approval (true) or cancellation (false)
   * @return The unsigned meta-transaction
   */
  async generateUnsignedSafeMetaTxForExisting(
    txId: bigint,
    metaTxParams: SafeMetaTxParams,
    isApproval: boolean
  ): Promise<MetaTransaction> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'generateUnsignedSafeMetaTxForExisting',
      args: [txId, {
        deadline: metaTxParams.deadline,
        maxGasPrice: metaTxParams.maxGasPrice
      }, isApproval]
    }) as MetaTransaction;
  }

  /**
   * @notice Create execution options for a Safe transaction
   * @param safeTx The Safe transaction parameters
   * @return The execution options bytes
   */
  async createTransactionExecutionOptions(
    safeTx: SafeTx
  ): Promise<`0x${string}`> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: GuardianSafeABI,
      functionName: 'createTransactionExecutionOptions',
      args: [safeTx]
    }) as `0x${string}`;
  }
}
