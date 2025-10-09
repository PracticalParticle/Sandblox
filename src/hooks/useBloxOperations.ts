import { useCallback } from 'react';
import { Address, PublicClient } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { useChain } from './useChain';
import { TxRecord } from '../Guardian/sdk/typescript/interfaces/lib.index';
import { MetaTransactionManager } from '@/services/MetaTransactionManager';
import { loadBloxOperationsByBloxId } from '@/registrations/BloxOperations';
import { loadBloxContractModule, loadBloxComponentModule } from '@/lib/catalog';

interface BloxComponents {
  [key: string]: React.ComponentType<any>;
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

  const getBloxComponents = useCallback(async (bloxId: string, componentName: string): Promise<BloxComponents | undefined> => {
    try {
      if (!bloxId) {
        console.error('No bloxId provided to getBloxComponents');
        return undefined;
      }
      
      if (!componentName) {
        console.error('No componentName provided to getBloxComponents');
        return undefined;
      }
      
      // Use the catalog utility function to load the component
      const module = await loadBloxComponentModule(bloxId, componentName);
      return module;
    } catch (error) {
      console.error(`Failed to load component ${componentName} for blox: ${bloxId}`, error);
      return undefined;
    }
  }, []);

  const getBloxOperations = useCallback(async (bloxId: string, contractAddress?: Address): Promise<BloxOperations | undefined> => {
    try {
      if (!bloxId) {
        console.error('No bloxId provided to getBloxOperations');
        return undefined;
      }

      // If no contract address provided, we can still load the operations handler
      // but some functionality might be limited
      if (!contractAddress) {
        console.warn('No contract address provided for blox operations');
      }

      // Load the operations handler for this specific blox ID
      const handler = await loadBloxOperationsByBloxId(bloxId);
      
      if (!handler) {
        console.error(`No operations handler found for blox: ${bloxId}`);
        return undefined;
      }
      
      // Get contract instance if we have an address
      if (contractAddress) {
        // Get contract module using the utility function
        const contractModule = await loadBloxContractModule(bloxId);
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
        const txManager = new MetaTransactionManager();
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