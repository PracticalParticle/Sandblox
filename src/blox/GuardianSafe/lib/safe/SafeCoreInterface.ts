import { PublicClient, WalletClient, Address, encodeFunctionData, Chain } from 'viem';
import { getSafeTransactionServiceUrl } from '../../config/safe';

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
 * Transaction guard information
 */
export interface GuardInfo {
  guard: Address;
  isEnabled: boolean;
}

/**
 * @title SafeCoreInterface
 * @notice Service for interacting with Safe wallets using direct contract calls
 * @dev Provides a clean interface for Safe wallet operations
 */
export class SafeCoreInterface {
  private safeAddress: Address;
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
  }



  /**
   * Get the owners/signers of the Safe wallet
   * @returns Array of owner addresses
   */
  async getOwners(): Promise<Address[]> {
    try {
      // Use direct contract call for reading owners (more reliable)
      const owners = await this.publicClient.readContract({
        address: this.safeAddress,
        abi: [{
          name: 'getOwners',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'address[]' }],
          stateMutability: 'view'
        }] as const,
        functionName: 'getOwners'
      });
      
      return owners as Address[];
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
      // Use direct contract calls for reading (more reliable)
      const [owners, threshold, nonce, version] = await Promise.all([
        this.getOwners(),
        this.getThreshold(),
        this.getNonce(),
        this.getVersion()
      ]);

      return {
        address: this.safeAddress,
        owners,
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
      const threshold = await this.publicClient.readContract({
        address: this.safeAddress,
        abi: [{
          name: 'getThreshold',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }] as const,
        functionName: 'getThreshold'
      });
      
      return Number(threshold);
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
      const nonce = await this.publicClient.readContract({
        address: this.safeAddress,
        abi: [{
          name: 'nonce',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }] as const,
        functionName: 'nonce'
      });
      
      return Number(nonce);
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
      const version = await this.publicClient.readContract({
        address: this.safeAddress,
        abi: [{
          name: 'VERSION',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
          stateMutability: 'view'
        }] as const,
        functionName: 'VERSION'
      });
      
      return version as string;
    } catch (error) {
      console.error('Error getting Safe version:', error);
      throw new Error(`Failed to get Safe version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current transaction guard address
   * @returns Address of the current guard or zero address if no guard is set
   */
  async getGuard(): Promise<Address> {
    try {
      // The guard address is stored in storage slot 4 in Gnosis Safe contracts
      // This is the standard storage slot for the guard address
      const guardSlot = '0x0000000000000000000000000000000000000000000000000000000000000004';
      const guardData = await this.publicClient.getStorageAt({
        address: this.safeAddress,
        slot: guardSlot
      });
      
      if (!guardData || guardData === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return '0x0000000000000000000000000000000000000000' as Address;
      }
      
      // Convert the 32-byte storage value to a 20-byte address
      // The address is stored in the last 20 bytes of the storage slot
      const guardAddress = `0x${guardData.slice(-40)}` as Address;
      
      return guardAddress;
    } catch (error) {
      console.error('Error getting Safe guard:', error);
      throw new Error(`Failed to get Safe guard: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a specific address is set as the transaction guard
   * @param guardAddress Address to check
   * @returns True if the address is the current guard
   */
  async isGuard(guardAddress: Address): Promise<boolean> {
    try {
      const currentGuard = await this.getGuard();
      return currentGuard.toLowerCase() === guardAddress.toLowerCase();
    } catch (error) {
      console.error('Error checking if address is guard:', error);
      throw new Error(`Failed to check guard status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set a transaction guard on the Safe wallet using execTransaction
   * @param guardAddress Address of the guard contract to set
   * @returns Safe transaction hash
   */
  async setGuard(guardAddress: Address): Promise<string> {
    if (!this.walletClient?.account?.address) {
      throw new Error('Wallet client with account is required to set guard');
    }

    try {
      // First verify that the connected wallet is a Safe owner
      const isOwner = await this.isOwner(this.walletClient.account.address);
      if (!isOwner) {
        throw new Error('Connected wallet is not a Safe owner. Only Safe owners can set guards.');
      }

      // Get Safe nonce for the transaction
      const nonce = await this.getNonce();
      console.log('Fetched Safe Nonce:', nonce);
      
      // Encode the setGuard function call
      const setGuardData = encodeFunctionData({
        abi: [{
          name: 'setGuard',
          type: 'function',
          inputs: [{ name: 'guard', type: 'address' }],
          outputs: [],
          stateMutability: 'nonpayable'
        }],
        args: [guardAddress]
      });

      // Create the Safe transaction data
      const safeTx = {
        to: this.safeAddress,
        value: '0',
        data: setGuardData,
        operation: 0, // Call operation
        safeTxGas: '0',
        baseGas: '0',
        gasPrice: '0',
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        nonce: nonce.toString()
      };
      
      console.log('Safe transaction data:', safeTx);
      
      // Create the transaction hash
      const safeTxHash = await this.createSafeTxHash(safeTx);
      console.log('Calculated SafeTxHash (for signing):', safeTxHash);
      
      // Sign the transaction hash using EIP-712 typed data
      const domain = {
        name: 'Safe',
        version: '1.0.0',
        chainId: BigInt(this.publicClient.chain?.id || 1),
        verifyingContract: this.safeAddress
      };
      
      const message = {
        to: safeTx.to,
        value: BigInt(safeTx.value),
        data: safeTx.data as `0x${string}`,
        operation: safeTx.operation,
        safeTxGas: BigInt(safeTx.safeTxGas),
        baseGas: BigInt(safeTx.baseGas),
        gasPrice: BigInt(safeTx.gasPrice),
        gasToken: safeTx.gasToken as `0x${string}`,
        refundReceiver: safeTx.refundReceiver as `0x${string}`,
        nonce: BigInt(safeTx.nonce)
      };
      
      console.log('EIP-712 Domain:', domain);
      console.log('EIP-712 Message:', message);
      
      const signature = await this.walletClient.signTypedData({
        account: this.walletClient.account.address,
        domain,
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          SafeTx: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'operation', type: 'uint8' },
            { name: 'safeTxGas', type: 'uint256' },
            { name: 'baseGas', type: 'uint256' },
            { name: 'gasPrice', type: 'uint256' },
            { name: 'gasToken', type: 'address' },
            { name: 'refundReceiver', type: 'address' },
            { name: 'nonce', type: 'uint256' }
          ]
        },
        primaryType: 'SafeTx',
        message
      });
      console.log('Generated EIP-712 Signature:', signature);

      // Propose the transaction to the Safe Transaction Service
      await this.proposeTransactionToSafeAPI(safeTx, safeTxHash, signature);

      // For single-owner Safes, also execute immediately
      const threshold = await this.getThreshold();
      if (threshold === 1) {
        try {
          await this.executeTransaction(safeTx, signature);
          console.log('Transaction executed immediately for single-owner Safe');
        } catch (execError) {
          console.warn('Immediate execution failed, transaction is proposed and pending:', execError);
        }
      }

      return safeTxHash;
    } catch (error) {
      console.error('Error setting Safe guard:', error);
      throw new Error(`Failed to set Safe guard: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove the transaction guard from the Safe wallet
   * @returns Safe transaction hash
   */
  async removeGuard(): Promise<string> {
    return this.setGuard('0x0000000000000000000000000000000000000000' as Address);
  }

  /**
   * Create a Safe transaction hash
   */
  private async createSafeTxHash(safeTx: any): Promise<string> {
    try {
      const safeTxHash = await this.publicClient.readContract({
        address: this.safeAddress,
        abi: [{
          name: 'getTransactionHash',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'operation', type: 'uint8' },
            { name: 'safeTxGas', type: 'uint256' },
            { name: 'baseGas', type: 'uint256' },
            { name: 'gasPrice', type: 'uint256' },
            { name: 'gasToken', type: 'address' },
            { name: 'refundReceiver', type: 'address' },
            { name: 'nonce', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bytes32' }],
          stateMutability: 'view'
        }] as const,
        functionName: 'getTransactionHash',
        args: [
          safeTx.to,
          BigInt(safeTx.value),
          safeTx.data,
          safeTx.operation,
          BigInt(safeTx.safeTxGas),
          BigInt(safeTx.baseGas),
          BigInt(safeTx.gasPrice),
          safeTx.gasToken,
          safeTx.refundReceiver,
          BigInt(safeTx.nonce)
        ]
      });
      
      return safeTxHash;
    } catch (error) {
      console.error('Error creating Safe transaction hash:', error);
      throw new Error(`Failed to create Safe transaction hash: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Propose a transaction to the Safe Transaction Service API
   */
  private async proposeTransactionToSafeAPI(safeTx: any, safeTxHash: string, signature: string): Promise<void> {
    // Get the correct transaction service URL based on chain
    const chainId = this.publicClient.chain?.id;
    if (!chainId) {
      throw new Error('Chain ID not available');
    }
    
    const txServiceUrl = getSafeTransactionServiceUrl(chainId);

    // Get Safe owners to determine signature position
    const owners = await this.getOwners();
    const ownerIndex = owners.findIndex(owner => 
      owner.toLowerCase() === this.walletClient!.account!.address.toLowerCase()
    );

    if (ownerIndex === -1) {
      throw new Error('Connected wallet is not a Safe owner');
    }

    console.log('Owner index for signature:', ownerIndex);
    console.log('Original signature length:', signature.length);
    console.log('Original signature:', signature);

    // Create the signature with owner index prefix (Safe format: 0x + ownerIndex + signature)
    const signatureWithIndex = `0x${ownerIndex.toString().padStart(2, '0')}${signature.slice(2)}`;
    
    console.log('Formatted signature with index:', signatureWithIndex);
    console.log('Formatted signature length:', signatureWithIndex.length);

    // Prepare the transaction proposal data according to Safe Transaction Service API
    const proposalData = {
      to: safeTx.to,
      value: safeTx.value,
      data: safeTx.data,
      operation: safeTx.operation,
      safeTxGas: safeTx.safeTxGas,
      baseGas: safeTx.baseGas,
      gasPrice: safeTx.gasPrice,
      gasToken: safeTx.gasToken,
      refundReceiver: safeTx.refundReceiver,
      nonce: safeTx.nonce,
      contractTransactionHash: safeTxHash,
      sender: this.walletClient!.account!.address,
      signature: signatureWithIndex,
      origin: 'GuardianSafe-Interface'
    };

    console.log('Proposing transaction to Safe API:', {
      url: `${txServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/`,
      safeAddress: this.safeAddress,
      data: proposalData
    });

    // Submit the proposal to Safe Transaction Service
    const response = await fetch(`${txServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proposalData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Safe API Error Response:', errorText);
      console.error('Request URL:', `${txServiceUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/`);
      console.error('Request Data:', JSON.stringify(proposalData, null, 2));
      throw new Error(`Failed to propose transaction to Safe API: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Transaction proposed successfully to Safe Transaction Service:', responseData);
    
    // Log the Safe UI URL for the user
    const safeUIUrl = `https://app.safe.global/transactions/queue?safe=${this.safeAddress}`;
    console.log(`Transaction should appear in Safe UI: ${safeUIUrl}`);
  }

  /**
   * Execute a Safe transaction
   */
  private async executeTransaction(safeTx: any, signature: string): Promise<void> {
    // Get Safe owners to create the signatures array
    const owners = await this.getOwners();
    const ownerIndex = owners.findIndex(owner => 
      owner.toLowerCase() === this.walletClient!.account!.address.toLowerCase()
    );

    if (ownerIndex === -1) {
      throw new Error('Connected wallet is not a Safe owner');
    }

    // Create signatures array with the signature in the correct position
    const signatures = new Array(owners.length).fill('0x');
    signatures[ownerIndex] = signature;

    // Execute the transaction
    await this.walletClient!.writeContract({
      chain: this.publicClient.chain,
      address: this.safeAddress,
      account: this.walletClient!.account!.address,
      abi: [{
        name: 'execTransaction',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
          { name: 'safeTxGas', type: 'uint256' },
          { name: 'baseGas', type: 'uint256' },
          { name: 'gasPrice', type: 'uint256' },
          { name: 'gasToken', type: 'address' },
          { name: 'refundReceiver', type: 'address' },
          { name: 'signatures', type: 'bytes' }
        ],
        outputs: [{ name: 'success', type: 'bool' }],
        stateMutability: 'nonpayable'
      }],
      functionName: 'execTransaction',
      args: [
        safeTx.to,
        BigInt(safeTx.value),
        safeTx.data,
        safeTx.operation,
        BigInt(safeTx.safeTxGas),
        BigInt(safeTx.baseGas),
        BigInt(safeTx.gasPrice),
        safeTx.gasToken,
        safeTx.refundReceiver,
        this.encodeSignatures(signatures)
      ]
    });
  }

  /**
   * Encode signatures array into bytes
   */
  private encodeSignatures(signatures: string[]): `0x${string}` {
    // Filter out empty signatures and concatenate
    const validSignatures = signatures.filter(sig => sig !== '0x');
    return validSignatures.join('') as `0x${string}`;
  }



  /**
   * Get comprehensive guard information
   * @returns Guard information including address and enabled status
   */
  async getGuardInfo(): Promise<GuardInfo> {
    try {
      const guardAddress = await this.getGuard();
      const isEnabled = guardAddress !== '0x0000000000000000000000000000000000000000';
      
      return {
        guard: guardAddress,
        isEnabled
      };
    } catch (error) {
      console.error('Error getting guard info:', error);
      throw new Error(`Failed to get guard info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }



  /**
   * Check if the Safe has any transaction guard enabled
   * @returns True if a guard is set and enabled
   */
  async hasGuard(): Promise<boolean> {
    try {
      const guardInfo = await this.getGuardInfo();
      return guardInfo.isEnabled;
    } catch (error) {
      console.error('Error checking if Safe has guard:', error);
      throw new Error(`Failed to check if Safe has guard: ${error instanceof Error ? error.message : String(error)}`);
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