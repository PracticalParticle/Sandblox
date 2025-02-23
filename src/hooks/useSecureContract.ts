import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address, Hash, PublicClient, WalletClient } from 'viem'
import { 
  SecureContractInfo, 
  SecurityOperationEvent, 
  SecurityOperationDetails,
  OperationType,
  ExecutionType,
  PaymentDetails
} from '../lib/types'
import { getChainName, type Chain } from '@/lib/utils'
import { CONTRACT_ERRORS, TIMELOCK_PERIODS } from '@/constants/contract'
import SecureOwnableABI from '@/contracts-core/SecureOwnable/SecureOwnable.abi.json'

// Constants from contract
const OPERATION_TYPES = {
  OWNERSHIP_UPDATE: 'OWNERSHIP_UPDATE',
  BROADCASTER_UPDATE: 'BROADCASTER_UPDATE',
  RECOVERY_UPDATE: 'RECOVERY_UPDATE',
  TIMELOCK_UPDATE: 'TIMELOCK_UPDATE'
} as const;

type OperationRecord = {
  txId: bigint;
  releaseTime: bigint;
  status: number;
  requester: Address;
  target: Address;
  operationType: string;
  executionType: number;
  executionOptions: string;
  value: bigint;
  gasLimit: bigint;
  result: string;
  payment?: PaymentDetails;
}

type ContractWriteResult = {
  hash: Hash;
  wait: () => Promise<void>;
}

type MetaTransaction = {
  txRecord: OperationRecord;
  chainId: number;
  handlerContract: Address;
  handlerSelector: string;
  nonce: number;
  deadline: number;
  maxGasPrice: number;
  signer: Address;
  signature: string;
  data: string;
}

