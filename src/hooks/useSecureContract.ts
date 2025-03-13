import { usePublicClient, useWalletClient, useChainId, useConfig } from 'wagmi'
import { Address, Hash } from 'viem'
import { SecureContractInfo } from '../lib/types'
import { CONTRACT_ERRORS } from '@/constants/contract'
import { useTransactionManager } from '@/hooks/useTransactionManager'
import { generateNewSecureOwnableManager } from '@/lib/utils'

export function useSecureContract() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const config = useConfig()
  

  const validateAndLoadContract = async (address: Address): Promise<SecureContractInfo> => {
    if (!publicClient) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error(CONTRACT_ERRORS.INVALID_ADDRESS)
    }

    try {
      // Get chain information
      const chain = config.chains.find(c => c.id === chainId);
      if (!chain) {
        throw new Error(CONTRACT_ERRORS.NO_CLIENT)
      }

      const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain);
      return await manager.loadContractInfo();
    } catch (error) {
      console.error('Contract validation error:', error)
      throw error
    }
  }

  // Ownership Management
  const transferOwnership = async (address: Address): Promise<Hash> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain);
    return manager.transferOwnership({ from: walletClient.account.address });
  }

  // Broadcaster Management
  const updateBroadcaster = async (address: Address, newBroadcaster: Address): Promise<Hash> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain);
    return manager.updateBroadcaster(newBroadcaster, { from: walletClient.account.address });
  }

  const signBroadcasterUpdate = async (address: Address, txId: number, storeTransaction: (txId: string, signedTx: string, metadata?: Record<string, unknown>) => void): Promise<string> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }
    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain, storeTransaction);
    
    return manager.prepareAndSignBroadcasterApproval(BigInt(txId), { from: walletClient.account.address });
  } 

  const signTransferOwnership = async (address: Address, txId: number, storeTransaction: (txId: string, signedTx: string, metadata?: Record<string, unknown>) => void): Promise<string> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }
    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain, storeTransaction);
    
    return manager.prepareAndSignOwnershipApproval(BigInt(txId), { from: walletClient.account.address });
  }

  // Operation Management
  const approveOperation = async (
    address: Address, 
    txId: number, 
    operationType: 'ownership' | 'broadcaster'
  ): Promise<Hash> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain);
    if (operationType === 'ownership') {
      return manager.approveOwnershipTransfer(BigInt(txId), { from: walletClient.account.address });
    } else {
      return manager.approveBroadcasterUpdate(BigInt(txId), { from: walletClient.account.address });
    }
  }

  const cancelOperation = async (
    address: Address, 
    txId: number, 
    operationType: 'ownership' | 'broadcaster'
  ): Promise<Hash> => {
    if (!publicClient || !walletClient?.account) {
      throw new Error(CONTRACT_ERRORS.NO_WALLET)
    }

    const chain = config.chains.find(c => c.id === chainId);
    if (!chain) {
      throw new Error(CONTRACT_ERRORS.NO_CLIENT)
    }

    const manager = await generateNewSecureOwnableManager(publicClient, walletClient, address, chain);
    if (operationType === 'ownership') {
      return manager.cancelOwnershipTransfer(BigInt(txId), { from: walletClient.account.address });
    } else {
      return manager.cancelBroadcasterUpdate(BigInt(txId), { from: walletClient.account.address });
    }
  }

  return {
    validateAndLoadContract,
    transferOwnership,
    updateBroadcaster,
    signBroadcasterUpdate,
    signTransferOwnership,
    approveOperation,
    cancelOperation
  }
} 