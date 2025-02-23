import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address, parseAbi } from 'viem'
import type { SecureContractInfo, SecurityOperationEvent } from '../lib/types'
import { getChainName, type Chain } from '@/lib/utils'

// Define the ABI inline since we can't import the JSON directly
const SecureOwnableABI = parseAbi([
  // View functions
  'function owner() view returns (address)',
  'function getBroadcaster() view returns (address)',
  'function getRecoveryAddress() view returns (address)',
  'function getTimeLockPeriodInDays() view returns (uint256)',
  'function getOperationHistory() view returns ((string,uint8,uint256,string,string,uint256)[])',
  'function isOperationTypeSupported(bytes32 operationType) view returns (bool)',
  
  // Constants
  'function OWNERSHIP_UPDATE() view returns (bytes32)',
  'function BROADCASTER_UPDATE() view returns (bytes32)',
  'function RECOVERY_UPDATE() view returns (bytes32)',
  'function TIMELOCK_UPDATE() view returns (bytes32)',
  
  // Write functions
  'function transferOwnershipRequest() returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))',
  'function transferOwnershipDelayedApproval(uint256 txId) returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))',
  'function transferOwnershipCancellation(uint256 txId) returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))',
  'function updateBroadcasterRequest(address newBroadcaster) returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))',
  'function updateBroadcasterDelayedApproval(uint256 txId) returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))',
  'function updateBroadcasterCancellation(uint256 txId) returns ((uint256,address,address,bytes32,uint8,bytes,uint256,uint256,uint256,uint256,uint8))'
])

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
        const history = await publicClient.readContract({
          address,
          abi: SecureOwnableABI,
          functionName: 'getOperationHistory'
        }) as unknown as [string, number, bigint, string, string, bigint][];
        
        // Process history into events if we have data
        if (history && Array.isArray(history)) {
          events = history.map((op) => ({
            type: op[0] === 'OWNERSHIP_UPDATE' ? 'ownership' :
                  op[0] === 'BROADCASTER_UPDATE' ? 'broadcaster' :
                  op[0] === 'RECOVERY_UPDATE' ? 'recovery' : 'timelock',
            status: op[1] === 0 ? 'pending' :
                    op[1] === 1 ? 'completed' : 'cancelled',
            timestamp: Number(op[2]),
            description: `${op[0].replace('_', ' ')} operation`,
            details: {
              oldValue: op[3],
              newValue: op[4],
              remainingTime: Number(op[5]) > Date.now() / 1000 ? 
                Math.floor(Number(op[5]) - Date.now() / 1000) : 0
            }
          }));
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