export function useSecureContract() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const config = useConfig()

  // Helper function to validate contract code exists
  const validateContractExists = async (client: PublicClient, address: Address): Promise<void> => {
    const code = await client.getBytecode({ address })
    if (!code || code.length <= 2) { // "0x" case
      throw new Error(CONTRACT_ERRORS.NOT_DEPLOYED)
    }
  }

  // Helper to validate timelock period
  const validateTimeLockPeriod = (days: number): void => {
    if (days < TIMELOCK_PERIODS.MIN || days > TIMELOCK_PERIODS.MAX) {
      throw new Error(CONTRACT_ERRORS.INVALID_TIMELOCK)
    }
  }

  const validateAndLoadContract = async (address: Address): Promise<SecureContractInfo> => {
    if (!publicClient) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error(CONTRACT_ERRORS.INVALID_ADDRESS)
    }

    try {
      // Verify contract exists
      await validateContractExists(publicClient, address)

      // Get chain information
      const currentChainId = await publicClient.getChainId()
      const chainName = getChainName(currentChainId as Chain, [...config.chains])

      // Fetch contract details using Promise.all for better performance
      const [owner, broadcaster, recoveryAddress, timeLockPeriodInDays] = await Promise.all([
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'owner'
        }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getBroadcaster'
        }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getRecoveryAddress'
        }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getTimeLockPeriodInDays'
        }).then(value => Number(value))
      ]) as [Address, Address, Address, number]

      // Get operation history with error handling
      let events: SecurityOperationEvent[] = [];
      try {
        const history = await publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getOperationHistory'
        }) as OperationRecord[];

        if (history?.length) {
          events = history.map((op: OperationRecord): SecurityOperationEvent | null => {
            try {
              const operationType = op.operationType ? 
                Buffer.from(op.operationType.slice(2), 'hex')
                  .toString('utf8')
                  .replace(/\0/g, '') : '';

              const status = op.status === 0 ? 'pending' :
                           op.status === 1 ? 'completed' : 'cancelled';

              const timestamp = Number(op.releaseTime);
              const details: SecurityOperationDetails = {
                oldValue: op.executionOptions,
                newValue: op.value.toString(),
                remainingTime: Number(op.releaseTime) > Date.now() / 1000 ? 
                  Math.floor(Number(op.releaseTime) - Date.now() / 1000) : 0
              };

              return {
                type: operationType === OPERATION_TYPES.OWNERSHIP_UPDATE ? 'ownership' :
                      operationType === OPERATION_TYPES.BROADCASTER_UPDATE ? 'broadcaster' :
                      operationType === OPERATION_TYPES.RECOVERY_UPDATE ? 'recovery' : 'timelock',
                status,
                timestamp,
                description: `${operationType.replace(/_/g, ' ')} operation`,
                details
              };
            } catch (error) {
              console.warn('Failed to parse operation:', error);
              return null;
            }
          }).filter((event): event is SecurityOperationEvent => event !== null);
        }
      } catch (error) {
        console.warn('Failed to read operation history:', error);
      }

      return {
        address,
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInDays,
        pendingOperations: events.filter(e => e.status === 'pending'),
        recentEvents: events.filter(e => e.status !== 'pending').slice(0, 5),
        chainId: currentChainId,
        chainName
      }
    } catch (error) {
      console.error('Contract validation error:', error)
      throw error
    }
  }

  // Ownership Management
  const transferOwnership = async (address: Address): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)
    
    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipRequest'
    })
  }

  // Broadcaster Management
  const updateBroadcaster = async (address: Address, newBroadcaster: Address): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)
    
    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterRequest',
      args: [newBroadcaster]
    })
  }

  // Operation Management
  const approveOperation = async (
    address: Address, 
    txId: number, 
    operationType: OperationType
  ): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)
    
    const functionName = operationType === 'ownership' 
      ? 'transferOwnershipDelayedApproval'
      : 'updateBroadcasterDelayedApproval'
    
    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName,
      args: [BigInt(txId)]
    })
  }

  const cancelOperation = async (
    address: Address, 
    txId: number, 
    operationType: OperationType
  ): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)
    
    const functionName = operationType === 'ownership' 
      ? 'transferOwnershipCancellation'
      : 'updateBroadcasterCancellation'
    
    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName,
      args: [BigInt(txId)]
    })
  }

  // Meta Transaction Management
  const generateUnsignedMetaTransaction = async (
    address: Address,
    txRecord: OperationRecord,
    handlerContract: Address,
    handlerSelector: string,
    deadline: number,
    maxGasPrice: number,
    signer: Address
  ): Promise<MetaTransaction> => {
    if (!publicClient) throw new Error(CONTRACT_ERRORS.NO_CLIENT)

    return publicClient.readContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'generateUnsignedMetaTransaction',
      args: [txRecord, handlerContract, handlerSelector, BigInt(deadline), BigInt(maxGasPrice), signer]
    }) as Promise<MetaTransaction>
  }

  // Payment Management
  const makePayment = async (
    address: Address,
    payment: PaymentDetails,
    metaTx: MetaTransaction
  ): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)

    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'makePayment',
      args: [payment, metaTx]
    })
  }

  // Recovery Management
  const updateRecoveryAddress = async (
    address: Address,
    newRecoveryAddress: Address,
    metaTx: MetaTransaction
  ): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)

    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'updateRecoveryRequestAndApprove',
      args: [metaTx]
    })
  }

  // TimeLock Management
  const updateTimeLockPeriod = async (
    address: Address,
    newPeriodInDays: number,
    metaTx: MetaTransaction
  ): Promise<Hash> => {
    if (!walletClient) throw new Error(CONTRACT_ERRORS.NO_WALLET)
    validateTimeLockPeriod(newPeriodInDays)

    return walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'updateTimeLockRequestAndApprove',
      args: [metaTx]
    })
  }

  return {
    // Contract Loading
    validateAndLoadContract,

    // Ownership Management
    transferOwnership,

    // Broadcaster Management
    updateBroadcaster,

    // Operation Management
    approveOperation,
    cancelOperation,

    // Meta Transaction Management
    generateUnsignedMetaTransaction,

    // Payment Management
    makePayment,

    // Recovery Management
    updateRecoveryAddress,

    // TimeLock Management
    updateTimeLockPeriod,
  }
} 