import { Hex } from 'viem';
import { keccak256, toHex, decodeFunctionData, formatEther } from 'viem';

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
  
  // More Safe methods
  [computeFunctionSelector('approveHash(bytes32)')]: 'approveHash',
  [computeFunctionSelector('signMessage(bytes)')]: 'signMessage',
  [computeFunctionSelector('isValidSignature(bytes,bytes)')]: 'isValidSignature',
  [computeFunctionSelector('getMessageHash(bytes)')]: 'getMessageHash',
  [computeFunctionSelector('getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256)')]: 'getTransactionHash',
  
  // Query methods
  [computeFunctionSelector('getOwners()')]: 'getOwners',
  [computeFunctionSelector('getThreshold()')]: 'getThreshold',
  [computeFunctionSelector('isOwner(address)')]: 'isOwner',
  [computeFunctionSelector('getNonce()')]: 'getNonce',
  [computeFunctionSelector('getGuard()')]: 'getGuard',
  [computeFunctionSelector('getFallbackHandler()')]: 'getFallbackHandler'
};

/**
 * Transaction type detection interface
 */
export interface TransactionType {
  type: 'ETH_TRANSFER' | 'SAFE_METHOD' | 'CONTRACT_CALL' | 'UNKNOWN';
  methodName?: string;
  description: string;
  category: string;
  isExecutable: boolean;
  priority: number; // Lower number = higher priority
}

/**
 * Detect transaction type and decode method
 */
export function detectTransactionType(data: Hex | string, value: bigint = BigInt(0)): TransactionType {
  // Handle empty or zero data
  if (!data || data === '0x' || data === '0x0') {
    if (value > 0) {
      return {
        type: 'ETH_TRANSFER',
        description: `Send ${formatEther(value)} ETH`,
        category: 'Transfer',
        isExecutable: true,
        priority: 1
      };
    } else {
      return {
        type: 'UNKNOWN',
        description: 'Empty Transaction',
        category: 'Other',
        isExecutable: false,
        priority: 10
      };
    }
  }

  // Ensure data starts with 0x
  const hexData = data.startsWith('0x') ? data : `0x${data}`;
  
  // Extract function selector (first 4 bytes)
  const selector = hexData.slice(0, 10);
  
  // Check if it's a Safe method
  const safeMethodName = SAFE_METHOD_SIGNATURES[selector];
  if (safeMethodName) {
    return {
      type: 'SAFE_METHOD',
      methodName: safeMethodName,
      description: getMethodDescription(safeMethodName),
      category: getMethodCategory(safeMethodName),
      isExecutable: true,
      priority: 2
    };
  }
  
  // Try to decode as generic contract call
  if (hexData.length >= 10) {
    try {
      // Try to decode with common ABI patterns
      decodeFunctionData({
        abi: [{
          type: 'function',
          name: 'unknown',
          inputs: [],
          outputs: []
        }],
        data: hexData as Hex
      });
      
      return {
        type: 'CONTRACT_CALL',
        methodName: `Contract Call (${selector})`,
        description: `Contract Call (${selector})`,
        category: 'Contract',
        isExecutable: true,
        priority: 3
      };
    } catch {
      return {
        type: 'CONTRACT_CALL',
        methodName: `Contract Call (${selector})`,
        description: `Contract Call (${selector})`,
        category: 'Contract',
        isExecutable: true,
        priority: 3
      };
    }
  }
  
  return {
    type: 'UNKNOWN',
    methodName: 'Unknown Method',
    description: 'Unknown Method',
    category: 'Other',
    isExecutable: false,
    priority: 10
  };
}

/**
 * Decode Safe contract method from transaction data (legacy function for compatibility)
 */
export function decodeSafeMethod(data: Hex | string): string {
  const txType = detectTransactionType(data);
  return txType.methodName || txType.description;
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
    'approveHash': 'Approve Transaction Hash',
    'signMessage': 'Sign Message',
    'isValidSignature': 'Validate Signature',
    'getMessageHash': 'Get Message Hash',
    'getTransactionHash': 'Get Transaction Hash',
    'getOwners': 'Get Owners',
    'getThreshold': 'Get Threshold',
    'isOwner': 'Check if Owner',
    'getNonce': 'Get Nonce',
    'getGuard': 'Get Guard',
    'getFallbackHandler': 'Get Fallback Handler',
    'Transfer': 'ETH Transfer',
    'ETH_TRANSFER': 'Send ETH',
    'CONTRACT_CALL': 'Contract Call',
    'UNKNOWN': 'Unknown Operation'
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
    'approveHash': 'Security',
    'signMessage': 'Security',
    'isValidSignature': 'Security',
    'getMessageHash': 'Query',
    'getTransactionHash': 'Query',
    'getOwners': 'Query',
    'getThreshold': 'Query',
    'isOwner': 'Query',
    'getNonce': 'Query',
    'getGuard': 'Query',
    'getFallbackHandler': 'Query',
    'Transfer': 'Transfer',
    'ETH_TRANSFER': 'Transfer',
    'CONTRACT_CALL': 'Contract',
    'UNKNOWN': 'Other'
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
 * Get all available operation names dynamically
 */
export function getAllOperationNames(): string[] {
  const operations = new Set<string>();
  
  // Add all Safe method names
  Object.values(SAFE_METHOD_SIGNATURES).forEach(method => {
    operations.add(method);
  });
  
  // Add common transaction types
  operations.add('ETH_TRANSFER');
  operations.add('CONTRACT_CALL');
  operations.add('UNKNOWN');
  
  return Array.from(operations).sort();
}

/**
 * Get operation names by category
 */
export function getOperationNamesByCategory(): Record<string, string[]> {
  const categories: Record<string, string[]> = {};
  
  // Initialize categories
  const categoryKeys = ['Execution', 'Security', 'Ownership', 'Modules', 'Configuration', 'Query', 'Transfer', 'Contract', 'Other'];
  categoryKeys.forEach(cat => {
    categories[cat] = [];
  });
  
  // Add Safe methods to their categories
  Object.values(SAFE_METHOD_SIGNATURES).forEach(method => {
    const category = getMethodCategory(method);
    if (categories[category]) {
      categories[category].push(method);
    }
  });
  
  // Add transaction types
  categories['Transfer'].push('ETH_TRANSFER');
  categories['Contract'].push('CONTRACT_CALL');
  categories['Other'].push('UNKNOWN');
  
  return categories;
}

/**
 * Enhanced method decoder with full context
 */
export function decodeSafeMethodEnhanced(data: Hex | string, value: bigint = BigInt(0)): {
  methodName: string;
  description: string;
  category: string;
  icon: string;
  isSafeMethod: boolean;
  type: string;
  isExecutable: boolean;
  priority: number;
} {
  const txType = detectTransactionType(data, value);
  
  return {
    methodName: txType.methodName || txType.description,
    description: txType.description,
    category: txType.category,
    icon: getMethodIcon(txType.methodName || txType.description),
    isSafeMethod: txType.type === 'SAFE_METHOD',
    type: txType.type,
    isExecutable: txType.isExecutable,
    priority: txType.priority
  };
}