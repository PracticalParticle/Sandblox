/**
 * Safe Transaction Service Configuration
 * Maps chain IDs to their respective Safe Transaction Service endpoints
 */

export const SAFE_TRANSACTION_SERVICE_URLS: Record<number, string> = {
  // Mainnet networks
  1: 'https://safe-transaction-mainnet.safe.global', // Ethereum Mainnet
  137: 'https://safe-transaction-polygon.safe.global', // Polygon
  10: 'https://safe-transaction-optimism.safe.global', // Optimism
  42161: 'https://safe-transaction-arbitrum.safe.global', // Arbitrum One
  56: 'https://safe-transaction-bsc.safe.global', // BSC
  100: 'https://safe-transaction-gnosis.safe.global', // Gnosis Chain
  43114: 'https://safe-transaction-avalanche.safe.global', // Avalanche
  250: 'https://safe-transaction-fantom.safe.global', // Fantom
  42220: 'https://safe-transaction-celo.safe.global', // Celo
  1313161554: 'https://safe-transaction-aurora.safe.global', // Aurora
  324: 'https://safe-transaction-zk-sync.safe.global', // zkSync Era
  1101: 'https://safe-transaction-polygon-zkevm.safe.global', // Polygon zkEVM
  59144: 'https://safe-transaction-linea.safe.global', // Linea
  5000: 'https://safe-transaction-mantle.safe.global', // Mantle
  204: 'https://safe-transaction-opbnb.safe.global', // opBNB
  534352: 'https://safe-transaction-scroll.safe.global', // Scroll
  7777777: 'https://safe-transaction-zora.safe.global', // Zora
  8453: 'https://safe-transaction-base.safe.global', // Base

  // Testnet networks
  11155111: 'https://safe-transaction-sepolia.safe.global', // Sepolia
  84532: 'https://safe-transaction-base-sepolia.safe.global', // Base Sepolia
  421614: 'https://safe-transaction-arbitrum-sepolia.safe.global', // Arbitrum Sepolia
  11155420: 'https://safe-transaction-optimism-sepolia.safe.global', // Optimism Sepolia
  97: 'https://safe-transaction-bsc-testnet.safe.global', // BSC Testnet
  10200: 'https://safe-transaction-gnosis-chiado.safe.global', // Gnosis Chiado
  43113: 'https://safe-transaction-fuji.safe.global', // Avalanche Fuji
  80001: 'https://safe-transaction-mumbai.safe.global', // Polygon Mumbai
  44787: 'https://safe-transaction-alfajores.safe.global', // Celo Alfajores
  1313161555: 'https://safe-transaction-aurora-testnet.safe.global', // Aurora Testnet
  280: 'https://safe-transaction-zk-sync-goerli.safe.global', // zkSync Goerli
  1442: 'https://safe-transaction-polygon-zkevm-testnet.safe.global', // Polygon zkEVM Testnet
  59140: 'https://safe-transaction-linea-goerli.safe.global', // Linea Goerli
  5001: 'https://safe-transaction-mantle-testnet.safe.global', // Mantle Testnet
  5611: 'https://safe-transaction-opbnb-testnet.safe.global', // opBNB Testnet
  534351: 'https://safe-transaction-scroll-sepolia.safe.global', // Scroll Sepolia
  999: 'https://safe-transaction-zora-testnet.safe.global', // Zora Testnet

  // Legacy testnets (deprecated but still supported)
  5: 'https://safe-transaction-goerli.safe.global', // Goerli (deprecated)
};

/**
 * Get the Safe Transaction Service URL for a given chain ID
 * @param chainId The chain ID to get the URL for
 * @returns The Safe Transaction Service URL for the chain
 * @throws Error if the chain is not supported
 */
export function getSafeTransactionServiceUrl(chainId: number): string {
  const url = SAFE_TRANSACTION_SERVICE_URLS[chainId];
  if (!url) {
    throw new Error(`Unsupported chain ID: ${chainId}. Safe Transaction Service not available.`);
  }
  return url;
}

/**
 * Check if a chain ID is supported by Safe Transaction Service
 * @param chainId The chain ID to check
 * @returns True if the chain is supported, false otherwise
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in SAFE_TRANSACTION_SERVICE_URLS;
}

/**
 * Get all supported chain IDs
 * @returns Array of supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(SAFE_TRANSACTION_SERVICE_URLS).map(Number);
} 