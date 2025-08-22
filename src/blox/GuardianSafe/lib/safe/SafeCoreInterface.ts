import { PublicClient, WalletClient, Address, encodeFunctionData } from 'viem';
import Safe from '@safe-global/protocol-kit';
import { env } from '../../../../config/env';

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
  guardAddress: Address | null;
}

/**
 * Interface for interacting with Safe smart contract
 */
export class SafeCoreInterface {
  private safeSdk: Safe | null = null;
  private safeAddress: Address;
  private publicClient: PublicClient;
  private walletClient: WalletClient;

  constructor(config: SafeConfig, publicClient: PublicClient, walletClient: WalletClient) {
    this.safeAddress = config.safeAddress;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  /**
   * Initialize the Safe SDK and API Kit
   */
  async init(): Promise<void> {
    if (!this.walletClient?.account?.address) {
      throw new Error('Wallet client with account is required');
    }

    try {
          // Initialize Safe SDK with provider URL and wallet address
    const provider = this.walletClient.transport?.url || this.publicClient.transport.url;
    console.log('🔗 Using provider:', provider);
      
      this.safeSdk = await Safe.init({
        provider,
        signer: this.walletClient.account.address,
        safeAddress: this.safeAddress
      });

      console.log('Safe SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Safe SDK:', error);
      throw error;
    }
  }

  /**
   * Get Safe owners/signers
   */
  async getOwners(): Promise<Address[]> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }
    return await this.safeSdk.getOwners() as Address[];
  }

  /**
   * Check if an address is an owner
   */
  async isOwner(address: Address): Promise<boolean> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }
    return await this.safeSdk.isOwner(address);
  }

  /**
   * Get Safe nonce
   */
  async getNonce(): Promise<number> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }
    return await this.safeSdk.getNonce();
  }

  /**
   * Get Safe guard info
   */
  async getGuardInfo(): Promise<GuardInfo> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }
    try {
      const guardAddress = await this.safeSdk.getGuard();
      return {
        guardAddress: guardAddress as Address
      };
    } catch (error) {
      console.error('Failed to get guard info:', error);
      throw error;
    }
  }

  /**
   * Set a guard on the Safe
   */
  async setGuard(guardAddress: Address): Promise<string> {
    if (!this.safeSdk || !this.walletClient?.account || !this.safeAddress) {
      throw new Error('Safe SDK not initialized or wallet not connected');
    }

    // Validate the guard address format
    if (!guardAddress || typeof guardAddress !== 'string') {
      throw new Error('Invalid guard address: address must be a string');
    }

    // Ensure address is properly formatted (42 characters including 0x)
    if (!/^0x[a-fA-F0-9]{40}$/.test(guardAddress)) {
      throw new Error(`Invalid guard address format: ${guardAddress}. Address must be a valid 42-character hex string starting with 0x`);
    }

    // Check if it's not the zero address
    if (guardAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      throw new Error('Cannot set zero address as guard');
    }

    console.log('🔐 Setting guard on Safe...');
    console.log('Connected wallet address:', this.walletClient.account.address);
    console.log('Safe address:', this.safeAddress);
    console.log('Guard address:', guardAddress);
    console.log('Guard address length:', guardAddress.length);

    // Get Safe info
    const owners = await this.safeSdk.getOwners();
    const threshold = await this.safeSdk.getThreshold();
    
    console.log('Safe owners:', owners);
    console.log('Safe threshold:', threshold);

    // Check if wallet is an owner
    const isOwner = owners.includes(this.walletClient.account.address);
    if (!isOwner) {
      throw new Error('Connected wallet is not an owner of this Safe');
    }

    console.log('✅ Wallet is confirmed as Safe owner');
    console.log('✅ Guard address validation passed');

    if (threshold === 1) {
      console.log('Single owner Safe - using optimized signing approach');
      
      // Create Safe transaction using SDK
      const safeTransaction = await this.safeSdk.createEnableGuardTx(guardAddress);
      console.log('Safe transaction created:', safeTransaction.data);
      
      // Get the transaction hash that needs to be signed
      const safeTxHash = await this.safeSdk.getTransactionHash(safeTransaction);
      console.log('Safe transaction hash:', safeTxHash);

      // Verify the current nonce matches
      const currentNonce = await this.safeSdk.getNonce();
      if (currentNonce !== safeTransaction.data.nonce) {
        console.warn('⚠️ Nonce mismatch detected, refreshing transaction...');
        // Recreate transaction with current nonce
        const freshTransaction = await this.safeSdk.createEnableGuardTx(guardAddress);
        const freshHash = await this.safeSdk.getTransactionHash(freshTransaction);
        console.log('Refreshed transaction hash:', freshHash);
        return this.executeWithProperSignature(freshTransaction, freshHash);
      }

      return this.executeWithProperSignature(safeTransaction, safeTxHash);
    } else {
      throw new Error('Multi-signature Safes not yet supported for setGuard operation');
    }
  }

  /**
   * Execute Safe transaction with proper signature handling
   */
  private async executeWithProperSignature(safeTransaction: any, safeTxHash: string): Promise<string> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not available');
    }

    // Try Safe SDK execution first (recommended approach)
    try {
      console.log('🌐 Attempting Safe SDK execution...');
      
      // Sign the transaction using Safe SDK
      const signedTransaction = await this.safeSdk!.signTransaction(safeTransaction);
      console.log('✅ Transaction signed successfully');
      
      // Execute using Safe SDK
      const executionResult = await this.safeSdk!.executeTransaction(signedTransaction);
      console.log('✅ Transaction executed via Safe SDK:', executionResult);
      
      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: executionResult.hash as `0x${string}`
      });

      if (receipt.status === 'success') {
        console.log('✅ Safe SDK execution confirmed!');
        return executionResult.hash;
      } else {
        throw new Error(`Safe SDK execution failed with status: ${receipt.status}`);
      }
      
    } catch (sdkError) {
      console.log('⚠️ Safe SDK execution failed, trying manual approach...');
      console.log('SDK Error:', sdkError);
      
      // Fallback to manual execution with pre-approval
      return this.executeWithPreApproval(safeTransaction, safeTxHash);
    }
  }

  /**
   * Execute with pre-approval approach (fallback)
   */
  private async executeWithPreApproval(safeTransaction: any, safeTxHash: string): Promise<string> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client not available');
    }

    console.log('🔑 Using pre-approval approach...');
    console.log('🔍 Transaction details for approval:');
    console.log('- Transaction hash:', safeTxHash);
    console.log('- Nonce:', safeTransaction.data.nonce);
    console.log('- To:', safeTransaction.data.to);
    console.log('- Data:', safeTransaction.data.data);
    
    // Step 1: Pre-approve the transaction hash
    const approveHashTx = await this.walletClient.sendTransaction({
      account: this.walletClient.account,
      to: this.safeAddress,
      chain: this.walletClient.chain,
      data: encodeFunctionData({
        abi: [
          {
            name: 'approveHash',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'hashToApprove', type: 'bytes32' }],
            outputs: []
          }
        ],
        functionName: 'approveHash',
        args: [safeTxHash as `0x${string}`]
      })
    });

    console.log('✅ Hash approval transaction submitted:', approveHashTx);

    // Wait for approval confirmation
    const approvalReceipt = await this.publicClient.waitForTransactionReceipt({
      hash: approveHashTx
    });

    if (approvalReceipt.status !== 'success') {
      throw new Error(`Hash approval failed with status: ${approvalReceipt.status}`);
    }

    console.log('✅ Transaction hash approved successfully!');

    // Step 2: Verify the transaction hash hasn't changed
    const currentNonce = await this.safeSdk!.getNonce();
    console.log('🔍 Current Safe nonce:', currentNonce);
    console.log('🔍 Transaction nonce:', safeTransaction.data.nonce);
    
    if (currentNonce !== safeTransaction.data.nonce) {
      console.error('❌ NONCE MISMATCH! Transaction may fail.');
      console.log('Expected nonce:', safeTransaction.data.nonce);
      console.log('Current nonce:', currentNonce);
      
      // Recreate transaction with current nonce
      console.log('🔄 Recreating transaction with current nonce...');
      const freshTransaction = await this.safeSdk!.createEnableGuardTx(safeTransaction.data.data.slice(10, 50)); // Extract guard address
      const freshHash = await this.safeSdk!.getTransactionHash(freshTransaction);
      
      console.log('🆕 Fresh transaction hash:', freshHash);
      console.log('🆕 Fresh nonce:', freshTransaction.data.nonce);
      
      // We need to approve the fresh hash
      console.log('🔑 Approving fresh transaction hash...');
      const freshApproveHashTx = await this.walletClient.sendTransaction({
        account: this.walletClient.account,
        to: this.safeAddress,
        chain: this.walletClient.chain,
        data: encodeFunctionData({
          abi: [
            {
              name: 'approveHash',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [{ name: 'hashToApprove', type: 'bytes32' }],
              outputs: []
            }
          ],
          functionName: 'approveHash',
          args: [freshHash as `0x${string}`]
        })
      });

      const freshApprovalReceipt = await this.publicClient.waitForTransactionReceipt({
        hash: freshApproveHashTx
      });

      if (freshApprovalReceipt.status !== 'success') {
        throw new Error(`Fresh hash approval failed with status: ${freshApprovalReceipt.status}`);
      }

      console.log('✅ Fresh transaction hash approved!');
      
      // Use the fresh transaction
      safeTransaction = freshTransaction;
      safeTxHash = freshHash;
    }

    // Step 3: Use contract signature format (this is what works in Tenderly)
    console.log('🔐 Using contract signature format (pre-approved hash)...');
    
    const signerAddress = this.walletClient.account.address.slice(2).toLowerCase();
    const paddedSigner = signerAddress.padStart(64, '0'); // 32 bytes
    const signatureType = '01'; // Contract signature type (pre-approved hash)
    
    // Calculate exact padding needed: 65 bytes total - 32 bytes (signer) - 1 byte (type) = 32 bytes padding
    const paddingBytes = 32;
    const padding = '0'.repeat(paddingBytes * 2); // 64 hex characters (32 bytes)
    
    // Construct signature: 32 bytes signer + 32 bytes padding + 1 byte type
    let signature = `${paddedSigner}${padding}${signatureType}`;
    
    console.log('📋 Contract signature construction:');
    console.log('- Signer address (32 bytes):', paddedSigner, '(length:', paddedSigner.length, ')');
    console.log('- Padding (32 bytes):', padding, '(length:', padding.length, ')');
    console.log('- Signature type (1 byte):', signatureType, '(length:', signatureType.length, ')');
    console.log('- Total signature:', signature);
    console.log('- Total length:', signature.length, '(should be 130)');
    console.log('- Total bytes:', signature.length / 2, '(should be 65)');
    
    // Verify signature length is exactly 130 characters (65 bytes)
    if (signature.length !== 130) {
      console.error('❌ Signature length is incorrect!');
      console.log('Expected: 130 characters, Got:', signature.length);
      throw new Error(`Invalid signature length: ${signature.length}, expected 130`);
    }
    
    // Verify signature ends with '01'
    if (!signature.endsWith('01')) {
      console.error('❌ Signature type is incorrect!');
      console.log('Expected to end with "01", but ends with:', signature.slice(-2));
      throw new Error(`Invalid signature type: ${signature.slice(-2)}, expected "01"`);
    }
    
    console.log('✅ Signature validation passed!');

    const txHash = await this.walletClient.sendTransaction({
      account: this.walletClient.account,
      to: this.safeAddress,
      chain: this.walletClient.chain,
      data: encodeFunctionData({
        abi: [
          {
            name: 'execTransaction',
            type: 'function',
            stateMutability: 'payable',
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
            outputs: [{ name: 'success', type: 'bool' }]
          }
        ],
        functionName: 'execTransaction',
        args: [
          safeTransaction.data.to as `0x${string}`,
          BigInt(safeTransaction.data.value),
          safeTransaction.data.data as `0x${string}`,
          safeTransaction.data.operation,
          BigInt(safeTransaction.data.safeTxGas),
          BigInt(safeTransaction.data.baseGas),
          BigInt(safeTransaction.data.gasPrice),
          safeTransaction.data.gasToken as `0x${string}`,
          safeTransaction.data.refundReceiver as `0x${string}`,
          `0x${signature}` as `0x${string}`
        ]
      })
    });

    console.log('🔍 Final transaction encoding details:');
    console.log('- Signature as hex:', `0x${signature}`);
    console.log('- Signature byte length:', signature.length / 2);
    console.log('- Expected byte length: 65');

    console.log('✅ Manual execution submitted:', txHash);

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    if (receipt.status === 'success') {
      console.log('✅ Manual execution confirmed!');
      return txHash;
    } else {
      throw new Error(`Manual execution failed with status: ${receipt.status}`);
    }
  }

  /**
   * Remove the transaction guard from the Safe wallet
   */
  async removeGuard(): Promise<string> {
    if (!this.safeSdk) {
      throw new Error('Safe SDK not initialized');
    }

    if (!this.walletClient?.account?.address) {
      throw new Error('Wallet client with account is required to remove guard');
    }

    try {
      // First verify that the connected wallet is a Safe owner
      const isOwner = await this.isOwner(this.walletClient.account.address);
      if (!isOwner) {
        throw new Error('Connected wallet is not a Safe owner. Only Safe owners can remove guards.');
      }

      // Create the disable guard transaction
      const safeTransaction = await this.safeSdk.createDisableGuardTx();
      
      // Sign the transaction
      const signedSafeTx = await this.safeSdk.signTransaction(safeTransaction, 'ETH_SIGN');
      
      // Execute the transaction
      const response = await this.safeSdk.executeTransaction(signedSafeTx);
      
      if (!response.hash) {
        throw new Error('Failed to get transaction hash');
      }

      return response.hash;
    } catch (error) {
      console.error('Error removing Safe guard:', error);
      throw error;
    }
  }
}