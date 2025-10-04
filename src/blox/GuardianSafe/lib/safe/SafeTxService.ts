import { PublicClient, Address } from 'viem';
import Safe from '@safe-global/protocol-kit';

/**
 * Safe Transaction Service API response types
 */
export interface SafeTransactionServiceResponse {
  count: number;
  next?: string;
  previous?: string;
  results: SafeTransactionServiceTx[];
}

export interface SafeTransactionServiceTx {
  safe: string;
  to: string;
  value: string;
  data?: string;
  operation: number;
  gasToken?: string;
  safeTxGas?: string;
  baseGas?: string;
  gasPrice?: string;
  refundReceiver?: string;
  nonce: number;
  executionDate?: string;
  submissionDate: string;
  modified: string;
  blockNumber?: number;
  transactionHash?: string;
  safeTxHash: string;
  executor?: string;
  isExecuted: boolean;
  isSuccessful?: boolean;
  ethGasPrice?: string;
  gasUsed?: string;
  fee?: string;
  origin?: string;
  dataDecoded?: any;
  confirmationsRequired: number;
  confirmations?: SafeConfirmation[];
  signatures?: string;
  detailedExecutionInfo?: any;
}

export interface SafeConfirmation {
  owner: string;
  submissionDate: string;
  transactionHash?: string;
  signature: string;
  signatureType: string;
}

/**
 * Safe pending transaction interface
 */
export interface SafePendingTx {
  safeTxHash: string;
  to: Address;
  value: bigint;
  data: string;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: number;
  submissionDate: string;
  confirmationsRequired: number;
  confirmations: SafeConfirmation[];
  signatures: string;
  isExecuted: boolean;
  executor?: Address;
  blockNumber?: number;
  transactionHash?: string;
}

/**
 * Configuration for Safe Transaction Service
 */
export interface SafeTxServiceConfig {
  safeAddress: Address;
  chainId: number;
  rpcUrl?: string;
  safeTransactionServiceUrl?: string;
}

/**
 * Safe Transaction Service for fetching pending transactions and Safe information
 * Uses Safe Transaction Service API for transactions and Safe SDK for Safe info
 */
export class SafeTxService {
  private safeSdk: Safe | null = null;
  private safeAddress: Address;
  private chainId: number;
  private publicClient: PublicClient;
  private safeTransactionServiceUrl: string;

  constructor(config: SafeTxServiceConfig, publicClient: PublicClient) {
    this.safeAddress = config.safeAddress;
    this.chainId = config.chainId;
    this.publicClient = publicClient;
    
    // Set Safe Transaction Service URL based on chain
    this.safeTransactionServiceUrl = config.safeTransactionServiceUrl || this.getDefaultSafeTransactionServiceUrl();
  }

  /**
   * Get the default Safe Transaction Service URL based on chain ID
   */
  private getDefaultSafeTransactionServiceUrl(): string {
    switch (this.chainId) {
      case 1: // Mainnet
        return 'https://safe-transaction-mainnet.safe.global';
      case 5: // Goerli
        return 'https://safe-transaction-goerli.safe.global';
      case 10: // Optimism
        return 'https://safe-transaction-optimism.safe.global';
      case 137: // Polygon
        return 'https://safe-transaction-polygon.safe.global';
      case 42161: // Arbitrum
        return 'https://safe-transaction-arbitrum.safe.global';
      case 11155111: // Sepolia
        return 'https://safe-transaction-sepolia.safe.global';
      default:
        // For other chains, try to use the mainnet service as fallback
        return 'https://safe-transaction-mainnet.safe.global';
    }
  }

  /**
   * Initialize the Safe SDK (for Safe info and owner checks)
   */
  async init(): Promise<void> {
    try {
      const provider = this.publicClient.transport.url;
      console.log('🔗 Initializing Safe SDK with provider:', provider);
      
      this.safeSdk = await Safe.init({
        provider,
        safeAddress: this.safeAddress
      });

      console.log('✅ Safe SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Safe SDK:', error);
      // Don't throw error, we can still use the API for pending transactions and basic Safe info
    }
  }



