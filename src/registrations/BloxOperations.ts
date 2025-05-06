import { Address, Chain, Hex, PublicClient, WalletClient } from 'viem';
import { 
  OperationRegistryEntry, 
  operationRegistry, 
  WorkflowType,
  MultiPhaseOperationFunctions,
  SinglePhaseOperationFunctions
} from '../types/OperationRegistry';
import { loadCatalog } from '../lib/catalog';
import { BaseBloxOperationsHandler } from '../types/BloxOperationsHandler';

// Operations registry map - stores operations by blox ID
const bloxOperationsRegistry = new Map<string, BaseBloxOperationsHandler>();

/**
 * Abstract interface for Blox operation handler
 */
export interface BloxOperationsHandler {
  // Get the Blox ID
  getBloxId(): string;
  
  // Register all operations for this Blox
  registerOperations(
    contract: any, 
    contractAddress: Address, 
    publicClient: PublicClient, 
    walletClient?: WalletClient,
    chain?: Chain
  ): void;
  
  // Check if this handler can handle a given contract type
  canHandle(contractType: string): boolean;
}

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Load operations handler for a specific Blox type by ID
 * @param bloxId The ID of the Blox to load
 * @returns Promise resolving to the loaded handler or undefined if not found
 */
export async function loadBloxOperationsByBloxId(bloxId: string): Promise<BaseBloxOperationsHandler | undefined> {
  try {
    // Check if we already have this handler loaded
    if (bloxOperationsRegistry.has(bloxId)) {
      return bloxOperationsRegistry.get(bloxId);
    }
    
    // Otherwise, load the catalog to verify this bloxId exists
    const catalog = await loadCatalog();
    
    // Verify bloxId exists in catalog
    if (!catalog[bloxId]) {
      console.warn(`Blox ID ${bloxId} not found in catalog`);
      return undefined;
    }
    
    // Skip template and test bloxes
    if (bloxId.toLowerCase().includes('template') || bloxId.toLowerCase().includes('test')) {
      console.log(`Skipping operations for template/test Blox: ${bloxId}`);
      return undefined;
    }
    
    // Convert bloxId to PascalCase for directory structure
    const pascalCaseBloxId = toPascalCase(bloxId);
    
    try {
      // Try to dynamically import the operations file for this Blox
      const operationsModule = await import(`../blox/${pascalCaseBloxId}/lib/operations`);
      
      if (operationsModule.default) {
        const handler = new operationsModule.default() as BaseBloxOperationsHandler;
        bloxOperationsRegistry.set(bloxId, handler);
        console.log(`Registered operations handler for Blox: ${bloxId}`);
        return handler;
      } else {
        console.warn(`No operations handler class found for Blox ${bloxId}`);
        return undefined;
      }
    } catch (error) {
      console.warn(`No operations file found for Blox ${bloxId}`, error);
      return undefined;
    }
  } catch (error) {
    console.error(`Failed to load operations for Blox ${bloxId}:`, error);
    return undefined;
  }
}

/**
 * Load operations for all Blox types from the catalog
 * @deprecated Use loadBloxOperationsByBloxId for targeted loading instead
 */
export async function loadBloxOperations(): Promise<void> {
  try {
    // Clear existing operations
    bloxOperationsRegistry.clear();
    
    // Load the catalog
    const catalog = await loadCatalog();
    
    // Dynamically import operations for each Blox type
    for (const bloxId of Object.keys(catalog)) {
      await loadBloxOperationsByBloxId(bloxId);
    }
    
    console.log(`Loaded operations handlers for ${bloxOperationsRegistry.size} Blox types`);
  } catch (error) {
    console.error('Failed to load Blox operations:', error);
  }
}

/**
 * Register operations for a specific contract instance
 * @param contractType The type of the contract (e.g., 'SimpleRWA20')
 * @param contract The contract instance
 * @param contractAddress The contract address
 * @param publicClient The public client
 * @param walletClient Optional wallet client
 * @param chain Optional chain object
 * @returns Promise that resolves to true if operations were registered, false otherwise
 */
export async function registerBloxOperations(
  contractType: string,
  contract: any,
  contractAddress: Address,
  publicClient: PublicClient,
  walletClient?: WalletClient,
  chain?: Chain
): Promise<boolean> {
  // Find the appropriate handler for this contract type
  for (const handler of bloxOperationsRegistry.values()) {
    if (handler.canHandle(contractType)) {
      await handler.registerOperations(
        contract, 
        contractAddress, 
        publicClient, 
        walletClient, 
        chain
      );
      return true;
    }
  }
  
  console.warn(`No operations handler found for contract type: ${contractType}`);
  return false;
}

/**
 * Register operations for a specific blox by ID
 * Check if operations are available for a given contract type
 * @param contractType The contract type to check
 * @returns True if operations are available, false otherwise
 */
export function hasOperationsForContractType(contractType: string): boolean {
  // Check if any handler can handle this contract type
  for (const handler of bloxOperationsRegistry.values()) {
    if (handler.canHandle(contractType)) {
      return true;
    }
  }
  return false;
}

/**
 * Initialize the Blox operations system
 * This should be called during application startup
 */
export async function initializeBloxOperations(): Promise<void> {
  await loadBloxOperations();
}
