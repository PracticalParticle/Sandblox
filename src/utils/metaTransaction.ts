import { createWalletClient, custom, getAddress } from 'viem';
import { mainnet } from 'viem/chains';

/**
 * Get the meta transaction signature for a temporal action
 * @param type The type of action ('approve' or 'cancel')
 * @param txId The original transaction ID
 * @returns The signed meta transaction data
 */
export async function getMetaTransactionSignature(
  type: 'approve' | 'cancel',
  txId?: number
): Promise<string> {
  if (!txId) throw new Error('Transaction ID is required');
  if (!window.ethereum) throw new Error('No ethereum provider found');
  
  try {
    // Create a wallet client
    const walletClient = createWalletClient({
      chain: mainnet,
      transport: custom(window.ethereum)
    });

    // Get the signer's address
    const [address] = await walletClient.getAddresses();

    // Create the meta transaction data
    const domain = {
      name: 'ParticleNetwork',
      version: '1',
      chainId: await walletClient.getChainId(),
      verifyingContract: getAddress('0x...') // Add your contract address here
    };

    const types = {
      MetaTransaction: [
        { name: 'txId', type: 'uint256' },
        { name: 'action', type: 'string' },
        { name: 'nonce', type: 'uint256' }
      ]
    } as const;

    const message = {
      txId: BigInt(txId),
      action: type,
      nonce: BigInt(Date.now()) // In production, you should use a proper nonce management system
    } as const;

    // Sign the typed data
    const signature = await walletClient.signTypedData({
      account: address,
      domain,
      types,
      primaryType: 'MetaTransaction',
      message,
    });
    
    // Return the signature along with the original data
    return JSON.stringify({
      signature,
      domain,
      message,
      types
    });
  } catch (error: any) {
    throw new Error(`Failed to sign meta transaction: ${error.message}`);
  }
}