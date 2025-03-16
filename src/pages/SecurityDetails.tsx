import { useAccount, useDisconnect, usePublicClient, useWalletClient, useConfig } from 'wagmi'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Key,
  Radio,
  Clock,
  Shield,
  Wallet,
  Timer,
  Network,
  SwitchCamera,
  Copy,
  Eye,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSecureContract } from '@/hooks/useSecureContract'
import { useToast } from '../components/ui/use-toast'
import { SecureContractInfo } from '@/lib/types'
import { isValidEthereumAddress, generateNewSecureOwnableManager } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { TIMELOCK_PERIODS } from '@/constants/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { OpHistory } from '@/components/OpHistory'
import { useTransactionManager } from '@/hooks/useTransactionManager'
import { SecureOwnable } from '../particle-core/sdk/typescript/SecureOwnable'
import { FUNCTION_SELECTORS } from '../particle-core/sdk/typescript/types/core.access.index'
import { TemporalActionDialog } from '@/components/TemporalActionDialog'
import { MetaTransaction, TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '@/particle-core/sdk/typescript/types/lib.index'
import { MetaTxActionDialog } from '@/components/MetaTxActionDialog'
import { TransactionManagerProvider } from '@/contexts/TransactionManager'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"

interface ExtendedSignedTransaction {
  txId: string
  signedData: string
  timestamp: number
  metadata?: {
    type: 'RECOVERY_UPDATE' | 'TIMELOCK_UPDATE' | 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE'
    purpose?: 'address_update' | 'ownership_transfer'
    action?: 'approve' | 'cancel'
    broadcasted: boolean
  }
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

const formatTimeValue = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  if (isNaN(numValue)) return value.toString();
  
  // Convert to days/hours/minutes format
  const days = Math.floor(numValue / 1440);
  const hours = Math.floor((numValue % 1440) / 60);
  const minutes = numValue % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);

  return parts.join(' ');
};

const convertToMinutes = (value: string, unit: 'days' | 'hours' | 'minutes'): number => {
  const numValue = parseInt(value);
  if (isNaN(numValue)) return 0;
  
  switch (unit) {
    case 'days':
      return numValue * 24 * 60;
    case 'hours':
      return numValue * 60;
    case 'minutes':
      return numValue;
    default:
      return numValue;
  }
};

