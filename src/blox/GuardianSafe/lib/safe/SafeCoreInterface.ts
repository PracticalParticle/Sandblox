import Safe from '@safe-global/protocol-kit';
import { Address, Chain, PublicClient, WalletClient } from 'viem';

/**
 * Configuration for Safe interface
 */
export interface SafeConfig {
  safeAddress: Address;
  chainId: number;
  rpcUrl?: string;
}

/**
 * Safe wallet owner information
 */
export interface SafeOwner {
  address: Address;
}

/**
 * Safe wallet information
 */
export interface SafeInfo {
  address: Address;
  owners: Address[];
  threshold: number;
  nonce: number;
  version: string;
}

/**
 * @title SafeCoreInterface
 * @notice Service for interacting with Safe wallets using the Safe Protocol Kit
 * @dev Provides a clean interface for Safe wallet operations
 */
export class SafeCoreInterface {
  private safeAddress: Address;
  private chainId: number;
  private rpcUrl: string;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient | undefined,
    config: SafeConfig
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.safeAddress = config.safeAddress;
    this.chainId = config.chainId;
    
    // Use provided RPC URL or extract from public client
    this.rpcUrl = config.rpcUrl || this.extractRpcUrl(publicClient);
  }

  /**
   * Extract RPC URL from PublicClient
   */
  private extractRpcUrl(client: PublicClient): string {
    // Try to extract RPC URL from the client's transport
    const transport = client.transport;
    
    if (transport && 'url' in transport) {
      return transport.url as string;
    }
    
    // Fallback to common RPC URLs based on chain ID
    switch (this.chainId) {
      case 1:
        return 'https://ethereum.publicnode.com';
      case 11155111:
        return 'https://ethereum-sepolia.publicnode.com';
      case 137:
        return 'https://polygon.publicnode.com';
      case 80002:
        return 'https://polygon-amoy.publicnode.com';
      default:
        // Use the chain's default RPC if available
        const chain = this.publicClient.chain;
        if (chain?.rpcUrls?.default?.http?.[0]) {
          return chain.rpcUrls.default.http[0];
        }
        throw new Error(`Unsupported chain ID: ${this.chainId}. Please provide an RPC URL in the config.`);
    }
  }

  /**
   * Create a Safe instance
   */
  private async createSafeInstance(): Promise<Safe> {
    // Initialize Safe instance with viem provider
    const safe = await Safe.init({
      provider: this.rpcUrl,
      signer: this.walletClient?.account?.address, // Optional signer for read-only operations
      safeAddress: this.safeAddress
    });

    return safe;
  }

  /**
   * Get the owners/signers of the Safe wallet
   * @returns Array of owner addresses
   */
  async getOwners(): Promise<Address[]> {
    try {
      const safe = await this.createSafeInstance();
      const owners = await safe.getOwners();
      
      return owners.map(owner => owner as Address);
    } catch (error) {
      console.error('Error getting Safe owners:', error);
      throw new Error(`Failed to get Safe owners: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get comprehensive Safe information
   * @returns Safe wallet information including owners, threshold, etc.
   */
  async getSafeInfo(): Promise<SafeInfo> {
    try {
      const safe = await this.createSafeInstance();
      
      const [owners, threshold, nonce, version] = await Promise.all([
        safe.getOwners(),
        safe.getThreshold(),
        safe.getNonce(),
        safe.getContractVersion()
      ]);

      return {
        address: this.safeAddress,
        owners: owners.map(owner => owner as Address),
        threshold,
        nonce,
        version
      };
    } catch (error) {
      console.error('Error getting Safe info:', error);
      throw new Error(`Failed to get Safe info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current threshold (minimum number of signatures required)
   * @returns Number of signatures required for transactions
   */
  async getThreshold(): Promise<number> {
    try {
      const safe = await this.createSafeInstance();
      return await safe.getThreshold();
    } catch (error) {
      console.error('Error getting Safe threshold:', error);
      throw new Error(`Failed to get Safe threshold: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current nonce of the Safe
   * @returns Current nonce value
   */
  async getNonce(): Promise<number> {
    try {
      const safe = await this.createSafeInstance();
      return await safe.getNonce();
    } catch (error) {
      console.error('Error getting Safe nonce:', error);
      throw new Error(`Failed to get Safe nonce: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if an address is an owner of the Safe
   * @param address Address to check
   * @returns True if the address is an owner
   */
  async isOwner(address: Address): Promise<boolean> {
    try {
      const owners = await this.getOwners();
      return owners.some(owner => owner.toLowerCase() === address.toLowerCase());
    } catch (error) {
      console.error('Error checking if address is owner:', error);
      throw new Error(`Failed to check owner status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the Safe contract version
   * @returns Safe contract version
   */
  async getVersion(): Promise<string> {
    try {
      const safe = await this.createSafeInstance();
      return await safe.getContractVersion();
    } catch (error) {
      console.error('Error getting Safe version:', error);
      throw new Error(`Failed to get Safe version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Factory function to create SafeCoreInterface instances
 */
export function createSafeCoreInterface(
  publicClient: PublicClient,
  walletClient: WalletClient | undefined,
  safeAddress: Address,
  chain: Chain,
  rpcUrl?: string
): SafeCoreInterface {
  const config: SafeConfig = {
    safeAddress,
    chainId: chain.id,
    rpcUrl
  };

  return new SafeCoreInterface(publicClient, walletClient, config);
}