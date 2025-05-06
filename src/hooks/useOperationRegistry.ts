import { useCallback } from 'react';
import { Hex } from 'viem';
import { operationRegistry, OperationRegistryEntry } from '../types/OperationRegistry';

export function useOperationRegistry() {
  const getOperationInfo = useCallback(async (operationType: Hex): Promise<OperationRegistryEntry | undefined> => {
    try {
      // Get operation by hash from registry
      const operation = operationRegistry.getOperationByHash(operationType);
      if (!operation) {
        console.warn(`No operation found for type: ${operationType}`);
      }
      return operation;
    } catch (error) {
      console.error('Failed to get operation info:', error);
      return undefined;
    }
  }, []);

  const isBloxOperation = useCallback((operationType: Hex, bloxId?: string): boolean => {
    try {
      const operation = operationRegistry.getOperationByHash(operationType);
      if (!operation) return false;
      
      // If bloxId is provided, check if operation belongs to that blox
      if (bloxId) {
        return operation.bloxId === bloxId;
      }
      
      // Otherwise, just check if it's a blox operation (has a bloxId)
      return Boolean(operation.bloxId);
    } catch (error) {
      console.error('Failed to check if operation is blox operation:', error);
      return false;
    }
  }, []);

  return {
    getOperationInfo,
    isBloxOperation
  };
} 