export function SecurityDetails() {
  const { address: contractAddress } = useParams<{ address: string }>()
  const { address: connectedAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { transactions = {}, storeTransaction } = useTransactionManager(contractAddress || '')
  const [signedTransactions, setSignedTransactions] = useState<ExtendedSignedTransaction[]>([])
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | null>(null)
  const { validateAndLoadContract, updateBroadcaster, approveOperation } = useSecureContract()
  const { toast } = useToast()
  const { openConnectModal } = useConnectModal()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const config = useConfig()

  // State for input fields
  const [newRecoveryAddress, setNewRecoveryAddress] = useState('')
  const [newTimeLockPeriod, setNewTimeLockPeriod] = useState('')
  const [timeLockUnit, setTimeLockUnit] = useState<'days' | 'hours' | 'minutes'>('minutes')
  const [showBroadcasterDialog, setShowBroadcasterDialog] = useState(false)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [showTimeLockDialog, setShowTimeLockDialog] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [isSigningTx, setIsSigningTx] = useState(false);
  const [showOwnershipDialog, setShowOwnershipDialog] = useState(false)
  const [pendingOwnershipTx, setPendingOwnershipTx] = useState<TxRecord | null>(null)
  const [pendingBroadcasterTx, setPendingBroadcasterTx] = useState<TxRecord | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [ownershipExpanded, setOwnershipExpanded] = useState(false)
  const [broadcasterExpanded, setBroadcasterExpanded] = useState(false)
  const [recoveryExpanded, setRecoveryExpanded] = useState(false)
  const [timelockExpanded, setTimelockExpanded] = useState(false)


  useEffect(() => {
    if (!contractAddress) {
      navigate('/blox-security')
      return
    }

    if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid contract address format')
      setLoading(false)
      return
    }

    loadContractInfo()
  }, [contractAddress])

  const loadContractInfo = async () => {
    if (!contractAddress || !publicClient) return;

    setLoading(true);
    setIsLoadingHistory(true);
    setError(null);

    try {
      const info = await validateAndLoadContract(contractAddress as `0x${string}`);
      if (!info) {
        throw new Error('Contract info not found');
      }
      
      console.log('Contract info loaded:', info);
      console.log('Operation history:', info.operationHistory);

      // Get chain information
      const chain = config.chains.find((c) => c.id === info.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create contract instance to get operation types
      const contract = new SecureOwnable(
        publicClient,
        undefined, // We don't need walletClient for read operations
        contractAddress as `0x${string}`,
        chain
      );

      // Get supported operation types
      const supportedTypes = await contract.getSupportedOperationTypes();
      const typeMap = new Map(
        supportedTypes.map(({ operationType, name }) => [operationType, name])
      );
      
      console.log('Operation type mapping:', typeMap);
      
      setContractInfo(info);

      // Find pending transactions in operation history
      if (info.operationHistory) {
        // Find first pending ownership transfer
        const pendingOwnership = info.operationHistory.find(
          (tx: TxRecord) => tx.status === TxStatus.PENDING && 
               typeMap.get(tx.params.operationType) === 'OWNERSHIP_TRANSFER'
        );

        // Find first pending broadcaster update
        const pendingBroadcaster = info.operationHistory.find(
          (tx: TxRecord) => tx.status === TxStatus.PENDING && 
               typeMap.get(tx.params.operationType) === 'BROADCASTER_UPDATE'
        );

        console.log('Found pending ownership tx:', pendingOwnership);
        console.log('Found pending broadcaster tx:', pendingBroadcaster);

        setPendingOwnershipTx(pendingOwnership || null);
        setPendingBroadcasterTx(pendingBroadcaster || null);
      }

      setError(null);
    } catch (error) {
      console.error('Error loading contract:', error);
      if (!contractInfo) {
        setError('Failed to load contract details. Please ensure this is a valid SecureOwnable contract.');
        toast({
          title: "Loading failed",
          description: "Failed to load contract details. Please ensure this is a valid SecureOwnable contract.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
      setIsLoadingHistory(false);
    }
  };

  // Add an effect to log state changes for debugging
  useEffect(() => {
    console.log('State update:', {
      loading,
      isLoadingHistory,
      pendingOwnershipTx,
      pendingBroadcasterTx,
      contractInfo: contractInfo?.operationHistory?.length
    });
  }, [loading, isLoadingHistory, pendingOwnershipTx, pendingBroadcasterTx, contractInfo]);

  // Add an effect to handle transactions updates
  useEffect(() => {
    // Convert the transactions object to an array with the txId
    const txArray = Object.entries(transactions).map(([txId, tx]) => ({
      txId,
      signedData: tx.signedData,
      timestamp: tx.timestamp,
      metadata: tx.metadata as ExtendedSignedTransaction['metadata']
    }))
    setSignedTransactions(txArray)
  }, [transactions])

  // Action handlers
  const handleTransferOwnershipRequest = async (): Promise<void> => {
    if (!contractInfo || !connectedAddress || !publicClient || !walletClient) return;

    try {
      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      const manager = await generateNewSecureOwnableManager(
        publicClient,
        walletClient,
        contractInfo.address,
        chain,
        // Add purpose field to distinguish from recovery address update
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'RECOVERY_UPDATE',
          purpose: 'ownership_transfer',
          action: 'approve',
          broadcasted: false 
        })
      );
      const tx = await manager.transferOwnership({
        from: connectedAddress as `0x${string}`
      });

      await publicClient.waitForTransactionReceipt({ hash: tx });

      toast({
        title: "Request submitted",
        description: "Transfer ownership request has been submitted.",
      });
      
      setTimeout(async () => {
        await loadContractInfo();
      }, 2000);
      
      return;
    } catch (error) {
      console.error('Error submitting transfer ownership request:', error);
      toast({
        title: "Error",
        description: "Failed to submit transfer ownership request.",
        variant: "destructive"
      });
      throw error;
    }
  }

  const handleTransferOwnershipApproval = async (txId: number) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create manager instance with transaction storage
      const manager = await generateNewSecureOwnableManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Check if the connected wallet is recovery address
      const isRecoveryWallet = connectedAddress.toLowerCase() === contractInfo.recoveryAddress.toLowerCase();

      if (isRecoveryWallet) {
        // Recovery wallet must use timelock approval
        const result = await manager.approveOwnershipTransfer(
          BigInt(txId),
          { from: connectedAddress as `0x${string}` }
        );
        await publicClient.waitForTransactionReceipt({ hash: result });
      } else {
        // Owner uses meta transaction approval
        console.log('Preparing and signing ownership approval')
        await manager.prepareAndSignOwnershipApproval(
          BigInt(txId),
          { from: connectedAddress as `0x${string}` }
        );

        toast({
          title: "Success",
          description: "Transfer ownership approval transaction signed and stored",
        });
      }

      await loadContractInfo();
    } catch (error) {
      console.error('Error in ownership transfer approval:', error);
      toast({
        title: "Error",
        description: "Failed to approve transfer ownership.",
        variant: "destructive"
      });
    }
  }

  const handleTransferOwnershipCancellation = async (txId: number) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create contract instance
      const contract = new SecureOwnable(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain
      );

      // Generate meta transaction parameters for cancellation
      const metaTxParams = await contract.createMetaTxParams(
        contractAddress as `0x${string}`,
        FUNCTION_SELECTORS.TRANSFER_OWNERSHIP_CANCEL_META as `0x${string}`,
        BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour deadline
        BigInt(0), // No max gas price
        connectedAddress as `0x${string}`
      );

      // Generate unsigned meta transaction for cancellation
      const unsignedMetaTx = await contract.generateUnsignedMetaTransactionForExisting(
        BigInt(txId),
        metaTxParams
      );

      // Execute the cancellation
      const result = await contract.transferOwnershipCancellationWithMetaTx(
        unsignedMetaTx,
        { from: connectedAddress as `0x${string}` }
      );

      await result.wait();

      toast({
        title: "Cancellation submitted",
        description: "Transfer ownership cancellation has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
      console.error('Error in ownership transfer cancellation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel transfer ownership.",
        variant: "destructive"
      });
    }
  }

  const handleUpdateBroadcasterRequest = async (newBroadcaster: string) => {
    try {
      await updateBroadcaster(contractAddress as `0x${string}`, newBroadcaster as `0x${string}`);
      
      toast({
        title: "Request submitted",
        description: "Broadcaster update request has been submitted.",
      });

      // Add a small delay before reloading contract info to allow transaction to be mined
      setTimeout(async () => {
        await loadContractInfo();
      }, 2000);

    } catch (error) {
      console.error('Error submitting broadcaster update request:', error);
      toast({
        title: "Error",
        description: "Failed to submit broadcaster update request.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateBroadcasterApproval = async (txId: number) => {
    try {
      await approveOperation(contractAddress as `0x${string}`, txId, 'broadcaster');
      toast({
        title: "Approval submitted",
        description: "Broadcaster update approval has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve broadcaster update.",
        variant: "destructive"
      });
    }
  }

  const handleUpdateBroadcasterCancellation = async (txId: number) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create contract instance
      const contract = new SecureOwnable(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain
      );

      // Execute the direct cancellation since we're the owner
      const result = await contract.updateBroadcasterCancellation(
        BigInt(txId),
        { from: connectedAddress as `0x${string}` }
      );

      await result.wait();

      toast({
        title: "Cancellation submitted",
        description: "Broadcaster update cancellation has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
      console.error('Error in broadcaster update cancellation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel broadcaster update.",
        variant: "destructive"
      });
    }
  }

  const handleUpdateRecoveryRequest = async (newRecoveryAddress: string) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      setIsSigningTx(true);
      // Create manager instance with transaction storage
      const manager = await generateNewSecureOwnableManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        // Wrap storeTransaction to include purpose field to distinguish from transfer ownership
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'RECOVERY_UPDATE',
          purpose: 'address_update',
          action: 'approve',
          broadcasted: false 
        })
      );

      // Prepare and sign the recovery update transaction
      await manager.prepareAndSignRecoveryUpdate(
        newRecoveryAddress as `0x${string}`,
        { from: connectedAddress as `0x${string}` }
      );

      toast({
        title: "Success",
        description: "Recovery update transaction signed and stored",
      });

    } catch (error) {
      console.error('Error in recovery update:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update recovery address",
        variant: "destructive"
      });
    } finally {
      setIsSigningTx(false);
    }
  };

  const handleUpdateTimeLockRequest = async (newPeriod: string) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      setIsSigningTx(true);
      // Create manager instance with transaction storage
      const manager = await generateNewSecureOwnableManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        // Wrap storeTransaction to include action field for approval
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'TIMELOCK_UPDATE', 
          action: 'approve',
          broadcasted: false 
        })
      );
      // Prepare and sign the timelock update transaction
      await manager.prepareAndSignTimeLockUpdate(
        BigInt(newPeriod),
        { from: connectedAddress as `0x${string}` }
      );

      toast({
        title: "Success",
        description: "TimeLock period update transaction signed and stored",
      });

    } catch (error) {
      console.error('Error in timelock update:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update timelock period",
        variant: "destructive"
      });
    } finally {
      setIsSigningTx(false);
    }
  };

  // Add this new function to verify the connected wallet matches the intended role
  const verifyConnectedRole = (role: string) => {
    if (!connectedAddress || !contractInfo) return false;
    
    switch (role) {
      case 'owner':
        return connectedAddress.toLowerCase() === contractInfo.owner.toLowerCase();
      case 'broadcaster':
        return connectedAddress.toLowerCase() === contractInfo.broadcaster.toLowerCase();
      case 'recovery':
        return connectedAddress.toLowerCase() === contractInfo.recoveryAddress.toLowerCase();
      default:
        return false;
    }
  };

  // Watch for successful connections
  useEffect(() => {
    if (isConnected && targetRole && connectedAddress) {
      // Only verify and show notifications if we're not in the process of switching wallets
      if (!isConnecting) {
        const isCorrectRole = verifyConnectedRole(targetRole);
        if (isCorrectRole) {
          toast({
            title: "Success",
            description: `Successfully connected ${targetRole} wallet`,
            variant: "default"
          });
        } else {
          toast({
            title: "Wrong Wallet",
            description: `Connected wallet does not match the ${targetRole} address. Please try again with the correct wallet.`,
            variant: "destructive"
          });
          // Disconnect the wrong wallet
          handleDisconnect();
        }
        setTargetRole(null);
      }
    }
  }, [isConnected, connectedAddress, targetRole, isConnecting]);

  const handleConnect = async (role: string) => {
    console.log('Attempting to connect role:', role);
    try {
      // Set the target role we're trying to connect
      setTargetRole(role);
      setIsConnecting(true);
      
      // If already connected, first disconnect
      if (isConnected) {
        console.log('Disconnecting current wallet');
        await disconnect();
        // Small delay to ensure disconnect completes
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Open connect modal
      openConnectModal?.();
    } catch (error) {
      console.error('Error in wallet connection flow:', error);
      toast({
        title: "Connection Error",
        description: "Failed to handle wallet connection",
        variant: "destructive"
      });
      setTargetRole(null);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      // Clear any stored state
      setTargetRole(null);
      setIsConnecting(false);
      
      toast({
        title: "Disconnected",
        description: "Wallet disconnected successfully",
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect wallet",
        variant: "destructive"
      });
    }
  };

  // Watch for disconnect to trigger connect modal
  useEffect(() => {
    if (!isConnected && isConnecting) {
      console.log('Wallet disconnected, opening connect modal');
      openConnectModal?.();
    }
  }, [isConnected, isConnecting, openConnectModal]);

  // Add role validation functions
  const isRoleConnected = (roleAddress: string) => {
    return connectedAddress?.toLowerCase() === roleAddress?.toLowerCase();
  };

  // Update handleBroadcast function to handle both types
  const handleBroadcast = async (type: 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE' | 'RECOVERY_UPDATE' | 'RECOVERY_ADDRESS_UPDATE' | 'TIMELOCK_UPDATE') => {
    try {
      // Find the matching unsigned transaction
      const pendingTx = signedTransactions.find(tx => 
        tx.metadata?.type === type && !tx.metadata?.broadcasted
      );

      if (!pendingTx) {
        throw new Error('No pending transaction found');
      }

      if (!walletClient || !connectedAddress) {
        throw new Error('Wallet not connected');
      }
      console.log('pendingTx', pendingTx);
      console.log('pendingTx signedData', pendingTx.signedData);
      
      // Extract the action type from metadata
      const action = pendingTx.metadata?.action as 'approve' | 'cancel';
      
      if (!action) {
        throw new Error('Action type not found in transaction metadata');
      }
      
      // Parse the signed transaction data
      const signedData = JSON.parse(pendingTx.signedData, (_key: string, value: any): any => {
        if (typeof value === 'string' && /^\d+n$/.test(value)) {
          return BigInt(value.slice(0, -1));
        }
        return value;
      }) as MetaTransaction;

      if (!publicClient) {
        throw new Error('Public client not found');
      }
      const chain = config.chains.find((c) => c.id === contractInfo?.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }
      // Create manager instance with transaction storage
      const manager = await generateNewSecureOwnableManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Map RECOVERY_ADDRESS_UPDATE to RECOVERY_UPDATE for contract interaction
      const contractType = type === 'RECOVERY_ADDRESS_UPDATE' ? 'RECOVERY_UPDATE' : type;
      
      // Prepare and sign the update transaction
      const txHash = await manager.executeMetaTransaction(
        signedData,
        { from: connectedAddress as `0x${string}` },
        contractType,
        action,
      );
      console.log('txHash', txHash);
      toast({
        title: "Success",
        description: "Transaction signed and stored",
      });
      // Wait for transaction confirmation
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      // Update the transaction metadata to mark as broadcasted
      storeTransaction(pendingTx.txId, pendingTx.signedData, {
        ...pendingTx.metadata,
        broadcasted: true
      });

      // Reload contract info after broadcast
      await loadContractInfo();

    } catch (error) {
      console.error('Broadcast error:', error);
      toast({
        title: "Broadcast Failed",
        description: error instanceof Error ? error.message : "Failed to broadcast transaction",
        variant: "destructive"
      });
    }
  };

  if (!contractAddress || error) {
    return (
      <div className="container py-8">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </motion.div>
        </motion.div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container py-8">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item} className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </motion.div>
        </motion.div>
      </div>
    )
  }

  if (!contractInfo) {
    return (
      <div className="container py-8">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Button
              variant="ghost"
              onClick={() => navigate('/blox-security')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Security Center
            </Button>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Contract not found or not a valid SecureOwnable contract.</AlertDescription>
            </Alert>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <TransactionManagerProvider>
      <div className="container py-8 min-h-screen flex flex-col">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col space-y-8 flex-1"
        >
          {/* Header */}
          <motion.div variants={item} className="flex flex-col gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-[64px] z-40 w-full">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start lg:items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  className="mr-4 hidden lg:flex"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="space-y-3 lg:space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => navigate('/dashboard')}
                      className="lg:hidden h-8 w-8 p-0"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Security Details</h1>
                  </div>
                 
                </div>
              </div>
              {connectedAddress && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-card rounded-lg px-4 py-2 border shadow-sm shrink-0"
                >
                  <div className="flex flex-col items-start">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {isRoleConnected(contractInfo.owner) && (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 font-medium">
                          <Shield className="h-3 w-3 mr-1" />
                          Owner
                        </Badge>
                      )}
                      {isRoleConnected(contractInfo.broadcaster) && (
                        <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 font-medium">
                          <Radio className="h-3 w-3 mr-1" />
                          Broadcaster
                        </Badge>
                      )}
                      {isRoleConnected(contractInfo.recoveryAddress) && (
                        <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 font-medium">
                          <Key className="h-3 w-3 mr-1" />
                          Recovery
                        </Badge>
                      )}
                      {!isRoleConnected(contractInfo.owner) && 
                       !isRoleConnected(contractInfo.broadcaster) && 
                       !isRoleConnected(contractInfo.recoveryAddress) && (
                        <Badge variant="default" className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 font-medium">
                          <Eye className="h-3 w-3 mr-1" />
                          Observer
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono text-xs">Wallet</Badge>
                      <p className="text-xs text-muted-foreground font-mono">
                        {connectedAddress.slice(0, 6)}...{connectedAddress.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="h-8 w-[1px] bg-border/50" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-muted"
                          onClick={handleDisconnect}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Disconnect wallet</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Contract Info */}
          <motion.div variants={item} className="grid gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2">Contract Information</h2>
              <div className="flex mb-6 flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono shrink-0">
                        Contract
                      </Badge>
                      <p className="text-muted-foreground font-mono text-sm truncate">
                        {contractAddress}
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => navigator.clipboard.writeText(contractAddress)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy address</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="hidden sm:block h-4 w-[1px] bg-border shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-mono">
                        Roles
                      </Badge>
                      <div className="flex -space-x-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <div className="h-2 w-2 rounded-full bg-purple-500" />
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                      <span className="text-sm text-muted-foreground">3 Total</span>
                    </div>
                    <div className="hidden sm:block h-4 w-[1px] bg-border shrink-0" />

                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono shrink-0">
                        TimeLock
                      </Badge>
                      <div className="flex items-center text-muted-foreground font-mono text-sm truncate">
                        <Clock className="h-3 w-3 mr-1" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              <span>{formatTimeValue(contractInfo.timeLockPeriodInMinutes)}</span>
                              {contractInfo.timeLockPeriodInMinutes >= 1440 && ( // 1440 minutes = 1 day
                                  <span className="text-xs opacity-50">({contractInfo.timeLockPeriodInMinutes} min)</span>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>TimeLock Period</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>


                  
                  </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Owner</p>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contractInfo.owner}</p>
                        </div>
                        {isRoleConnected(contractInfo.owner) ? (
                          <Badge variant="default" className="bg-blue-500/10 text-blue-500 shrink-0">Connected</Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => handleConnect('owner')}
                                >
                                  <SwitchCamera className="h-3 w-3 mr-1" />
                                  Connect
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Switch to owner wallet</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Broadcaster</p>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contractInfo.broadcaster}</p>
                        </div>
                        {isRoleConnected(contractInfo.broadcaster) ? (
                          <Badge variant="default" className="bg-purple-500/10 text-purple-500 shrink-0">Connected</Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => handleConnect('broadcaster')}
                                >
                                  <SwitchCamera className="h-3 w-3 mr-1" />
                                  Connect
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Switch to broadcaster wallet</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Recovery</p>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contractInfo.recoveryAddress}</p>
                        </div>
                        {isRoleConnected(contractInfo.recoveryAddress) ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-500 shrink-0">Connected</Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => handleConnect('recovery')}
                                >
                                  <SwitchCamera className="h-3 w-3 mr-1" />
                                  Connect
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Switch to recovery wallet</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                   
                  </div>
                </div>
              </div>
            </Card>

            {/* Management Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Ownership Management */}
              <Collapsible open={ownershipExpanded} onOpenChange={setOwnershipExpanded}>
                <Card className="relative overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle>Recovery (Transfer Ownership)</CardTitle>
                          {(pendingOwnershipTx || signedTransactions.some(tx => 
                            tx.metadata?.type === 'RECOVERY_UPDATE' && 
                            tx.metadata?.purpose === 'ownership_transfer' && 
                            !tx.metadata?.broadcasted
                          )) && (
                            <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  <span>Temporal</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Two-phase temporal security</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-6">
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-8">
                            {/* Step 1 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
                                  <span className="text-sm font-bold text-primary">1</span>
                                </div>
                                <h3 className="font-medium">Request Transfer</h3>
                              </div>
                              
                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                                    <Key className="h-3 w-3 mr-1" />
                                    Recovery
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">required to initiate ownership transfer</span>
                                </div>

                                <Button 
                                  onClick={() => setShowOwnershipDialog(true)}
                                  className="w-full"
                                  size="sm"
                                  variant={!pendingOwnershipTx && isRoleConnected(contractInfo.recoveryAddress) ? "default" : "outline"}
                                  disabled={!!pendingOwnershipTx || !isRoleConnected(contractInfo.recoveryAddress)}
                                >
                                  <Wallet className="h-4 w-4 mr-2" />
                                  Request Transfer
                                </Button>
                              </div>

                              {/* Step connector */}
                              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                            </div>

                            {/* Step 2 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${pendingOwnershipTx ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                                  <span className={`text-sm font-bold ${pendingOwnershipTx ? 'text-primary' : 'text-muted-foreground'}`}>2</span>
                                </div>
                                <h3 className="font-medium">Approve Transfer</h3>
                              </div>

                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2 flex-wrap">
                                  <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Owner
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">or</span>
                                  <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                                    <Key className="h-3 w-3 mr-1" />
                                    Recovery
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">must approve the transfer</span>
                                </div>

                                <Button 
                                  onClick={() => setShowOwnershipDialog(true)}
                                  className="w-full"
                                  size="sm"
                                  variant={!!pendingOwnershipTx && (isRoleConnected(contractInfo.owner) || isRoleConnected(contractInfo.recoveryAddress)) ? "default" : "outline"}
                                  disabled={!pendingOwnershipTx || !(isRoleConnected(contractInfo.owner) || isRoleConnected(contractInfo.recoveryAddress))}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Approve Transfer
                                </Button>
                              </div>

                              {/* Step connector */}
                              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                            </div>

                            {/* Step 3 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                                  <span className={`text-sm font-bold ${signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? 'text-primary' : 'text-muted-foreground'}`}>3</span>
                                </div>
                                <h3 className="font-medium">Broadcast Transaction</h3>
                              </div>

                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                                    <Radio className="h-3 w-3 mr-1" />
                                    Broadcaster
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">submits the transaction to network</span>
                                </div>

                                <Button 
                                  onClick={() => handleBroadcast('RECOVERY_UPDATE')}
                                  className={`w-full ${signedTransactions.some(tx => 
                                    tx.metadata?.type === 'RECOVERY_UPDATE' && 
                                    tx.metadata?.purpose === 'ownership_transfer' && 
                                    !tx.metadata?.broadcasted
                                  ) ? 'border-2 border-yellow-500 dark:border-yellow-600' : ''}`}
                                  size="sm"
                                  variant={signedTransactions.some(tx => 
                                    tx.metadata?.type === 'RECOVERY_UPDATE' && 
                                    tx.metadata?.purpose === 'ownership_transfer' && 
                                    !tx.metadata?.broadcasted
                                  ) ? "default" : "outline"}
                                  disabled={!signedTransactions.some(tx => 
                                    tx.metadata?.type === 'RECOVERY_UPDATE' && 
                                    tx.metadata?.purpose === 'ownership_transfer' && 
                                    !tx.metadata?.broadcasted
                                  ) || !isRoleConnected(contractInfo.broadcaster)}
                                >
                                  <Radio className="h-4 w-4 mr-2" />
                                  Broadcast
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Next Step Indicator - Ownership Management */}
                          {pendingOwnershipTx && (
                            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Next Required Action:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isRoleConnected(contractInfo.owner) || isRoleConnected(contractInfo.recoveryAddress) ? (
                                  <div className="flex items-center gap-2">
                                    {isRoleConnected(contractInfo.owner) ? (
                                      <div className="flex items-center gap-2">
                                        <Badge variant="default" className="bg-blue-500/10 text-blue-500">
                                          <Shield className="h-3 w-3 mr-1" />
                                          Owner
                                        </Badge>
                                        <span className="text-sm">approval required</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <Badge variant="default" className="bg-green-500/10 text-green-500">
                                          <Key className="h-3 w-3 mr-1" />
                                          Recovery
                                        </Badge>
                                        <span className="text-sm">approval required</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-blue-500/10 text-blue-500">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Owner
                                    </Badge>
                                    <span className="text-sm">connection required</span>
                                    <span className="text-sm text-muted-foreground">or</span>
                                    <Badge variant="default" className="bg-green-500/10 text-green-500">
                                      <Key className="h-3 w-3 mr-1" />
                                      Recovery
                                    </Badge>
                                    <span className="text-sm">connection required</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) && (
                            <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium text-yellow-500">Pending Broadcast:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isRoleConnected(contractInfo.broadcaster) ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                      <Radio className="h-3 w-3 mr-1" />
                                      Broadcaster
                                    </Badge>
                                    <span className="text-sm">ready to broadcast</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                      <Radio className="h-3 w-3 mr-1" />
                                      Broadcaster
                                    </Badge>
                                    <span className="text-sm">connection required</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <TemporalActionDialog
                            isOpen={showOwnershipDialog}
                            onOpenChange={setShowOwnershipDialog}
                            title="Transfer Ownership"
                            contractInfo={{
                              ...contractInfo,
                              contractAddress: contractAddress || ''
                            }}
                            actionType="ownership"
                            currentValue={contractInfo?.owner}
                            currentValueLabel="Current Owner"
                            actionLabel={pendingOwnershipTx ? "Sign Meta Transaction" : "Request Transfer"}
                            requiredRole={pendingOwnershipTx ? "owner_or_recovery" : "recovery"}
                            connectedAddress={connectedAddress}
                            pendingTx={pendingOwnershipTx || undefined}
                            showNewValueInput={false}
                            onSubmit={async () => handleTransferOwnershipRequest()}
                            onApprove={handleTransferOwnershipApproval}
                            onCancel={handleTransferOwnershipCancellation}
                            showMetaTxOption={!!(pendingOwnershipTx && isRoleConnected(contractInfo.owner))}
                            metaTxDescription="Sign a meta transaction to approve the ownership transfer. This will be broadcasted by the broadcaster."
                          />
                        </>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Broadcaster Management */}
              <Collapsible open={broadcasterExpanded} onOpenChange={setBroadcasterExpanded}>
                <Card className="relative overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle>Broadcaster Configuration</CardTitle>
                          {(pendingBroadcasterTx || signedTransactions.some(tx => 
                            tx.metadata?.type === 'BROADCASTER_UPDATE' && 
                            !tx.metadata?.broadcasted
                          )) && (
                            <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  <span>Temporal</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Two-phase temporal security</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-6">
                      {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-8">
                            {/* Step 1 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
                                  <span className="text-sm font-bold text-primary">1</span>
                                </div>
                                <h3 className="font-medium">Request Update</h3>
                              </div>
                              
                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Owner
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">initiates broadcaster change</span>
                                </div>

                                <Button 
                                  onClick={() => setShowBroadcasterDialog(true)}
                                  className="w-full"
                                  size="sm"
                                  variant={!pendingBroadcasterTx && isRoleConnected(contractInfo.owner) ? "default" : "outline"}
                                  disabled={!!pendingBroadcasterTx || !isRoleConnected(contractInfo.owner)}
                                >
                                  <Wallet className="h-4 w-4 mr-2" />
                                  Request Update
                                </Button>
                              </div>

                              {/* Step connector */}
                              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                            </div>

                            {/* Step 2 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${pendingBroadcasterTx ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                                  <span className={`text-sm font-bold ${pendingBroadcasterTx ? 'text-primary' : 'text-muted-foreground'}`}>2</span>
                                </div>
                                <h3 className="font-medium">Approve Update</h3>
                              </div>

                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Owner
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">confirms after timelock period</span>
                                </div>

                                <Button 
                                  onClick={() => setShowBroadcasterDialog(true)}
                                  className="w-full"
                                  size="sm"
                                  variant={!!pendingBroadcasterTx && isRoleConnected(contractInfo.owner) ? "default" : "outline"}
                                  disabled={!pendingBroadcasterTx || !isRoleConnected(contractInfo.owner)}
                                >
                                  <Shield className="h-4 w-4 mr-2" />
                                  Approve Update
                                </Button>
                              </div>

                              {/* Step connector */}
                              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                            </div>

                            {/* Step 3 */}
                            <div className="relative">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                                  <span className={`text-sm font-bold ${signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) ? 'text-primary' : 'text-muted-foreground'}`}>3</span>
                                </div>
                                <h3 className="font-medium">Broadcast Transaction</h3>
                              </div>

                              <div className="pl-12">
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                                    <Radio className="h-3 w-3 mr-1" />
                                    Broadcaster
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">executes the update</span>
                                </div>

                                <Button 
                                  onClick={() => handleBroadcast('BROADCASTER_UPDATE')}
                                  className={`w-full ${signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) ? 'border-2 border-yellow-500 dark:border-yellow-600' : ''}`}
                                  size="sm"
                                  variant={signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) ? "default" : "outline"}
                                  disabled={!signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) || !isRoleConnected(contractInfo.broadcaster)}
                                >
                                  <Radio className="h-4 w-4 mr-2" />
                                  Broadcast
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Next Step Indicator - Broadcaster Management */}
                          {pendingBroadcasterTx && (
                            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Next Required Action:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isRoleConnected(contractInfo.owner) ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-blue-500/10 text-blue-500">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Owner
                                    </Badge>
                                    <span className="text-sm">approval required</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-blue-500/10 text-blue-500">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Owner
                                    </Badge>
                                    <span className="text-sm">connection required</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {signedTransactions.some(tx => tx.metadata?.type === 'BROADCASTER_UPDATE' && !tx.metadata?.broadcasted) && (
                            <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium text-yellow-500">Pending Broadcast:</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isRoleConnected(contractInfo.broadcaster) ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                      <Radio className="h-3 w-3 mr-1" />
                                      Broadcaster
                                    </Badge>
                                    <span className="text-sm">ready to broadcast</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                      <Radio className="h-3 w-3 mr-1" />
                                      Broadcaster
                                    </Badge>
                                    <span className="text-sm">connection required</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <TemporalActionDialog
                            isOpen={showBroadcasterDialog}
                            onOpenChange={setShowBroadcasterDialog}
                            title="Update Broadcaster"
                            contractInfo={{
                              ...contractInfo,
                              contractAddress: contractAddress || ''
                            }}
                            actionType="broadcaster"
                            currentValue={contractInfo?.broadcaster}
                            currentValueLabel="Current Broadcaster"
                            actionLabel={pendingBroadcasterTx ? "Approve Update" : "Request Update"}
                            requiredRole={pendingBroadcasterTx ? "owner" : "owner"}
                            connectedAddress={connectedAddress}
                            pendingTx={pendingBroadcasterTx || undefined}
                            showNewValueInput={true}
                            newValueLabel="New Broadcaster Address"
                            newValuePlaceholder="Enter new broadcaster address"
                            onSubmit={handleUpdateBroadcasterRequest}
                            onApprove={handleUpdateBroadcasterApproval}
                            onCancel={handleUpdateBroadcasterCancellation}
                          />
                        </>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Recovery Management */}
              <Collapsible open={recoveryExpanded} onOpenChange={setRecoveryExpanded}>
                <Card className="relative overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle>Recovery Configuration</CardTitle>
                          {signedTransactions.some(tx => 
                            tx.metadata?.type === 'RECOVERY_UPDATE' && 
                            tx.metadata?.purpose === 'address_update' && 
                            !tx.metadata?.broadcasted
                          ) && (
                            <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Network className="h-3 w-3" />
                                  <span>Meta Tx</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Single-phase meta tx security</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-6">
                      <div className="space-y-8">
                        {/* Step 1 */}
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
                              <span className="text-sm font-bold text-primary">1</span>
                            </div>
                            <h3 className="font-medium">Sign Meta Transaction</h3>
                          </div>
                          
                          <div className="pl-12">
                            <div className="mb-3 flex items-center gap-2">
                              <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                <Shield className="h-3 w-3 mr-1" />
                                Owner
                              </Badge>
                              <span className="text-sm text-muted-foreground">signs meta-transaction</span>
                            </div>

                            <Button 
                              onClick={() => setShowRecoveryDialog(true)}
                              className="w-full"
                              size="sm"
                              variant={isRoleConnected(contractInfo.owner) && !isSigningTx ? "default" : "outline"}
                              disabled={!isRoleConnected(contractInfo.owner) || isSigningTx}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              {isSigningTx ? "Signing..." : "Update Recovery"}
                            </Button>
                          </div>

                          {/* Step connector */}
                          <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                              <span className={`text-sm font-bold ${signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? 'text-primary' : 'text-muted-foreground'}`}>2</span>
                            </div>
                            <h3 className="font-medium">Broadcast Transaction</h3>
                          </div>

                          <div className="pl-12">
                            <div className="mb-3 flex items-center gap-2">
                              <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                                <Radio className="h-3 w-3 mr-1" />
                                Broadcaster
                              </Badge>
                              <span className="text-sm text-muted-foreground">executes the update</span>
                            </div>

                            <Button 
                              onClick={() => handleBroadcast('RECOVERY_UPDATE')}
                              className={`w-full ${signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? 'border-2 border-yellow-500 dark:border-yellow-600' : ''}`}
                              size="sm"
                              variant={signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) ? "default" : "outline"}
                              disabled={!signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) || !isRoleConnected(contractInfo.broadcaster)}
                            >
                              <Radio className="h-4 w-4 mr-2" />
                              Broadcast
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Next Step Indicator - Recovery Management */}
                      {signedTransactions.some(tx => tx.metadata?.type === 'RECOVERY_UPDATE' && !tx.metadata?.broadcasted) && (
                        <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-yellow-500">Pending Broadcast:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isRoleConnected(contractInfo.broadcaster) ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                  <Radio className="h-3 w-3 mr-1" />
                                  Broadcaster
                                </Badge>
                                <span className="text-sm">ready to broadcast</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                  <Radio className="h-3 w-3 mr-1" />
                                  Broadcaster
                                </Badge>
                                <span className="text-sm">connection required</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <MetaTxActionDialog
                        isOpen={showRecoveryDialog}
                        onOpenChange={setShowRecoveryDialog}
                        title="Update Recovery Address"
                        description="Update the recovery address for this contract. This will be executed via meta-transaction."
                        contractInfo={contractInfo}
                        actionType="recovery"
                        currentValue={contractInfo.recoveryAddress}
                        currentValueLabel="Current Recovery Address"
                        actionLabel={isSigningTx ? "Signing..." : "Sign Transaction"}
                        requiredRole="owner"
                        connectedAddress={connectedAddress}
                        newValue={newRecoveryAddress}
                        onNewValueChange={setNewRecoveryAddress}
                        newValueLabel="New Recovery Address"
                        newValuePlaceholder="Enter new recovery address"
                        validateNewValue={(value) => ({
                          isValid: isValidEthereumAddress(value),
                          message: "Please enter a valid Ethereum address"
                        })}
                        isSigning={isSigningTx}
                        onSubmit={handleUpdateRecoveryRequest}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* TimeLock Management */}
              <Collapsible open={timelockExpanded} onOpenChange={setTimelockExpanded}>
                <Card className="relative overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle>TimeLock Configuration</CardTitle>
                          {signedTransactions.some(tx => 
                            tx.metadata?.type === 'TIMELOCK_UPDATE' && 
                            !tx.metadata?.broadcasted
                          ) && (
                            <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Network className="h-3 w-3" />
                                  <span>Meta Tx</span>
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Single-phase meta tx security</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-6">
                      <div className="space-y-8">
                        {/* Step 1 */}
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border-2 border-primary">
                              <span className="text-sm font-bold text-primary">1</span>
                            </div>
                            <h3 className="font-medium">Sign Meta Transaction</h3>
                          </div>
                          
                          <div className="pl-12">
                            <div className="mb-3 flex items-center gap-2">
                              <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                <Shield className="h-3 w-3 mr-1" />
                                Owner
                              </Badge>
                              <span className="text-sm text-muted-foreground">signs meta-transaction</span>
                            </div>

                            <Button 
                              onClick={() => setShowTimeLockDialog(true)}
                              className="w-full"
                              size="sm"
                              variant={isRoleConnected(contractInfo.owner) && !isSigningTx ? "default" : "outline"}
                              disabled={!isRoleConnected(contractInfo.owner) || isSigningTx}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Update TimeLock
                            </Button>
                          </div>

                          {/* Step connector */}
                          <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-border" />
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) ? 'bg-primary/10 border-2 border-primary' : 'bg-muted border-2'}`}>
                              <span className={`text-sm font-bold ${signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) ? 'text-primary' : 'text-muted-foreground'}`}>2</span>
                            </div>
                            <h3 className="font-medium">Broadcast Transaction</h3>
                          </div>

                          <div className="pl-12">
                            <div className="mb-3 flex items-center gap-2">
                              <Badge variant="default" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                                <Radio className="h-3 w-3 mr-1" />
                                Broadcaster
                              </Badge>
                              <span className="text-sm text-muted-foreground">executes the update</span>
                            </div>

                            <Button 
                              onClick={() => handleBroadcast('TIMELOCK_UPDATE')}
                              className={`w-full ${signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) ? 'border-2 border-yellow-500 dark:border-yellow-600' : ''}`}
                              size="sm"
                              variant={signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) ? "default" : "outline"}
                              disabled={!signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) || !isRoleConnected(contractInfo.broadcaster)}
                            >
                              <Radio className="h-4 w-4 mr-2" />
                              Broadcast
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Next Step Indicator - TimeLock Management */}
                      {signedTransactions.some(tx => tx.metadata?.type === 'TIMELOCK_UPDATE' && !tx.metadata?.broadcasted) && (
                        <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-yellow-500">Pending Broadcast:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isRoleConnected(contractInfo.broadcaster) ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                  <Radio className="h-3 w-3 mr-1" />
                                  Broadcaster
                                </Badge>
                                <span className="text-sm">ready to broadcast</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-purple-500/10 text-purple-500">
                                  <Radio className="h-3 w-3 mr-1" />
                                  Broadcaster
                                </Badge>
                                <span className="text-sm">connection required</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <MetaTxActionDialog
                        isOpen={showTimeLockDialog}
                        onOpenChange={setShowTimeLockDialog}
                        title="Update TimeLock Period"
                        description={`Enter a new time lock period. Minimum ${formatTimeValue(TIMELOCK_PERIODS.MIN)} and maximum ${formatTimeValue(TIMELOCK_PERIODS.MAX)}.`}
                        contractInfo={contractInfo}
                        actionType="timelock"
                        currentValue={formatTimeValue(contractInfo?.timeLockPeriodInMinutes)}
                        currentValueLabel="Current TimeLock Period"
                        actionLabel="Sign Transaction"
                        requiredRole="owner"
                        connectedAddress={connectedAddress}
                        newValue={newTimeLockPeriod}
                        onNewValueChange={setNewTimeLockPeriod}
                        newValueLabel="New TimeLock Period"
                        newValuePlaceholder="Enter period value"
                        customInput={
                          <div className="flex space-x-2">
                            <Input
                              type="number"
                              min="1"
                              className="flex-1"
                              value={newTimeLockPeriod}
                              onChange={(e) => setNewTimeLockPeriod(e.target.value)}
                              placeholder="Enter period value"
                            />
                            <select
                              value={timeLockUnit}
                              onChange={(e) => setTimeLockUnit(e.target.value as 'days' | 'hours' | 'minutes')}
                              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                              <option value="days">Days</option>
                              <option value="hours">Hours</option>
                              <option value="minutes">Minutes</option>
                            </select>
                          </div>
                        }
                        validateNewValue={(value) => {
                          const period = parseInt(value);
                          if (isNaN(period) || period < 1) {
                            return {
                              isValid: false,
                              message: "Please enter a positive number"
                            };
                          }
                          
                          // Convert input to minutes based on selected unit
                          const totalMinutes = convertToMinutes(value, timeLockUnit);
                          
                          return {
                            isValid: totalMinutes >= TIMELOCK_PERIODS.MIN && totalMinutes <= TIMELOCK_PERIODS.MAX,
                            message: `Please enter a period between ${formatTimeValue(TIMELOCK_PERIODS.MIN)} and ${formatTimeValue(TIMELOCK_PERIODS.MAX)}`
                          };
                        }}
                        onSubmit={() => handleUpdateTimeLockRequest(convertToMinutes(newTimeLockPeriod, timeLockUnit).toString())}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>

            {/* Operation History Section */}
            <motion.div variants={item} className="mt-6">
              <OpHistory
                contractAddress={contractAddress as `0x${string}`}
                operations={contractInfo?.operationHistory || []}
                isLoading={loading}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </TransactionManagerProvider>
  )
}