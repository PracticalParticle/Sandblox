import { Hex } from 'viem';
import { keccak256, toHex } from 'viem';

/**
 * Safe contract method decoder utility
 * Decodes transaction data to show specific Safe method names
 */

// Function to compute function selector from signature
function computeFunctionSelector(signature: string): Hex {
  const hash = keccak256(toHex(signature));
  return `0x${hash.slice(2, 10)}` as Hex;
}

// Safe contract method signatures with computed function selectors
const SAFE_METHOD_SIGNATURES: Record<string, string> = {
  // Core execution methods
  [computeFunctionSelector('execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)')]: 'execTransaction',
  [computeFunctionSelector('setGuard(address)')]: 'setGuard',
  [computeFunctionSelector('removeGuard()')]: 'removeGuard',
  
  // Owner management
  [computeFunctionSelector('addOwnerWithThreshold(address,uint256)')]: 'addOwnerWithThreshold',
  [computeFunctionSelector('removeOwner(address)')]: 'removeOwner',
  [computeFunctionSelector('removeOwnerWithThreshold(address,uint256)')]: 'removeOwnerWithThreshold',
  [computeFunctionSelector('changeThreshold(uint256)')]: 'changeThreshold',
  [computeFunctionSelector('swapOwner(address,address,address)')]: 'swapOwner',
  
  // Additional Safe methods
  [computeFunctionSelector('enableModule(address)')]: 'enableModule',
  [computeFunctionSelector('disableModule(address,address)')]: 'disableModule',
  [computeFunctionSelector('execTransactionFromModule(address,uint256,bytes,uint8)')]: 'execTransactionFromModule',
  [computeFunctionSelector('setFallbackHandler(address)')]: 'setFallbackHandler',
  [computeFunctionSelector('multiSend(bytes)')]: 'multiSend',
  
  // Query methods
  [computeFunctionSelector('getOwners()')]: 'getOwners',
  [computeFunctionSelector('getThreshold()')]: 'getThreshold',
  [computeFunctionSelector('isOwner(address)')]: 'isOwner',
  [computeFunctionSelector('getNonce()')]: 'getNonce',
  [computeFunctionSelector('getGuard()')]: 'getGuard',
  [computeFunctionSelector('getFallbackHandler()')]: 'getFallbackHandler'
};

/**
 * Decode Safe contract method from transaction data
 */
export function decodeSafeMethod(data: Hex | string): string {
  if (!data || data === '0x' || data === '0x0') {
    return 'Transfer';
  }

  // Ensure data starts with 0x
  const hexData = data.startsWith('0x') ? data : `0x${data}`;
  
  // Extract function selector (first 4 bytes)
  const selector = hexData.slice(0, 10);
  
  // Look up method name
  const methodName = SAFE_METHOD_SIGNATURES[selector];
  
  if (methodName) {
    return methodName;
  }
  
  // If not found in Safe methods, try to decode as generic contract call
  if (hexData.length >= 10) {
    return `Contract Call (${selector})`;
  }
  
  return 'Unknown Method';
}

/**
 * Get method description for better UX
 */
export function getMethodDescription(methodName: string): string {
  const descriptions: Record<string, string> = {
    'execTransaction': 'Execute Safe Transaction',
    'setGuard': 'Set Transaction Guard',
    'removeGuard': 'Remove Transaction Guard',
    'addOwnerWithThreshold': 'Add Owner with Threshold',
    'removeOwner': 'Remove Owner',
    'removeOwnerWithThreshold': 'Remove Owner with Threshold',
    'changeThreshold': 'Change Signature Threshold',
    'swapOwner': 'Swap Owner',
    'enableModule': 'Enable Module',
    'disableModule': 'Disable Module',
    'execTransactionFromModule': 'Execute Transaction from Module',
    'setFallbackHandler': 'Set Fallback Handler',
    'multiSend': 'Multi-Send Transaction',
    'getOwners': 'Get Owners',
    'getThreshold': 'Get Threshold',
    'isOwner': 'Check if Owner',
    'getNonce': 'Get Nonce',
    'getGuard': 'Get Guard',
    'getFallbackHandler': 'Get Fallback Handler',
    'Transfer': 'ETH Transfer'
  };
  
  return descriptions[methodName] || methodName;
}

/**
 * Get method category for UI grouping
 */
export function getMethodCategory(methodName: string): string {
  const categories: Record<string, string> = {
    'execTransaction': 'Execution',
    'setGuard': 'Security',
    'removeGuard': 'Security',
    'addOwnerWithThreshold': 'Ownership',
    'removeOwner': 'Ownership',
    'removeOwnerWithThreshold': 'Ownership',
    'changeThreshold': 'Ownership',
    'swapOwner': 'Ownership',
    'enableModule': 'Modules',
    'disableModule': 'Modules',
    'execTransactionFromModule': 'Modules',
    'setFallbackHandler': 'Configuration',
    'multiSend': 'Execution',
    'getOwners': 'Query',
    'getThreshold': 'Query',
    'isOwner': 'Query',
    'getNonce': 'Query',
    'getGuard': 'Query',
    'getFallbackHandler': 'Query',
    'Transfer': 'Transfer'
  };
  
  return categories[methodName] || 'Other';
}

/**
 * Get method icon for UI
 */
export function getMethodIcon(methodName: string): string {
  return methodName;
}

/**
 * Enhanced method decoder with full context
 */
export function decodeSafeMethodEnhanced(data: Hex | string): {
  methodName: string;
  description: string;
  category: string;
  icon: string;
  isSafeMethod: boolean;
} {
  const methodName = decodeSafeMethod(data);
  const description = getMethodDescription(methodName);
  const category = getMethodCategory(methodName);
  const icon = getMethodIcon(methodName);
  const isSafeMethod = methodName !== 'Unknown Method' && !methodName.startsWith('Contract Call');
  
  return {
    methodName,
    description,
    category,
    icon,
    isSafeMethod
  };
}