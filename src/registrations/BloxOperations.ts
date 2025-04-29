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
 * Load operations for all Blox types from the catalog
 */
export async function loadBloxOperations(): Promise<void> {
  try {
    // Clear existing operations
    bloxOperationsRegistry.clear();
    
    // Load the catalog
    const catalog = await loadCatalog();
    
    // Dynamically import operations for each Blox type
    for (const bloxId of Object.keys(catalog)) {
      try {
        // Get folder name from the catalog for this bloxId
        const contract = catalog[bloxId];
        if (!contract) continue;
        
        // Extract folder name from component path
        // e.g., "/src/blox/SimpleRWA20/SimpleRWA20.tsx" -> "SimpleRWA20"
        const folderPath = contract.files.component.split('/');
        const folderName = folderPath[folderPath.length - 2];
        
        // Try to dynamically import the operations file for this Blox
        const operationsModule = await import(`../blox/${folderName}/lib/operations`);
        
        if (operationsModule.default) {
          const handler = new operationsModule.default() as BaseBloxOperationsHandler;
          bloxOperationsRegistry.set(bloxId, handler);
          console.log(`Registered operations handler for Blox: ${bloxId}`);
        }
      } catch (error) {
        console.warn(`No operations file found for Blox ${bloxId}`, error);
      }
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