  /**
   * Get pending transactions using Safe Transaction Service API
   */
  private async getPendingTransactionsFromAPI(): Promise<SafePendingTx[]> {
    try {
      console.log('🌐 Fetching pending transactions from Safe Transaction Service API...');
      
      const url = `${this.safeTransactionServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/?executed=false&limit=100`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Safe Transaction Service API error: ${response.status} ${response.statusText}`);
      }
      
      const data: SafeTransactionServiceResponse = await response.json();
      
      console.log(`📋 Found ${data.results.length} pending transactions via API`);
      
      return data.results.map((tx: SafeTransactionServiceTx) => this.mapAPITransactionToPendingTx(tx));
    } catch (error) {
      console.error('❌ Failed to fetch pending transactions from API:', error);
      throw error;
    }
  }

  /**
   * Get all pending transactions using Safe Transaction Service API
   */
  async getPendingTransactions(): Promise<SafePendingTx[]> {
    return await this.getPendingTransactionsFromAPI();
  }

  /**
   * Get transaction details by safeTxHash
   */
  async getTransactionDetails(safeTxHash: string): Promise<SafePendingTx | null> {
    try {
      // Try to get from API first as it provides more detailed information
      const url = `${this.safeTransactionServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction details: ${response.status}`);
      }
      
      const tx: SafeTransactionServiceTx = await response.json();
      
      return this.mapAPITransactionToPendingTx(tx);
    } catch (error) {
      console.error('Failed to get transaction details:', error);
      return null;
    }
  }



  /**
   * Map API transaction to our pending transaction format
   */
  private mapAPITransactionToPendingTx(apiTx: SafeTransactionServiceTx): SafePendingTx {
    return {
      safeTxHash: apiTx.safeTxHash,
      to: apiTx.to as Address,
      value: BigInt(apiTx.value || '0'),
      data: apiTx.data || '0x',
      operation: apiTx.operation || 0,
      safeTxGas: BigInt(apiTx.safeTxGas || '0'),
      baseGas: BigInt(apiTx.baseGas || '0'),
      gasPrice: BigInt(apiTx.gasPrice || '0'),
      gasToken: apiTx.gasToken as Address || '0x0000000000000000000000000000000000000000' as Address,
      refundReceiver: apiTx.refundReceiver as Address || '0x0000000000000000000000000000000000000000' as Address,
      nonce: apiTx.nonce || 0,
      submissionDate: apiTx.submissionDate || new Date().toISOString(),
      confirmationsRequired: apiTx.confirmationsRequired || 1,
      confirmations: apiTx.confirmations || [],
      signatures: apiTx.signatures || '0x',
      isExecuted: apiTx.isExecuted || false,
      executor: apiTx.executor as Address,
      blockNumber: apiTx.blockNumber,
      transactionHash: apiTx.transactionHash
    };
  }

  /**
   * Get Safe information (requires SDK initialization)
   */
  async getSafeInfo(): Promise<{
    address: Address;
    owners: Address[];
    threshold: number;
    nonce: number;
    version: string;
  }> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }

    try {
      const owners = await this.safeSdk.getOwners();
      const threshold = await this.safeSdk.getThreshold();
      const nonce = await this.safeSdk.getNonce();
      
      // Note: getVersion method doesn't exist in current Safe SDK
      const version = '1.0.0'; // Default version

      return {
        address: this.safeAddress,
        owners: owners as Address[],
        threshold,
        nonce,
        version
      };
    } catch (error) {
      console.error('Failed to get Safe info:', error);
      throw error;
    }
  }

  /**
   * Check if an address is an owner (requires SDK initialization)
   */
  async isOwner(address: Address): Promise<boolean> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }

    try {
      return await this.safeSdk.isOwner(address);
    } catch (error) {
      console.error('Failed to check if address is owner:', error);
      throw error;
    }
  }

  /**
   * Get current Safe nonce (requires SDK initialization)
   */
  async getNonce(): Promise<number> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }

    try {
      return await this.safeSdk.getNonce();
    } catch (error) {
      console.error('Failed to get Safe nonce:', error);
      throw error;
    }
  }
}
