import { useState, useEffect, useCallback } from "react"
import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address, Hash } from 'viem'
import { 
  SecureOwnable,
  DynamicRBAC,
  Definitions,
  MetaTransaction,
  TransactionResult,
  ExecutionType,
  TxAction
} from '../Guardian/sdk/typescript'
import { useToast } from "@/components/ui/use-toast"
import { OperationType, CoreOperationType, OperationPhase } from '../types/OperationRegistry'

export function useGuardianSDK(contractAddress?: Address) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const config = useConfig()
  const { toast } = useToast()
  
  const [secureOwnable, setSecureOwnable] = useState<SecureOwnable | undefined>(undefined)
  const [dynamicRBAC, setDynamicRBAC] = useState<DynamicRBAC | undefined>(undefined)
  const [definitions, setDefinitions] = useState<Definitions | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [contractInfo, setContractInfo] = useState<any>(null)

  // Initialize Guardian SDK instances
  useEffect(() => {
    const initSDK = async () => {
      if (!publicClient || !contractAddress) {
        console.log('🔧 useGuardianSDK: Missing dependencies', {
          hasPublicClient: !!publicClient,
          contractAddress
        });
        setSecureOwnable(undefined)
        setDynamicRBAC(undefined)
        setDefinitions(undefined)
        setContractInfo(null)
        return
      }

      try {
        setIsLoading(true)
        const chain = config.chains.find(c => c.id === chainId)
        if (!chain) {
          console.error("Chain not found for chainId:", chainId);
          return
        }

        console.log('🔧 useGuardianSDK initSDK:', {
          contractAddress,
          chainId: chain.id,
          chainName: chain.name,
          hasPublicClient: !!publicClient,
          hasWalletClient: !!walletClient,
          walletClientAccount: walletClient?.account?.address
        });

        // Initialize Guardian SDK instances directly
        const secureOwnableInstance = new SecureOwnable(
          publicClient, 
          walletClient || undefined, 
          contractAddress,
          chain
        );
        
        const dynamicRBACInstance = new DynamicRBAC(
          publicClient, 
          walletClient || undefined, 
          contractAddress,
          chain
        );
        
        const definitionsInstance = new Definitions(
          publicClient, 
          walletClient || undefined, 
          contractAddress,
          chain
        );

        // Load contract info
        const [owner, broadcaster, recovery, timeLockPeriod] = await Promise.all([
          secureOwnableInstance.owner(),
          secureOwnableInstance.getBroadcaster(),
          secureOwnableInstance.getRecovery(),
          secureOwnableInstance.getTimeLockPeriodSec()
        ]);

        const contractData = {
          owner,
          broadcaster,
          recovery,
          timeLockPeriodInSeconds: timeLockPeriod.toString(),
          chainId: chain.id
        };

        console.log('✅ Guardian SDK initialized successfully:', contractData);
        
        setSecureOwnable(secureOwnableInstance)
        setDynamicRBAC(dynamicRBACInstance)
        setDefinitions(definitionsInstance)
        setContractInfo(contractData)
      } catch (error) {
        console.error("Failed to initialize Guardian SDK:", error)
        setSecureOwnable(undefined)
        setDynamicRBAC(undefined)
        setDefinitions(undefined)
        setContractInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    initSDK()
  }, [publicClient, walletClient, contractAddress, chainId, config.chains])

  // Sign single phase operation using Guardian SDK
  const signSinglePhaseOperation = useCallback(async (
    operationType: CoreOperationType,
    params: any
  ): Promise<string> => {
    if (!secureOwnable || !walletClient?.account?.address) {
      throw new Error('SDK not initialized or wallet not connected')
    }

    try {
      console.log('🔧 signSinglePhaseOperation:', { operationType, params });

      let result: TransactionResult;

      // Handle different operation types using the proper Guardian SDK methods
      switch (operationType) {
        case CoreOperationType.TIMELOCK_UPDATE:
          // For timelock updates, we need to use the proper approach
          // The Guardian SDK doesn't have a direct method for timelock updates
          // We need to use the base state machine approach
          throw new Error('Timelock updates are not supported in this version of the Guardian SDK. Please use the WorkflowManager for this operation.');
          break;
          
        case CoreOperationType.RECOVERY_UPDATE:
          // For recovery updates, use the proper SDK method
          result = await secureOwnable.updateRecoveryRequestAndApprove(
            params.newRecoveryAddress,
            { from: walletClient.account.address }
          );
          break;
          
        case CoreOperationType.OWNERSHIP_TRANSFER:
          // For ownership transfers, use the proper SDK method
          result = await secureOwnable.transferOwnershipRequest(
            { from: walletClient.account.address }
          );
          break;
          
        case CoreOperationType.BROADCASTER_UPDATE:
          // For broadcaster updates, use the proper SDK method
          result = await secureOwnable.updateBroadcasterRequest(
            params.newBroadcasterAddress,
            { from: walletClient.account.address }
          );
          break;
          
        default:
          throw new Error(`Unsupported operation type: ${operationType}`);
      }

      console.log('✅ Operation signed successfully:', result.hash);
      return result.hash;
    } catch (error) {
      console.error('❌ Failed to sign operation:', error);
      throw error;
    }
  }, [secureOwnable, walletClient]);

  // Execute meta transaction using Guardian SDK
  const executeMetaTransaction = useCallback(async (
    signedMetaTx: MetaTransaction
  ): Promise<Hash> => {
    if (!secureOwnable || !walletClient?.account?.address) {
      throw new Error('SDK not initialized or wallet not connected')
    }

    try {
      console.log('🔧 executeMetaTransaction:', { signedMetaTx });

      // Check if current wallet is the broadcaster
      const broadcasterAddress = await secureOwnable.getBroadcaster();
      if (walletClient.account.address.toLowerCase() !== broadcasterAddress.toLowerCase()) {
        throw new Error(`Only the broadcaster can execute this transaction. Current account (${walletClient.account.address}) is not the broadcaster (${broadcasterAddress})`);
      }

      // Execute the meta transaction
      const result = await secureOwnable.executeMetaTransaction(
        signedMetaTx,
        { from: walletClient.account.address }
      );

      console.log('✅ Meta transaction executed successfully:', result.hash);
      return result.hash;
    } catch (error) {
      console.error('❌ Failed to execute meta transaction:', error);
      throw error;
    }
  }, [secureOwnable, walletClient]);

  // Get role information
  const getRoleInfo = useCallback(async () => {
    if (!secureOwnable || !walletClient?.account?.address) {
      return null;
    }

    try {
      const [owner, broadcaster, recovery] = await Promise.all([
        secureOwnable.owner(),
        secureOwnable.getBroadcaster(),
        secureOwnable.getRecovery()
      ]);

      const currentAddress = walletClient.account.address.toLowerCase();
      
      return {
        isOwner: currentAddress === owner.toLowerCase(),
        isBroadcaster: currentAddress === broadcaster.toLowerCase(),
        isRecovery: currentAddress === recovery.toLowerCase(),
        owner,
        broadcaster,
        recovery
      };
    } catch (error) {
      console.error('Failed to get role info:', error);
      return null;
    }
  }, [secureOwnable, walletClient]);

  // Get role information
  const [roleInfo, setRoleInfo] = useState<any>(null);
  
  useEffect(() => {
    const loadRoleInfo = async () => {
      if (secureOwnable && walletClient?.account?.address) {
        const info = await getRoleInfo();
        setRoleInfo(info);
      }
    };
    loadRoleInfo();
  }, [secureOwnable, walletClient, getRoleInfo]);

  return {
    // SDK instances
    secureOwnable: secureOwnable || undefined,
    dynamicRBAC: dynamicRBAC || undefined,
    definitions: definitions || undefined,
    
    // State
    isLoading,
    contractInfo,
    
    // Methods
    signSinglePhaseOperation,
    executeMetaTransaction,
    getRoleInfo,
    
    // Role information
    isOwner: roleInfo?.isOwner || false,
    isBroadcaster: roleInfo?.isBroadcaster || false,
    isRecovery: roleInfo?.isRecovery || false,
    canExecutePhase: roleInfo?.isBroadcaster || false, // Only broadcaster can execute
    
    // Convenience getters
    isInitialized: !!secureOwnable && !!dynamicRBAC && !!definitions,
    hasWallet: !!walletClient?.account?.address
  }
}
