import { Address, PublicClient, WalletClient, Chain, Abi } from 'viem';
import SimpleVaultABIJson from './SimpleVault.abi.json';
import { MetaTransaction } from '../../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionOptions, TransactionResult } from '../../particle-core/sdk/typescript/interfaces/base.index';

// Parse and type the ABI
const SimpleVaultABI = SimpleVaultABIJson as Abi;

/**
 * Parameters for meta-transaction generation
 */
export interface VaultMetaTxParams {
  deadline: bigint;
  maxGasPrice: bigint;
}

/**
 * @title SimpleVault
 * @notice TypeScript interface for SimpleVault smart contract
 * @dev Pure SDK interface that maps directly to SimpleVault.sol contract methods
 */
export default class SimpleVault {
  protected client: PublicClient;
  protected walletClient?: WalletClient;
  protected contractAddress: Address;
  protected chain: Chain;

  // Constants reflecting the Solidity contract
  static readonly WITHDRAW_ETH = "WITHDRAW_ETH";
  static readonly WITHDRAW_TOKEN = "WITHDRAW_TOKEN";

  /**
   * @notice Creates a new SimpleVault instance
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
   * @notice Gets the ETH balance of the vault
   * @return The ETH balance in wei
   */
  async getEthBalance(): Promise<bigint> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'getEthBalance'
    }) as bigint;
  }

  /**
   * @notice Gets the token balance of the vault
   * @param token The token contract address
   * @return The token balance
   */
  async getTokenBalance(token: Address): Promise<bigint> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'getTokenBalance',
      args: [token]
    }) as bigint;
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
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'withdrawEthRequest',
      args: [to, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
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
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'withdrawTokenRequest',
      args: [token, to, amount],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Approve a withdrawal after the time delay has passed
   * @param txId The ID of the withdrawal transaction to approve
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async approveWithdrawalAfterDelay(
    txId: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalAfterDelay',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Cancel a pending withdrawal request
   * @param txId The ID of the withdrawal transaction to cancel
   * @param options Transaction options
   * @return TransactionResult containing hash and wait function
   */
  async cancelWithdrawal(
    txId: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'cancelWithdrawal',
      args: [txId],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
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
    options: TransactionOptions
  ): Promise<TransactionResult> {
    if (!this.walletClient) throw new Error("WalletClient required for write operations");
    if (!options.from) throw new Error("Sender address required");

    const hash = await this.walletClient.writeContract({
      chain: this.chain,
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'approveWithdrawalWithMetaTx',
      args: [metaTx],
      account: options.from
    });

    return {
      hash,
      wait: () => this.client.waitForTransactionReceipt({ hash })
    };
  }

  /**
   * @notice Generate unsigned meta-transaction for withdrawal approval
   * @param txId Transaction ID of the withdrawal request
   * @param metaTxParams Parameters for the meta-transaction
   */
  async generateUnsignedWithdrawalMetaTxApproval(
    txId: bigint,
    metaTxParams: VaultMetaTxParams
  ): Promise<MetaTransaction> {
    return await this.client.readContract({
      address: this.contractAddress,
      abi: SimpleVaultABI,
      functionName: 'generateUnsignedWithdrawalMetaTxApproval',
      args: [txId, {
        deadline: metaTxParams.deadline,
        maxGasPrice: metaTxParams.maxGasPrice
      }]
    }) as MetaTransaction;
  }
}
