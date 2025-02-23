import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address } from 'viem'
import type { SecureContractInfo, SecurityOperationEvent, SecurityOperationDetails } from '../lib/types'
import { getChainName, type Chain } from '@/lib/utils'
import SecureOwnableABI from '@/contracts-core/SecureOwnable/SecureOwnable.abi.json'

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
}

export function useSecureContract() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const config = useConfig()

  const validateAndLoadContract = async (address: Address): Promise<SecureContractInfo> => {
    if (!publicClient) {
      throw new Error('No public client available')
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid contract address format')
    }

    try {
      // Verify contract exists using public client
      const isContract = await publicClient.getCode({ address })
      if (!isContract) {
        throw new Error('Address is not a contract')
      }

      // Get chain information from the connected client
      const currentChainId = await publicClient.getChainId()
      const chainName = getChainName(currentChainId as Chain, [...config.chains])

      // Fetch contract details using public client
      const [owner, broadcaster, recoveryAddress, timeLockPeriodInDays] = await Promise.all([
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'owner'
        }).catch(() => { throw new Error('Failed to read owner') }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getBroadcaster'
        }).catch(() => { throw new Error('Failed to read broadcaster') }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getRecoveryAddress'
        }).catch(() => { throw new Error('Failed to read recovery address') }),
        publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getTimeLockPeriodInDays'
        }).catch(() => { throw new Error('Failed to read timelock period') }).then(value => Number(value))
      ]) as [Address, Address, Address, number]

      // Get operation history with error handling
      let events: SecurityOperationEvent[] = [];
      try {
        // Get full operation history
        const history = await publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getOperationHistory'
        }) as OperationRecord[];

        // Process history into events if we have data
        if (history && Array.isArray(history)) {
          events = history.map((op: OperationRecord): SecurityOperationEvent | null => {
            try {
              // Extract operation type from bytes32
              const operationType = op.operationType ? 
                Buffer.from(op.operationType.slice(2), 'hex')
                  .toString('utf8')
                  .replace(/\0/g, '') : '';

              // Map status from contract enum (0 = Pending, 1 = Completed, 2 = Cancelled)
              const status = op.status === 0 ? 'pending' :
                           op.status === 1 ? 'completed' : 'cancelled';

              // Extract timestamp and other values
              const timestamp = Number(op.releaseTime);
              const details: SecurityOperationDetails = {
                oldValue: op.executionOptions,
                newValue: op.value.toString(),
                remainingTime: Number(op.releaseTime) > Date.now() / 1000 ? 
                  Math.floor(Number(op.releaseTime) - Date.now() / 1000) : 0
              };

              return {
                type: operationType === 'OWNERSHIP_UPDATE' ? 'ownership' :
                      operationType === 'BROADCASTER_UPDATE' ? 'broadcaster' :
                      operationType === 'RECOVERY_UPDATE' ? 'recovery' : 'timelock',
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
        // Continue with empty events array rather than throwing
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

  const transferOwnership = async (address: Address) => {
    if (!walletClient) throw new Error('No wallet client available')
    
    const hash = await walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'transferOwnershipRequest'
    })
    
    return hash
  }

  const updateBroadcaster = async (address: Address, newBroadcaster: Address) => {
    if (!walletClient) throw new Error('No wallet client available')
    
    const hash = await walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName: 'updateBroadcasterRequest',
      args: [newBroadcaster]
    })
    
    return hash
  }

  const approveOperation = async (address: Address, txId: number, operationType: 'ownership' | 'broadcaster') => {
    if (!walletClient) throw new Error('No wallet client available')
    
    const functionName = operationType === 'ownership' 
      ? 'transferOwnershipDelayedApproval'
      : 'updateBroadcasterDelayedApproval'
    
    const hash = await walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName,
      args: [BigInt(txId)]
    })
    
    return hash
  }

  const cancelOperation = async (address: Address, txId: number, operationType: 'ownership' | 'broadcaster') => {
    if (!walletClient) throw new Error('No wallet client available')
    
    const functionName = operationType === 'ownership' 
      ? 'transferOwnershipCancellation'
      : 'updateBroadcasterCancellation'
    
    const hash = await walletClient.writeContract({
      address,
      abi: SecureOwnableABI,
      functionName,
      args: [BigInt(txId)]
    })
    
    return hash
  }

  return {
    validateAndLoadContract,
    transferOwnership,
    updateBroadcaster,
    approveOperation,
    cancelOperation,
  }
} 