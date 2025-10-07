import { z } from 'zod';
import type { Chain } from 'viem';

// Schema for validating custom network data
const customNetworkSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(50),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url().optional(),
  nativeCurrency: z.object({
    name: z.string().min(1),
    symbol: z.string().min(1).max(10),
    decimals: z.number().int().min(0).max(18).default(18),
  }),
  testnet: z.boolean().default(true),
});

export type CustomNetwork = z.infer<typeof customNetworkSchema>;

export type NetworkFormData = {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrencySymbol: string;
  nativeCurrencyName: string;
};

// Default networks that cannot be removed
export const DEFAULT_NETWORKS: readonly Chain[] = [
  {
    id: 11155111,
    name: 'Sepolia',
    nativeCurrency: {
      decimals: 18,
      name: 'Sepolia Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: ['https://ethereum-sepolia-rpc.publicnode.com'],
      },
      public: {
        http: ['https://ethereum-sepolia-rpc.publicnode.com'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Etherscan',
        url: 'https://sepolia.etherscan.io',
      },
    },
    contracts: {
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11',
        blockCreated: 751532,
      },
      ensRegistry: {
        address: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
      },
      ensUniversalResolver: {
        address: '0xc8Af999e38273D658BE1b921b88A9Ddf005769cC',
        blockCreated: 5317080,
      },
    },
    testnet: true,
  },
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    nativeCurrency: {
      name: 'Arbitrum Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc'],
      },
      public: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Arbiscan',
        url: 'https://sepolia.arbiscan.io',
        apiUrl: 'https://api-sepolia.arbiscan.io/api',
      },
    },
    contracts: {
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11',
        blockCreated: 81930,
      },
    },
    testnet: true,
  },
  {
    id: 300,
    name: 'ZKsync Sepolia Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia.era.zksync.dev'],
        webSocket: ['wss://sepolia.era.zksync.dev/ws'],
      },
      public: {
        http: ['https://sepolia.era.zksync.dev'],
        webSocket: ['wss://sepolia.era.zksync.dev/ws'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Etherscan',
        url: 'https://sepolia-era.zksync.network/',
        apiUrl: 'https://api-sepolia-era.zksync.network/api',
      },
      zksync: {
        name: 'ZKsync Explorer',
        url: 'https://sepolia.explorer.zksync.io/',
      },
    },
    contracts: {
      multicall3: {
        address: '0xF9cda624FBC7e059355ce98a31693d299FACd963',
      },
      universalSignatureVerifier: {
        address: '0xfB688330379976DA81eB64Fe4BF50d7401763B9C',
        blockCreated: 3855712,
      },
    },
    testnet: true,
  },
] as const;

const STORAGE_KEY = 'sandblox.customNetworks';

/**
 * Get all custom networks from localStorage
 */
export function getCustomNetworks(): CustomNetwork[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Validate each network
    return parsed.filter((network) => {
      try {
        customNetworkSchema.parse(network);
        return true;
      } catch {
        console.warn('Invalid network found in storage:', network);
        return false;
      }
    });
  } catch (error) {
    console.error('Error reading custom networks from storage:', error);
    return [];
  }
}

/**
 * Add a new custom network
 */
export function addCustomNetwork(networkData: NetworkFormData): { success: boolean; error?: string } {
  try {
    // Validate chain ID is unique
    const existingNetworks = getCustomNetworks();
    const defaultChainIds = DEFAULT_NETWORKS.map(n => n.id);
    
    if (existingNetworks.some(n => n.id === networkData.chainId) || 
        defaultChainIds.includes(networkData.chainId)) {
      return { success: false, error: 'Chain ID already exists' };
    }
    
    // Create network object
    const customNetwork: CustomNetwork = {
      id: networkData.chainId,
      name: networkData.name,
      rpcUrl: networkData.rpcUrl,
      explorerUrl: networkData.explorerUrl,
      nativeCurrency: {
        name: networkData.nativeCurrencyName,
        symbol: networkData.nativeCurrencySymbol,
        decimals: 18,
      },
      testnet: true,
    };
    
    // Validate the network
    customNetworkSchema.parse(customNetwork);
    
    // Add to storage
    const updatedNetworks = [...existingNetworks, customNetwork];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNetworks));
    
    return { success: true };
  } catch (error) {
    console.error('Error adding custom network:', error);
    return { success: false, error: 'Failed to add network' };
  }
}

/**
 * Remove a custom network by chain ID
 */
export function removeCustomNetwork(chainId: number): { success: boolean; error?: string } {
  try {
    const existingNetworks = getCustomNetworks();
    const updatedNetworks = existingNetworks.filter(n => n.id !== chainId);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNetworks));
    return { success: true };
  } catch (error) {
    console.error('Error removing custom network:', error);
    return { success: false, error: 'Failed to remove network' };
  }
}

/**
 * Get all available networks (default + custom)
 */
export function getAllNetworks(): Chain[] {
  const customNetworks = getCustomNetworks();
  
  // Convert custom networks to Chain format
  const customChains: Chain[] = customNetworks.map(network => ({
    id: network.id,
    name: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: {
      default: {
        http: [network.rpcUrl],
      },
      public: {
        http: [network.rpcUrl],
      },
    },
    blockExplorers: network.explorerUrl ? {
      default: {
        name: `${network.name} Explorer`,
        url: network.explorerUrl,
      },
    } : undefined,
    testnet: network.testnet,
  }));
  
  return [...DEFAULT_NETWORKS, ...customChains];
}

/**
 * Check if a chain ID is a default network
 */
export function isDefaultNetwork(chainId: number): boolean {
  return DEFAULT_NETWORKS.some(n => n.id === chainId);
}

/**
 * Get custom RPC URLs for CSP
 */
export function getCustomRpcUrls(): string[] {
  const customNetworks = getCustomNetworks();
  return customNetworks.map(network => network.rpcUrl);
}
