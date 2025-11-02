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
  AppWindow,
  ChevronDown,
  Settings,
  AlertTriangle,
  ShieldAlert,
  Clock3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSecureOwnable } from '@/hooks/useSecureOwnable'
import { useToast } from '../components/ui/use-toast'
import { SecureContractInfo } from '@/lib/types'
import { isValidEthereumAddress, generateNewWorkflowManager, convertBigIntsToStrings } from '@/lib/utils'
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
import { useMetaTransactionManager } from '@/hooks/useMetaTransactionManager'
import { SecureOwnable } from '../Guardian/sdk/typescript'
import { TemporalActionDialog } from '@/components/security/TemporalActionDialog'
import { TxRecord, TxStatus } from '@/Guardian/sdk/typescript'
import { MetaTxActionDialog } from '@/components/security/MetaTxActionDialog'
import { TransactionManagerProvider } from '@/contexts/MetaTransactionManager'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { ContractInfo } from '@/components/ContractInfo'
import { WalletStatusBadge } from '@/components/WalletStatusBadge'
import { SignedMetaTxTable } from '@/components/SignedMetaTxTable'
import { BroadcastDialog } from '@/components/security/BroadcastDialog'
import { ExtendedSignedTransaction } from '@/components/SignedMetaTxTable'
import { MetaTransactionManager } from '@/services/MetaTransactionManager'
import { Hex } from 'viem'
import { useOperationTypes } from '@/hooks/useOperationTypes'
import { CoreOperationType, operationRegistry } from '@/types/OperationRegistry'
import type { BroadcastActionType } from '@/components/security/BroadcastDialog'
import { OPERATION_TYPES } from '@/Guardian/sdk/typescript'
import { Address } from 'viem'
import { useGlobalTransactionMonitor } from '@/hooks/useGlobalTransactionMonitor'

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
  if (isNaN(numValue) || numValue < 0) return 0;
  
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
  const { getOperationName } = useOperationTypes(contractAddress as `0x${string}`)
  const { address: connectedAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const navigate = useNavigate()
  const { 
    monitor: networkDebugger, 
    executeTransactionSimple,
    executeWithMonitoring,
    logContractState
  } = useGlobalTransactionMonitor()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { transactions = {}, storeTransaction, clearTransactions, removeTransaction } = useMetaTransactionManager(contractAddress || '')
  const [signedTransactions, setSignedTransactions] = useState<ExtendedSignedTransaction[]>([])
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | null>(null)
  const { validateAndLoadContract } = useSecureOwnable()
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

  // Add state for Broadcast Dialog
  const [showBroadcastTimelockDialog, setShowBroadcastTimelockDialog] = useState(false)
  const [showBroadcastRecoveryDialog, setShowBroadcastRecoveryDialog] = useState(false)
  const [showBroadcastOwnershipDialog, setShowBroadcastOwnershipDialog] = useState(false)
  const [showBroadcastBroadcasterDialog, setShowBroadcastBroadcasterDialog] = useState(false)
  const [activeBroadcastTx, setActiveBroadcastTx] = useState<ExtendedSignedTransaction | null>(null)

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

  // Add a function to fetch operation history directly from contract
  const fetchOperationHistory = async () => {
    if (!contractAddress || !publicClient || !contractInfo) return;

    try {
      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      const contract = new SecureOwnable(
        publicClient,
        undefined,
        contractAddress as `0x${string}`,
        chain
      );

      // Get operation history directly from contract
      // Start from 1 since 0 gets converted to 1 anyway, and we need fromTxId < toTxId
      const operationHistory = await contract.getTransactionHistory(BigInt(1), BigInt(100));
      console.log('Fresh operation history:', operationHistory);

      // Update contract info with fresh operation history
      setContractInfo(prevInfo => {
        if (!prevInfo) return prevInfo;
        // Only update if the operation history actually changed
        const currentLength = prevInfo.operationHistory?.length || 0;
        const newLength = operationHistory?.length || 0;
        if (currentLength === newLength && 
            JSON.stringify(prevInfo.operationHistory) === JSON.stringify(operationHistory)) {
          return prevInfo; // Return same reference if no change
        }
        return {
          ...prevInfo,
          operationHistory: operationHistory || []
        };
      });

      // Find pending transactions in operation history
      if (operationHistory) {
        // Find first pending ownership transfer
        const pendingOwnership = operationHistory.find(
          (tx: TxRecord) => tx.status === TxStatus.PENDING && 
               tx.params.operationType === OPERATION_TYPES.OWNERSHIP_TRANSFER
        );

        // Find first pending broadcaster update
        const pendingBroadcaster = operationHistory.find(
          (tx: TxRecord) => tx.status === TxStatus.PENDING && 
               tx.params.operationType === OPERATION_TYPES.BROADCASTER_UPDATE
        );

        console.log('Found pending ownership tx:', pendingOwnership);
        console.log('Found pending broadcaster tx:', pendingBroadcaster);

        setPendingOwnershipTx(pendingOwnership || null);
        setPendingBroadcasterTx(pendingBroadcaster || null);
      }
    } catch (error) {
      console.error('Error fetching operation history:', error);
      
      // If contract call fails due to permission issues, show empty history
      // This is expected behavior when the caller doesn't have the required roles
      console.log('Contract call failed - likely due to missing role permissions. Showing empty history.');
      
      // Update contract info with empty operation history
      setContractInfo(prevInfo => {
        if (!prevInfo) return prevInfo;
        // Only update if the operation history actually changed
        const currentLength = prevInfo.operationHistory?.length || 0;
        if (currentLength === 0) {
          return prevInfo; // Return same reference if already empty
        }
        return {
          ...prevInfo,
          operationHistory: []
        };
      });
      
      setPendingOwnershipTx(null);
      setPendingBroadcasterTx(null);
    }
  };

  // Add effect to refresh data periodically
  useEffect(() => {
    if (!contractAddress) return;

    const refreshInterval = setInterval(() => {
      fetchOperationHistory();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [contractAddress]);

  // Update the loadContractInfo function to use fetchOperationHistory
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
      
      setContractInfo(info);
      setError(null);

      // Fetch operation history after setting contract info
      await fetchOperationHistory();
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
  }, [loading, isLoadingHistory, pendingOwnershipTx, pendingBroadcasterTx, contractInfo?.operationHistory?.length]);

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
      // Log transaction start
      if (networkDebugger) {
        await logContractState(contractInfo.address as `0x${string}`, 'Ownership Transfer Request')
        networkDebugger.logTransactionStart('Ownership Transfer Request', {
          from: connectedAddress,
          contract: contractInfo.address
        })
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractInfo.address as `0x${string}`,
        chain,
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'RECOVERY_UPDATE',
          purpose: 'ownership_transfer',
          action: 'approve',
          broadcasted: false 
        })
      );
      
      // Request the ownership transfer operation with enhanced debugging
      const tx = await executeTransactionSimple(
        async () => {
          return await workflowManager.requestOperation(
            CoreOperationType.OWNERSHIP_TRANSFER,
            {}, // No additional parameters needed for ownership transfer
            { from: connectedAddress as `0x${string}` }
          )
        },
        'Ownership Transfer Request',
        'SecurityDetails'
      )

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: tx })

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
      
      // Log transaction error
      if (networkDebugger) {
        networkDebugger.logTransactionError('Ownership Transfer Request', error)
      }
      
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

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Approve the ownership transfer operation with enhanced debugging
      const result = await executeTransactionSimple(
        async () => {
          return await workflowManager.approveOperation(
            CoreOperationType.OWNERSHIP_TRANSFER,
            BigInt(txId),
            { from: connectedAddress as `0x${string}` }
          )
        },
        'Ownership Transfer Approval',
        'SecurityDetails'
      )
      
      await publicClient.waitForTransactionReceipt({ hash: result })

      toast({
        title: "Success",
        description: "Ownership transfer approved successfully",
      });

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

  const handleOwnershipTransferCancellation = async (txId: number) => {
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

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Check if the connected wallet is the recovery address for ownership transfer
      if (!isRoleConnected(contractInfo.recoveryAddress)) {
        throw new Error('Only the recovery address can cancel ownership transfer');
      }

      const cancelHash = await workflowManager.cancelOperation(
        CoreOperationType.OWNERSHIP_TRANSFER,
        BigInt(txId),
        { from: connectedAddress as Address }
      );
      
      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: cancelHash })

      // Don't call handleOperationSuccess here as it's called in the onCancel callback
    } catch (error) {
      console.error('Error in ownership transfer cancellation:', error);
      // Show error toast
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel ownership transfer',
        variant: 'destructive',
      });
    }
  }

  const handleUpdateBroadcasterRequest = async (newBroadcaster: string) => {
    try {
      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      // Log transaction start
      if (networkDebugger) {
        await logContractState(contractAddress as `0x${string}`, 'Broadcaster Update Request')
        networkDebugger.logTransactionStart('Broadcaster Update Request', {
          from: connectedAddress,
          newBroadcaster,
          contract: contractAddress
        })
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Request the broadcaster update operation with enhanced debugging
      const hash = await executeTransactionSimple(
        async () => {
          return await workflowManager.requestOperation(
            CoreOperationType.BROADCASTER_UPDATE,
            { newBroadcaster: newBroadcaster as `0x${string}` },
            { from: connectedAddress as `0x${string}` }
          )
        },
        'Broadcaster Update Request',
        'SecurityDetails'
      )
      
      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash })

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
      
      // Log transaction error
      if (networkDebugger) {
        networkDebugger.logTransactionError('Broadcaster Update Request', error)
      }
      
      toast({
        title: "Error",
        description: "Failed to submit broadcaster update request.",
        variant: "destructive"
      });
    }
  };

  const handleApproveOperation = async (txId: number) => {
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

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Find the transaction in operation history
      const tx = contractInfo.operationHistory.find((tx: TxRecord) => tx.txId === BigInt(txId));
      if (!tx) {
        throw new Error('Transaction not found');
      }

      // Map the operation type hash to the correct CoreOperationType
      let operationType: CoreOperationType;
      const operationName = getOperationName(tx.params.operationType);
      
      if (operationName.includes('OWNERSHIP')) {
        operationType = CoreOperationType.OWNERSHIP_TRANSFER;
      } else if (operationName.includes('BROADCASTER')) {
        operationType = CoreOperationType.BROADCASTER_UPDATE;
      } else if (operationName.includes('RECOVERY')) {
        operationType = CoreOperationType.RECOVERY_UPDATE;
      } else if (operationName.includes('TIMELOCK')) {
        operationType = CoreOperationType.TIMELOCK_UPDATE;
      } else {
        throw new Error(`Unsupported operation type: ${operationName}`);
      }

      // Approve the operation with enhanced debugging
      const hash = await executeTransactionSimple(
        async () => {
          return await workflowManager.approveOperation(
            operationType,
            BigInt(txId),
            { from: connectedAddress as `0x${string}` }
          )
        },
        `${operationName} Approval`,
        'SecurityDetails'
      )
      
      await publicClient.waitForTransactionReceipt({ hash })
      
      toast({
        title: "Success",
        description: "Operation approved successfully",
      });

      await loadContractInfo();
    } catch (error) {
      console.error('Error approving operation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve operation",
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

      // Log transaction start
      if (networkDebugger) {
        await logContractState(contractAddress as `0x${string}`, 'Recovery Update Request')
        networkDebugger.logTransactionStart('Recovery Update Request', {
          from: connectedAddress,
          newRecoveryAddress,
          contract: contractAddress
        })
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Set signing state before any wallet interaction
      setIsSigningTx(true);
      
      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'RECOVERY_UPDATE',
          purpose: 'address_update',
          action: 'requestAndApprove',
          broadcasted: false 
        })
      );

      // Prepare and sign the recovery update transaction
      await workflowManager.prepareAndSignSinglePhaseOperation(
        CoreOperationType.RECOVERY_UPDATE,
        { newRecoveryAddress: newRecoveryAddress as `0x${string}` },
        { from: connectedAddress as `0x${string}` }
      );

      // Log success
      if (networkDebugger) {
        networkDebugger.logTransactionSuccess('Recovery Update Request', 'Meta-transaction signed and stored')
      }

      toast({
        title: "Success",
        description: "Recovery update transaction signed and stored",
      });

    } catch (error) {
      console.error('Error in recovery update:', error);
      
      // Log transaction error
      if (networkDebugger) {
        networkDebugger.logTransactionError('Recovery Update Request', error)
      }
      
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

      // Log transaction start
      if (networkDebugger) {
        await logContractState(contractAddress as `0x${string}`, 'TimeLock Update Request')
        networkDebugger.logTransactionStart('TimeLock Update Request', {
          from: connectedAddress,
          newPeriod,
          timeLockUnit,
          contract: contractAddress
        })
      }

      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Convert the period to minutes based on the selected unit
      const periodInMinutes = convertToMinutes(newPeriod, timeLockUnit);
      if (isNaN(periodInMinutes) || periodInMinutes < TIMELOCK_PERIODS.MIN || periodInMinutes > TIMELOCK_PERIODS.MAX) {
        throw new Error(`Period must be between ${formatTimeValue(TIMELOCK_PERIODS.MIN)} and ${formatTimeValue(TIMELOCK_PERIODS.MAX)}`);
      }

      // Set signing state before any wallet interaction
      setIsSigningTx(true);
      
      // Create parameter object with BigInt value
      const params = { 
        newTimeLockPeriodInMinutes: BigInt(periodInMinutes) 
      };
      
      // Convert BigInt values to strings for metadata
      const metadataParams = convertBigIntsToStrings(params);
      
      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        (txId, signedData, metadata) => storeTransaction(txId, signedData, { 
          ...metadata, 
          type: 'TIMELOCK_UPDATE', 
          purpose: 'timelock_period',
          action: 'requestAndApprove',
          broadcasted: false,
          newTimeLockPeriodInMinutes: metadataParams.newTimeLockPeriodInMinutes,
          originalValue: newPeriod,
          originalUnit: timeLockUnit,
          convertedMinutes: periodInMinutes
        })
      );

      // Prepare and sign the timelock update transaction
      await workflowManager.prepareAndSignSinglePhaseOperation(
        CoreOperationType.TIMELOCK_UPDATE,
        params,
        { from: connectedAddress as `0x${string}` }
      );

      // Log success
      if (networkDebugger) {
        networkDebugger.logTransactionSuccess('TimeLock Update Request', 'Meta-transaction signed and stored')
      }

      toast({
        title: "Success",
        description: "TimeLock period update transaction signed and stored",
      });

    } catch (error) {
      console.error('Error in timelock update:', error);
      
      // Log transaction error
      if (networkDebugger) {
        networkDebugger.logTransactionError('TimeLock Update Request', error)
      }
      
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
  const handleBroadcast = async (type: BroadcastActionType) => {
    try {
      const pendingTx = activeBroadcastTx;

      if (!pendingTx) {
        throw new Error('No pending transaction found');
      }

      if (!contractInfo || !connectedAddress || !contractAddress || !publicClient || !walletClient) {
        throw new Error('Wallet not connected or missing required information');
      }

      console.log('Broadcasting transaction:', pendingTx);
      console.log('Transaction type:', type);
      console.log('pendingTx metadata:', pendingTx.metadata);
      
      // Extract the action type from metadata or determine based on operation type
      let action: 'approve' | 'cancel' | 'requestAndApprove';

      const chain = config.chains.find((c) => c.id === contractInfo?.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      // Initialize WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Map the transaction type to CoreOperationType
      let operationType: CoreOperationType;
      
      // Convert type to string for comparison
      const typeStr = String(type);
      
      // Determine the correct CoreOperationType based on the transaction type
      if (typeStr === 'OWNERSHIP_TRANSFER' || 
          (pendingTx.metadata?.type === 'RECOVERY_UPDATE' && pendingTx.metadata?.purpose === 'ownership_transfer')) {
        operationType = CoreOperationType.OWNERSHIP_TRANSFER;
        // Multi-phase operation - use action from metadata or default to 'approve'
        action = (pendingTx.metadata?.action as 'approve' | 'cancel') || 'approve';
      } else if (typeStr === 'BROADCASTER_UPDATE') {
        operationType = CoreOperationType.BROADCASTER_UPDATE;
        // Multi-phase operation - use action from metadata or default to 'approve'
        action = (pendingTx.metadata?.action as 'approve' | 'cancel') || 'approve';
      } else if (typeStr === 'RECOVERY_UPDATE') {
        operationType = CoreOperationType.RECOVERY_UPDATE;
        // Single-phase operation - must use 'requestAndApprove'
        action = 'requestAndApprove';
      } else if (typeStr === 'TIMELOCK_UPDATE') {
        operationType = CoreOperationType.TIMELOCK_UPDATE;
        // Single-phase operation - must use 'requestAndApprove'
        action = 'requestAndApprove';
      } else {
        throw new Error(`Unsupported operation type: ${type}`);
      }
      
      console.log('Using operation type for execution:', operationType);
      console.log('Using action type:', action);
      
      // Execute the meta-transaction using WorkflowManager
      const txHash = await workflowManager.executeMetaTransaction(
        pendingTx.signedData,
        operationType,
        action,
        { from: connectedAddress as `0x${string}` }
      );
      
      console.log('txHash', txHash);
      toast({
        title: "Transaction Submitted",
        description: "Transaction has been submitted to the network",
      });
      
      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      // Remove the broadcasted transaction from local storage
      removeTransaction(pendingTx.txId);
      
      // Update local state to remove the broadcasted transaction
      setSignedTransactions(prev => prev.filter(tx => tx.txId !== pendingTx.txId));

      // Clear the active transaction
      setActiveBroadcastTx(null);

      // Close the appropriate dialog
      switch (type) {
        case 'TIMELOCK_UPDATE':
          setShowBroadcastTimelockDialog(false);
          break;
        case 'RECOVERY_UPDATE':
          setShowBroadcastRecoveryDialog(false);
          break;
        case 'OWNERSHIP_TRANSFER':
          setShowBroadcastOwnershipDialog(false);
          break;
        case 'BROADCASTER_UPDATE':
          setShowBroadcastBroadcasterDialog(false);
          break;
      }

      // Refresh contract info
      await loadContractInfo();
    } catch (error: any) {
      console.error('Error in broadcast:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to broadcast transaction",
        variant: "destructive"
      });
    }
  };

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

      // Create and initialize the WorkflowManager
      const workflowManager = await generateNewWorkflowManager(
        publicClient,
        walletClient,
        contractAddress as `0x${string}`,
        chain,
        storeTransaction
      );

      // Get the operation type from the transaction
      const operationType = CoreOperationType.BROADCASTER_UPDATE;
      const operation = operationRegistry.getOperation(operationType);
      
      if (!operation) {
        throw new Error(`Unknown operation type: ${operationType}`);
      }

      // Check if the connected wallet has the required role for cancellation
      const requiredRole = operation.requiredRoles.cancel;
      let hasRequiredRole = false;

      if (Array.isArray(requiredRole)) {
        // If multiple roles are allowed, check if user has any of them
        hasRequiredRole = requiredRole.some(role => {
          if (role === 'owner') return isRoleConnected(contractInfo.owner);
          if (role === 'recovery') return isRoleConnected(contractInfo.recoveryAddress);
          if (role === 'broadcaster') return isRoleConnected(contractInfo.broadcaster);
          return false;
        });
      } else {
        // If single role is required, check if user has that role
        if (requiredRole === 'owner') hasRequiredRole = isRoleConnected(contractInfo.owner);
        else if (requiredRole === 'recovery') hasRequiredRole = isRoleConnected(contractInfo.recoveryAddress);
        else if (requiredRole === 'broadcaster') hasRequiredRole = isRoleConnected(contractInfo.broadcaster);
      }

      if (!hasRequiredRole) {
        throw new Error(`Only ${requiredRole} can cancel ${operation.name.toLowerCase()}`);
      }

      const cancelHash = await workflowManager.cancelOperation(
        operationType,
        BigInt(txId),
        { from: connectedAddress as Address }
      );
      
      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: cancelHash })

      // Refresh data after successful cancellation
      await handleOperationSuccess();
    } catch (error) {
      console.error('Error in operation cancellation:', error);
      // Show error toast
      toast({
        title: 'Operation Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel operation',
        variant: 'destructive',
      });
    }
  }

  // Prepare the broadcast dialog for a specific transaction type
  const prepareBroadcastDialog = (
    type: BroadcastActionType,
    specificTx?: ExtendedSignedTransaction
  ) => {
    // Skip if already processing a transaction
    if (activeBroadcastTx) {
      console.log('Already processing a transaction, skipping');
      return;
    }

    console.log('Preparing broadcast dialog for type:', type);
    console.log('Specific transaction:', specificTx);
    
    // If a specific transaction is provided, use it directly
    if (specificTx) {
      console.log('Using specific transaction:', specificTx);
      setActiveBroadcastTx(specificTx);
    } else {
      // Find the matching unsigned transaction
      // Each transaction type is now treated independently to avoid overriding
      let pendingTx: ExtendedSignedTransaction | undefined;
      
      if (type === 'OWNERSHIP_TRANSFER') {
        // For ownership transfer, look for either OWNERSHIP_TRANSFER or RECOVERY_UPDATE with purpose=ownership_transfer
        pendingTx = signedTransactions.find(tx => 
          (!tx.metadata?.broadcasted) && (
            (tx.metadata?.type === 'OWNERSHIP_TRANSFER') || 
            (tx.metadata?.type === 'RECOVERY_UPDATE' && tx.metadata?.purpose === 'ownership_transfer')
          )
        );
      } else if (type === 'RECOVERY_UPDATE') {
        // For recovery updates, look for RECOVERY_UPDATE type
        pendingTx = signedTransactions.find(tx => 
          tx.metadata?.type === 'RECOVERY_UPDATE' && 
          !tx.metadata?.broadcasted && 
          (tx.metadata?.purpose !== 'ownership_transfer')
        );
      } else if (type === 'TIMELOCK_UPDATE') {
        // For timelock updates, look for exact TIMELOCK_UPDATE type 
        pendingTx = signedTransactions.find(tx => 
          tx.metadata?.type === 'TIMELOCK_UPDATE' && 
          !tx.metadata?.broadcasted
        );
      } else if (type === 'BROADCASTER_UPDATE') {
        // For broadcaster updates
        pendingTx = signedTransactions.find(tx => 
          tx.metadata?.type === 'BROADCASTER_UPDATE' && 
          !tx.metadata?.broadcasted
        );
      }

      if (pendingTx) {
        console.log('Found pending transaction:', pendingTx);
        setActiveBroadcastTx(pendingTx);
      } else {
        console.log('No pending transaction found for type:', type);
        return; // Don't open dialog if no transaction found
      }
    }
    
    // Open the appropriate dialog based on type
    switch (type) {
      case 'TIMELOCK_UPDATE':
        setShowBroadcastTimelockDialog(true);
        break;
      case 'RECOVERY_UPDATE':
        setShowBroadcastRecoveryDialog(true);
        break;
      case 'OWNERSHIP_TRANSFER':  
        setShowBroadcastOwnershipDialog(true);
        break;
      case 'BROADCASTER_UPDATE':
        setShowBroadcastBroadcasterDialog(true);
        break;
    }
  };

  // Add handlers for dialog close
  const handleTimelockDialogClose = (open: boolean) => {
    setShowBroadcastTimelockDialog(open);
    if (!open) setActiveBroadcastTx(null);
  };

  const handleRecoveryDialogClose = (open: boolean) => {
    setShowBroadcastRecoveryDialog(open);
    if (!open) setActiveBroadcastTx(null);
  };

  const handleOwnershipDialogClose = (open: boolean) => {
    setShowBroadcastOwnershipDialog(open);
    if (!open) setActiveBroadcastTx(null);
  };

  const handleBroadcasterDialogClose = (open: boolean) => {
    setShowBroadcastBroadcasterDialog(open);
    if (!open) setActiveBroadcastTx(null);
  };

  // Add after loadContractInfo function
  const refreshSignedTransactions = () => {
    try {
      // Get the latest transactions from MetaTransactionManager
      if (contractAddress) {
        const txManager = new MetaTransactionManager();
        const latestTxs = txManager.getSignedTransactionsByContract(contractAddress);
        
        // Convert to array format
        const txArray = Object.entries(latestTxs).map(([txId, tx]) => ({
          txId,
          signedData: tx.signedData,
          timestamp: tx.timestamp,
          metadata: tx.metadata as ExtendedSignedTransaction['metadata']
        }));
        
        setSignedTransactions(txArray);
      }
    } catch (error) {
      console.error('Error refreshing signed transactions:', error);
    }
  };

  // Filter out withdrawal transactions from signed transactions
  const filteredSignedTransactions = signedTransactions.filter(tx => {
    // Only show core operations
    const coreOperations = [
      'OWNERSHIP_TRANSFER',
      'BROADCASTER_UPDATE',
      'RECOVERY_UPDATE',
      'TIMELOCK_UPDATE'
    ];
    
    return coreOperations.includes(tx.metadata?.type || '');
  });

  // Update the handleOperationSuccess function
  const handleOperationSuccess = async () => {
    try {
      // Wait a short time for blockchain to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch fresh operation history
      await fetchOperationHistory();
      
      // Refresh signed transactions
      refreshSignedTransactions();
      
      // Show success toast
      toast({
        title: "Success",
        description: "Operation completed successfully",
      });
    } catch (error) {
      console.error('Error refreshing after operation:', error);
      toast({
        title: "Error",
        description: "Failed to refresh data after operation",
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
                <WalletStatusBadge
                  connectedAddress={connectedAddress}
                  contractInfo={contractInfo}
                  onDisconnect={handleDisconnect}
                />
              )}
            </div>
          </motion.div>

          {/* Contract Info */}
          <motion.div variants={item} className="grid gap-6">
            <ContractInfo 
              address={contractAddress}
              contractInfo={contractInfo} 
              connectedAddress={connectedAddress} 
              onConnect={handleConnect}
              navigationIcon={<AppWindow className="h-4 w-4" />}
              navigationTooltip="View Blox Data"
              navigateTo={contractInfo?.type ? `/blox/${contractInfo.type}/${contractAddress}` : `/blox/simple-vault/${contractAddress}`}            />

            {/* Management Tiles */}
            <div className="grid lg:grid-cols-2 gap-8">
          

              {/* Configuration Management Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">Configuration Management</h2>
                </div>
                
                <div className="grid gap-4">
                  {/* TimeLock Management */}
                  <Collapsible open={timelockExpanded} onOpenChange={setTimelockExpanded}>
                    <Card className="relative overflow-hidden border-l-4 border-l-blue-500 dark:border-l-blue-600">
                      <CollapsibleTrigger asChild>
                        <div className="w-full p-6 flex items-center justify-between cursor-pointer hover:bg-accent/50 hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Clock3 className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base">TimeLock Configuration</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Manage security delay periods
                              </p>
                            </div>
                            {signedTransactions.some(tx => 
                              tx.metadata?.type === 'TIMELOCK_UPDATE' && 
                              !tx.metadata?.broadcasted
                            ) && (
                              <Badge variant="default" className="ml-4 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Network className="h-3 w-3" />
                                    <span>Meta Tx</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Single-phase meta transaction security</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [data-state=open]:-rotate-180" />
                          </div>
                        </div>
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
                                  onClick={() => prepareBroadcastDialog('TIMELOCK_UPDATE')}
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
                            description={`Enter a new time lock period. Current period is ${formatTimeValue(contractInfo.timeLockPeriodInMinutes)}. Valid range: ${formatTimeValue(TIMELOCK_PERIODS.MIN)} to ${formatTimeValue(TIMELOCK_PERIODS.MAX)}.`}
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
                              const minutes = convertToMinutes(value, timeLockUnit);
                              if (minutes === 0) {
                                return {
                                  isValid: false,
                                  message: "Please enter a valid positive number"
                                };
                              }
                              
                              return {
                                isValid: minutes >= TIMELOCK_PERIODS.MIN && minutes <= TIMELOCK_PERIODS.MAX,
                                message: `Please enter a period between ${formatTimeValue(TIMELOCK_PERIODS.MIN)} and ${formatTimeValue(TIMELOCK_PERIODS.MAX)}`
                              };
                            }}
                            onSubmit={async () => {
                              const minutes = convertToMinutes(newTimeLockPeriod, timeLockUnit);
                              await handleUpdateTimeLockRequest(minutes.toString());
                              setShowTimeLockDialog(false);
                              // Refresh data after operation
                              await loadContractInfo();
                              refreshSignedTransactions();
                            }}
                            timeLockUnit={timeLockUnit}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

                  {/* Broadcaster Management */}
                  <Collapsible open={broadcasterExpanded} onOpenChange={setBroadcasterExpanded}>
                    <Card className="relative overflow-hidden border-l-4 border-l-purple-500 dark:border-l-purple-600">
                      <CollapsibleTrigger asChild>
                        <div className="w-full p-6 flex items-center justify-between cursor-pointer hover:bg-accent/50 hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                              <Radio className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base">Broadcaster Configuration</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Manage transaction broadcasters
                              </p>
                            </div>
                            {(pendingBroadcasterTx || signedTransactions.some(tx => 
                              tx.metadata?.type === 'BROADCASTER_UPDATE' && 
                              !tx.metadata?.broadcasted
                            )) && (
                              <Badge variant="default" className="ml-4 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
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
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [data-state=open]:-rotate-180" />
                          </div>
                        </div>
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
                                      onClick={() => prepareBroadcastDialog('BROADCASTER_UPDATE')}
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
                                onSubmit={async (newBroadcaster) => {
                                  await handleUpdateBroadcasterRequest(newBroadcaster);
                                  setShowBroadcasterDialog(false);
                                  // Refresh data after operation
                                  await loadContractInfo();
                                  refreshSignedTransactions();
                                }}
                                onApprove={handleApproveOperation}
                                onCancel={handleUpdateBroadcasterCancellation}
                              />
                            </>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </div>

                  {/* Emergency Management Section */}
                  <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight">Recovery Management</h2>
                </div>
                
                <div className="grid gap-4">
                  {/* Recovery Configuration */}
                  <Collapsible open={recoveryExpanded} onOpenChange={setRecoveryExpanded}>
                    <Card className="relative overflow-hidden border-l-4 border-l-amber-500 dark:border-l-amber-600">
                      <CollapsibleTrigger asChild>
                        <div className="w-full p-6 flex items-center justify-between cursor-pointer hover:bg-accent/50 hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <Key className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base">Recovery Configuration</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Update recovery address and permissions
                              </p>
                            </div>
                            {signedTransactions.some(tx => 
                              tx.metadata?.type === 'RECOVERY_UPDATE' && 
                              !tx.metadata?.broadcasted
                            ) && (
                              <Badge variant="default" className="ml-4 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Network className="h-3 w-3" />
                                    <span>Meta Tx</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Single-phase meta transaction security</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [data-state=open]:-rotate-180" />
                          </div>
                        </div>
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
                                    <Key className="h-3 w-3 mr-1" />
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
                                  onClick={() => prepareBroadcastDialog('RECOVERY_UPDATE')}
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
                            onSubmit={async () => {
                              await handleUpdateRecoveryRequest(newRecoveryAddress);
                              setShowRecoveryDialog(false);
                              // Refresh data after operation
                              await loadContractInfo();
                              refreshSignedTransactions();
                            }}
                          />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                  {/* Ownership Management */}
                  <Collapsible open={ownershipExpanded} onOpenChange={setOwnershipExpanded}>
                    <Card className="relative overflow-hidden border-l-4 border-l-red-500 dark:border-l-red-600">
                      <CollapsibleTrigger asChild>
                        <div className="w-full p-6 flex items-center justify-between cursor-pointer hover:bg-accent/50 hover:text-accent-foreground transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                              <ShieldAlert className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base">Recovery (Transfer Ownership)</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Emergency ownership transfer process
                              </p>
                            </div>
                            {(pendingOwnershipTx || signedTransactions.some(tx => 
                              tx.metadata?.type === 'OWNERSHIP_TRANSFER' && 
                              !tx.metadata?.broadcasted
                            )) && (
                              <Badge variant="default" className="ml-4 bg-red-500/10 text-red-500 hover:bg-red-500/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Action Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
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
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [data-state=open]:-rotate-180" />
                          </div>
                        </div>
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
                                      <Badge variant="default" className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
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
                                    <div className="mb-3 flex items-center gap-2">
                                      <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                                        <Shield className="h-3 w-3 mr-1" />
                                        Owner
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">or</span>
                                      <Badge variant="default" className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
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
                                      onClick={() => prepareBroadcastDialog('OWNERSHIP_TRANSFER')}
                                      className={`w-full ${signedTransactions.some(tx => 
                                        tx.metadata?.type === 'OWNERSHIP_TRANSFER' && 
                                        !tx.metadata?.broadcasted
                                      ) ? 'border-2 border-yellow-500 dark:border-yellow-600' : ''}`}
                                      size="sm"
                                      variant={signedTransactions.some(tx => 
                                        tx.metadata?.type === 'OWNERSHIP_TRANSFER' && 
                                        !tx.metadata?.broadcasted
                                      ) ? "default" : "outline"}
                                      disabled={!signedTransactions.some(tx => tx.metadata?.type === 'OWNERSHIP_TRANSFER' && !tx.metadata?.broadcasted) || !isRoleConnected(contractInfo.broadcaster)}
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
                                            <Badge variant="default" className="bg-red-500/10 text-red-500">
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
                                        <Badge variant="default" className="bg-red-500/10 text-red-500">
                                          <Key className="h-3 w-3 mr-1" />
                                          Recovery
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
                                onSubmit={async () => {
                                  await handleTransferOwnershipRequest();
                                  setShowOwnershipDialog(false);
                                  await handleOperationSuccess();
                                }}
                                onApprove={handleTransferOwnershipApproval}
                                onCancel={async (txId) => {
                                  try {
                                    await handleOwnershipTransferCancellation(txId);
                                    setShowOwnershipDialog(false);
                                    await handleOperationSuccess();
                                  } catch (error) {
                                    console.error('Error in ownership cancellation:', error);
                                    // Show error toast if needed
                                  }
                                }}
                                showMetaTxOption={!!(pendingOwnershipTx && isRoleConnected(contractInfo.owner))}
                                metaTxDescription="Sign a meta transaction to approve the ownership transfer. This will be broadcasted by the broadcaster."
                                refreshData={handleOperationSuccess}
                                refreshSignedTransactions={refreshSignedTransactions}
                              />
                            </>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Signed Meta Transactions Table */}
          <motion.div variants={item} className="mt-6">
            <SignedMetaTxTable
              transactions={filteredSignedTransactions}
              onClearAll={() => {
                try {
                  clearTransactions()
                  setSignedTransactions([])
                  toast({
                    title: "Success",
                    description: "All pending transactions cleared",
                  })
                } catch (error) {
                  console.error('Error clearing transactions:', error)
                  toast({
                    title: "Error",
                    description: "Failed to clear transactions",
                    variant: "destructive"
                  })
                }
              }}
              onRemoveTransaction={(txId) => {
                try {
                  if (!contractAddress) return
                  removeTransaction(txId)
                  setSignedTransactions(prev => prev.filter(tx => tx.txId !== txId))
                  toast({
                    title: "Success",
                    description: "Transaction removed",
                  })
                } catch (error) {
                  console.error('Error removing transaction:', error)
                  toast({
                    title: "Error",
                    description: "Failed to remove transaction",
                    variant: "destructive"
                  })
                }
              }}
              contractAddress={contractAddress as `0x${string}`}
              onTxClick={(tx: ExtendedSignedTransaction) => {
                console.log('Transaction clicked:', tx);
                if (!tx.metadata?.type) {
                  console.log('No transaction type found');
                  return;
                }
                
                // For RECOVERY_UPDATE, we need to check the purpose
                if (tx.metadata.type === 'RECOVERY_UPDATE') {
                  if (tx.metadata.purpose === 'ownership_transfer') {
                    console.log('Opening ownership transfer dialog');
                    prepareBroadcastDialog('OWNERSHIP_TRANSFER', tx);
                  } else {
                    console.log('Opening recovery update dialog');
                    prepareBroadcastDialog('RECOVERY_UPDATE', tx);
                  }
                } else {
                  console.log('Opening dialog for type:', tx.metadata.type);
                  prepareBroadcastDialog(tx.metadata.type, tx);
                }
              }}
            />
          </motion.div>

          {/* Operation History Section */}
          <motion.div variants={item} className="mt-6">
            <OpHistory
              isLoading={loading}
              contractInfo={contractInfo}
              signedTransactions={filteredSignedTransactions as any}
              onApprove={handleApproveOperation}
              onCancel={(txId) => {
                // Get the operation type from the transaction
                const tx = contractInfo?.operationHistory?.find((op: TxRecord) => op.txId.toString() === txId.toString());
                if (tx) {
                  const operationName = getOperationName(tx.params.operationType as Hex);
                  if (operationName === 'OWNERSHIP_TRANSFER') {
                    return handleOwnershipTransferCancellation(txId);
                  } else if (operationName === 'BROADCASTER_UPDATE') {
                    return handleUpdateBroadcasterCancellation(txId);
                  }
                }
                // Default to broadcaster update cancellation for backward compatibility
                return handleUpdateBroadcasterCancellation(txId);
              }}
              refreshData={loadContractInfo}
              refreshSignedTransactions={refreshSignedTransactions}
              contractAddress={contractAddress as `0x${string}`}
              operations={contractInfo?.operationHistory?.filter((op: TxRecord) => {
                const operationName = getOperationName(op.params.operationType as Hex);
                return [
                  'OWNERSHIP_TRANSFER',
                  'BROADCASTER_UPDATE',
                  'RECOVERY_UPDATE',
                  'TIMELOCK_UPDATE'
                ].includes(operationName);
              }) || []}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Broadcast Dialogs */}
      {/* Timelock update broadcast dialog */}
      <BroadcastDialog
        isOpen={showBroadcastTimelockDialog}
        onOpenChange={handleTimelockDialogClose}
        title="Broadcast Timelock Update"
        description="Broadcast the signed timelock update transaction to the blockchain."
        contractInfo={{
          chainId: contractInfo?.chainId || 0,
          chainName: contractInfo?.chainName || '',
          broadcaster: contractInfo?.broadcaster || '',
          owner: contractInfo?.owner || '',
          contractAddress: contractAddress
        }}
        actionType="TIMELOCK_UPDATE"
        onBroadcast={handleBroadcast}
        pendingTx={activeBroadcastTx || undefined}
        connectedAddress={connectedAddress}
        operationName="Time Lock Update"
      />

      {/* Recovery update broadcast dialog */}
      <BroadcastDialog
        isOpen={showBroadcastRecoveryDialog}
        onOpenChange={handleRecoveryDialogClose}
        title="Broadcast Recovery Update"
        description="Broadcast the signed recovery address update transaction to the blockchain."
        contractInfo={{
          chainId: contractInfo?.chainId || 0,
          chainName: contractInfo?.chainName || '',
          broadcaster: contractInfo?.broadcaster || '',
          owner: contractInfo?.owner || '',
          contractAddress: contractAddress
        }}
        actionType="RECOVERY_UPDATE"
        onBroadcast={handleBroadcast}
        pendingTx={activeBroadcastTx || undefined}
        connectedAddress={connectedAddress}
        operationName="Recovery Update"
      />

      {/* Ownership transfer broadcast dialog */}
      <BroadcastDialog
        isOpen={showBroadcastOwnershipDialog}
        onOpenChange={handleOwnershipDialogClose}
        title="Broadcast Ownership Transfer"
        description="Broadcast the signed ownership transfer transaction to the blockchain."
        contractInfo={{
          chainId: contractInfo?.chainId || 0,
          chainName: contractInfo?.chainName || '',
          broadcaster: contractInfo?.broadcaster || '',
          owner: contractInfo?.owner || '',
          contractAddress: contractAddress
        }}
        actionType="OWNERSHIP_TRANSFER"
        onBroadcast={handleBroadcast}
        pendingTx={activeBroadcastTx || undefined}
        connectedAddress={connectedAddress}
        operationName="Ownership Transfer"
      />

      {/* Broadcaster update broadcast dialog */}
      <BroadcastDialog
        isOpen={showBroadcastBroadcasterDialog}
        onOpenChange={handleBroadcasterDialogClose}
        title="Broadcast Broadcaster Update"
        description="Broadcast the signed broadcaster update transaction to the blockchain."
        contractInfo={{
          chainId: contractInfo?.chainId || 0,
          chainName: contractInfo?.chainName || '',
          broadcaster: contractInfo?.broadcaster || '',
          owner: contractInfo?.owner || '',
          contractAddress: contractAddress
        }}
        actionType="BROADCASTER_UPDATE"
        onBroadcast={handleBroadcast}
        pendingTx={activeBroadcastTx || undefined}
        connectedAddress={connectedAddress}
        operationName="Broadcaster Update"
      />

    </TransactionManagerProvider>
  )
}