import { useCallback } from 'react';
import { Address, PublicClient } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useChain } from './useChain';
import { BaseBloxOperationsHandler } from '../types/BloxOperationsHandler';
import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionManager } from '@/services/TransactionManager';

interface BloxComponents {
  PendingTransactions: React.ComponentType<any>;
  [key: string]: any;
}

interface BloxOperations {
  handleApprove: (txId: number) => Promise<void>;
  handleCancel: (txId: number) => Promise<void>;
  handleMetaTxSign: (tx: any, type: 'approve' | 'cancel') => Promise<void>;
  handleBroadcast: (tx: any, type: 'approve' | 'cancel') => Promise<void>;
  getOperationName: (tx: any) => string;
  convertRecord: (record: TxRecord) => any;
  [key: string]: any;
}

export function useBloxOperations() {
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient();
  const chain = useChain();

  const getBloxComponents = useCallback(async (bloxId: string): Promise<BloxComponents | undefined> => {
    try {
      // Convert bloxId to PascalCase for directory structure
      const pascalCaseBloxId = bloxId.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join('');
      
      // Dynamic import of blox components
      const module = await import(`../blox/${pascalCaseBloxId}/components/PendingTransaction`);
      return {
        PendingTransactions: module.PendingTransactions,
        ...module
      };
    } catch (error) {
      console.error(`Failed to load components for blox: ${bloxId}`, error);
      return undefined;
    }
  }, []);

  const getBloxOperations = useCallback(async (bloxId: string, contractAddress?: Address): Promise<BloxOperations | undefined> => {
    try {
      // Convert bloxId to PascalCase for directory structure
      const pascalCaseBloxId = bloxId.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join('');

      // If no contract address provided, we can still load the operations handler
      // but some functionality might be limited
      if (!contractAddress) {
        console.warn('No contract address provided for blox operations');
      }

      // Dynamic import of blox operations
      const module = await import(`../blox/${pascalCaseBloxId}/lib/operations`);
      if (!module.default) {
        throw new Error(`No operations handler found for blox: ${bloxId}`);
      }

      // Initialize the operations handler
      const handler = new module.default() as BaseBloxOperationsHandler;
      
      // Get contract instance if we have an address
      if (contractAddress) {
        // Get contract module
        const contractModule = await import(`../blox/${pascalCaseBloxId}/${pascalCaseBloxId}`);
        if (!contractModule.default) {
          throw new Error(`No contract implementation found for blox: ${bloxId}`);
        }

        // Create contract instance
        const contract = new contractModule.default(
          publicClient,
          walletClient,
          contractAddress,
          chain
        );

        // Create transaction manager instance
        const txManager = new TransactionManager();
        const storeTransaction = (txId: string, signedData: string, metadata?: Record<string, any>) => {
          txManager.storeSignedTransaction(contractAddress, txId, signedData, metadata);
        };

        // Register operations
        await handler.registerOperations(
          contract,
          contractAddress,
          publicClient,
          walletClient,
          chain,
          storeTransaction
        );
      }

      return {
        handleApprove: handler.handleApprove.bind(handler),
        handleCancel: handler.handleCancel.bind(handler),
        handleMetaTxSign: handler.handleMetaTxSign.bind(handler),
        handleBroadcast: handler.handleBroadcast.bind(handler),
        getOperationName: handler.getOperationName.bind(handler),
        convertRecord: handler.convertRecord.bind(handler)
      };
    } catch (error) {
      console.error(`Failed to load operations for blox: ${bloxId}`, error);
      return undefined;
    }
  }, [publicClient, walletClient, chain]);

  return {
    getBloxComponents,
    getBloxOperations
  };
} 