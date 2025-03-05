import { useAccount, useDisconnect } from 'wagmi'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Key,
  Radio,
  Clock,
  Shield,
  Wallet,
  X,
  Timer,
  Network,
  Copy,
  History,
  Hash,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSecureContract } from '@/hooks/useSecureContract'
import { useToast } from '../components/ui/use-toast'
import { Input } from '../components/ui/input'
import { SecureContractInfo } from '@/lib/types'
import { Address } from 'viem'
import { formatAddress, isValidEthereumAddress } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { OperationHistory, UITxRecord } from '@/components/OperationHistory'
import { TxStatus } from '@/particle-core/sdk/typescript/types/lib.index'
import { TxRecord as CoreTxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { Label } from '@/components/ui/label'
import { TIMELOCK_PERIODS } from '@/constants/contract'
import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { MetaTxDialog } from '@/components/MetaTxDialog'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import * as wagmi from 'wagmi'

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

// Add utility function for BigInt conversion
const convertBigIntToNumber = (value: bigint | number): number => {
  if (typeof value === 'bigint') {
    return Number(value)
  }
  return value
}

// Enhanced formatting utilities
const formatHexValue = (value: string): string => {
  // Check if it's a hex string
  if (value.startsWith('0x')) {
    // If it's a small hex (likely an address), just format it
    if (value.length <= 42) {
      return formatAddress(value);
    }
    // For long hex strings, truncate with ellipsis
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
  return value;
};

const formatTimeValue = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  if (isNaN(numValue)) return value.toString();
  
  if (numValue === 0) return '0 minutes';
  if (numValue < 60) return `${numValue} minute${numValue === 1 ? '' : 's'}`;
  if (numValue < 1440) return `${Math.floor(numValue / 60)} hour${Math.floor(numValue / 60) === 1 ? '' : 's'}${numValue % 60 > 0 ? ` ${numValue % 60} minute${numValue % 60 === 1 ? '' : 's'}` : ''}`;
  const days = Math.floor(numValue / 1440);
  const remainingMinutes = numValue % 1440;
  return `${days} day${days === 1 ? '' : 's'}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}` : ''}`;
};

const formatValue = (value: string, type: string): string => {
  if (!value || value === '0x0' || value === '0x') return '-';

  switch (type) {
    case 'ownership_update':
    case 'broadcaster_update':
    case 'recovery_update':
      return formatHexValue(value);
    case 'timelock_update':
      return formatTimeValue(value);
    default:
      return formatHexValue(value);
  }
};

const getOperationTitle = (event: UITxRecord): string => {
  switch (event.type) {
    case 'ownership_update':
      return 'Ownership Transfer';
    case 'broadcaster_update':
      return 'Broadcaster Update';
    case 'recovery_update':
      return 'Recovery Update';
    case 'timelock_update':
      return 'TimeLock Update';
    default:
      return 'Unknown Operation';
  }
};

const getOperationDescription = (event: UITxRecord): string => {
  const newValue = formatValue(event.details.newValue, event.type);
  switch (event.type) {
    case 'ownership_update':
      return `Transfer ownership to ${newValue}`;
    case 'broadcaster_update':
      return `Update broadcaster to ${newValue}`;
    case 'recovery_update':
      return `Update recovery address to ${newValue}`;
    case 'timelock_update':
      return `Update timelock period to ${newValue}`;
    default:
      return event.description;
  }
};

const getOperationIcon = (type: string) => {
  switch (type) {
    case 'ownership_update':
      return <Key className="h-3 w-3" />;
    case 'broadcaster_update':
      return <Radio className="h-3 w-3" />;
    case 'recovery_update':
      return <Shield className="h-3 w-3" />;
    case 'timelock_update':
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
};

function BroadcasterUpdateDialog({
  contractInfo,
  isOpen,
  onOpenChange,
  onSubmit
}: {
  contractInfo: SecureContractInfo | null,
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  onSubmit: (address: string) => Promise<void>
}) {
  const [newBroadcasterAddress, setNewBroadcasterAddress] = useState('')
  const { address } = useAccount()
  const { toast } = useToast()

  const isOwner = address?.toLowerCase() === contractInfo?.owner.toLowerCase()
  const isValidAddress = isValidEthereumAddress(newBroadcasterAddress)

  // Clear input when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewBroadcasterAddress('')
    }
  }, [isOpen])

  return (
    <MetaTxDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Request Broadcaster Update"
      contractInfo={contractInfo}
      walletType="owner"
      currentValue={contractInfo?.broadcaster}
      currentValueLabel="Current Broadcaster"
      actionLabel="Submit Update Request"
      newValue={newBroadcasterAddress}
      onSubmit={async () => {
        if (!isOwner || !isValidAddress) {
          toast({
            title: "Error",
            description: "Please ensure you are the owner and have entered a valid address",
            variant: "destructive"
          })
          return
        }
        
        await onSubmit(newBroadcasterAddress)
      }}
    >
      <div className="space-y-2">
        <Input
          placeholder="New Broadcaster Address"
          value={newBroadcasterAddress}
          onChange={(e) => setNewBroadcasterAddress(e.target.value)}
          className={!isValidAddress && newBroadcasterAddress !== "" ? "border-destructive" : ""}
        />
        {!isValidAddress && newBroadcasterAddress !== "" && (
          <p className="text-sm text-destructive">
            Please enter a valid Ethereum address
          </p>
        )}
        {!isOwner && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only the owner can request broadcaster updates
            </AlertDescription>
          </Alert>
        )}
      </div>
    </MetaTxDialog>
  )
}

// Core event types
interface CoreOperationEvent {
  txId: bigint;
  timestamp: bigint;
  status: number;
  type: string;
  requester: Address;
  target: Address;
  details: {
    oldValue: string | bigint;
    newValue: string | bigint;
    remainingTime: bigint;
  };
  description?: string;
  params?: {
    requester: Address;
    target: Address;
    value: bigint;
    gasLimit: bigint;
    operationType: string;
    executionType: number;
    executionOptions: string;
  };
  result?: string;
  payment?: {
    recipient: Address;
    nativeTokenAmount: bigint;
    erc20TokenAddress: Address;
    erc20TokenAmount: bigint;
  };
}

// Event types from the contract
interface ContractEvent {
  status: string;
  type: string;
  timestamp: string | number;
  description?: string;
  details: {
    oldValue: string;
    newValue: string;
    remainingTime?: string | number;
  };
}

interface TimeLockUpdateEvent extends ContractEvent {
  details: {
    oldValue: string;
    newValue: string;
    remainingTime?: string | number;
  };
}

export function SecurityDetails() {
  const { address: contractAddress } = useParams<{ address: string }>()
  const { address: connectedAddress, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | null>(null)
  const { validateAndLoadContract, updateBroadcaster, approveOperation, cancelOperation } = useSecureContract()
  const { toast } = useToast()
  const { openConnectModal } = useConnectModal()

  // State for input fields
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [newBroadcasterAddress, setNewBroadcasterAddress] = useState('')
  const [newRecoveryAddress, setNewRecoveryAddress] = useState('')
  const [newTimeLockPeriod, setNewTimeLockPeriod] = useState('')
  const [selectedTxId, setSelectedTxId] = useState('')

  const [showConnectRecoveryDialog, setShowConnectRecoveryDialog] = useState(false)
  const [showBroadcasterDialog, setShowBroadcasterDialog] = useState(false)
  const [showBroadcasterApproveDialog, setShowBroadcasterApproveDialog] = useState(false)
  const [showBroadcasterCancelDialog, setShowBroadcasterCancelDialog] = useState(false)
  const [operationHistory, setOperationHistory] = useState<UITxRecord[]>([])
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [showTimeLockDialog, setShowTimeLockDialog] = useState(false)
  const [pendingOperation, setPendingOperation] = useState<UITxRecord | null>(null)
  const [operationType, setOperationType] = useState<'approve' | 'cancel' | null>(null)
  const [isConnecting, setIsConnecting] = useState(false);
  const [targetRole, setTargetRole] = useState<string | null>(null);

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
    if (!contractAddress) return;

    setLoading(true);
    setError(null);

    try {
      const info = await validateAndLoadContract(contractAddress as `0x${string}`);
      if (!info) {
        throw new Error('Contract info not found');
      }
      setContractInfo(info);

      // Convert contract events to TxRecord format
      const pendingOps = info.pendingOperations || [];
      const recentOps = info.recentEvents || [];
      
      // Map events to CoreOperationEvent format with explicit typing
      const allEvents: CoreOperationEvent[] = [...pendingOps, ...recentOps].map((event: ContractEvent) => {
        // Convert status string to number
        let statusNum: number;
        switch (event.status.toLowerCase()) {
          case 'pending':
            statusNum = TxStatus.PENDING;
            break;
          case 'completed':
            statusNum = TxStatus.COMPLETED;
            break;
          case 'cancelled':
            statusNum = TxStatus.CANCELLED;
            break;
          case 'failed':
            statusNum = TxStatus.FAILED;
            break;
          case 'rejected':
            statusNum = TxStatus.REJECTED;
            break;
          default:
            statusNum = TxStatus.UNDEFINED;
        }

        return {
          txId: BigInt(event.details.newValue),
          timestamp: BigInt(event.timestamp),
          status: statusNum,
          type: event.type.toLowerCase(),
          requester: connectedAddress as Address,
          target: connectedAddress as Address,
          details: {
            oldValue: event.details.oldValue,
            newValue: event.details.newValue,
            remainingTime: BigInt(event.details.remainingTime || 0)
          },
          description: event.description
        };
      });
      
      // Convert timeLockPeriodInMinutes to number first
      const timeLockPeriodInMinutes = convertBigIntToNumber(info.timeLockPeriodInMinutes);
      const timeLockPeriodInSeconds = timeLockPeriodInMinutes * 60;
      
      const history: UITxRecord[] = allEvents
        .filter(event => 
          event.details !== undefined &&
          event.details.oldValue !== undefined &&
          event.details.newValue !== undefined &&
          event.details.remainingTime !== undefined
        )
        .map((event) => ({
          txId: Number(event.txId),
          type: event.type,
          description: event.description || getOperationDescription({
            type: event.type,
            details: {
              oldValue: event.details.oldValue.toString(),
              newValue: event.details.newValue.toString(),
              remainingTime: Number(event.details.remainingTime),
              requester: event.requester,
              target: event.target
            }
          } as UITxRecord),
          status: event.status,
          releaseTime: Number(event.timestamp) + timeLockPeriodInSeconds,
          timestamp: Number(event.timestamp),
          details: {
            oldValue: event.details.oldValue.toString(),
            newValue: event.details.newValue.toString(),
            remainingTime: Number(event.details.remainingTime),
            requester: event.requester,
            target: event.target
          }
        }));

      setOperationHistory(history);
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
    }
  };

  // Action handlers
  const handleTransferOwnershipRequest = async () => {
    if (!contractInfo) return

    try {
      // Use the recovery address directly from contractInfo
      const recoveryAddress = contractInfo.recoveryAddress;

      // Implementation with connected recovery wallet
      // TODO: Implement the actual transfer ownership request
      toast({
        title: "Request submitted",
        description: "Transfer ownership request has been submitted.",
      })
      
      // Add a small delay before reloading contract info to allow transaction to be mined
      setTimeout(async () => {
        await loadContractInfo();
      }, 2000);
      
      return true
    } catch (error) {
      console.error('Error submitting transfer ownership request:', error)
      toast({
        title: "Error",
        description: "Failed to submit transfer ownership request.",
        variant: "destructive"
      })
      return false
    }
  }

  const handleTransferOwnershipApproval = async (txId: number) => {
    try {
      await approveOperation(contractAddress as `0x${string}`, txId, 'ownership');
      toast({
        title: "Approval submitted",
        description: "Transfer ownership approval has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve transfer ownership.",
        variant: "destructive"
      });
    }
  }

  const handleTransferOwnershipCancellation = async (txId: number) => {
    try {
      await cancelOperation(contractAddress as `0x${string}`, txId, 'ownership');
      toast({
        title: "Cancellation submitted",
        description: "Transfer ownership cancellation has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
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
      await cancelOperation(contractAddress as `0x${string}`, txId, 'broadcaster');
      toast({
        title: "Cancellation submitted",
        description: "Broadcaster update cancellation has been submitted.",
      });
      await loadContractInfo();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel broadcaster update.",
        variant: "destructive"
      });
    }
  }

  const handleUpdateRecoveryRequest = async (newRecovery: string) => {
    try {
      // Implementation
      toast({
        title: "Request submitted",
        description: "Recovery address update request has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit recovery address update request.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateTimeLockRequest = async (newPeriod: string) => {
    try {
      // Implementation
      toast({
        title: "Request submitted",
        description: "Time lock period update request has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit time lock period update request.",
        variant: "destructive"
      })
    }
  }

  // Handle operation actions
  const handleOperationApprove = async (txId: number, type: string) => {
    const operation = operationHistory.find(op => op.txId === txId)
    if (!operation) return
    
    setPendingOperation(operation)
    setOperationType('approve')
    setShowBroadcasterApproveDialog(true)
  }

  const handleOperationCancel = async (txId: number, type: string) => {
    const operation = operationHistory.find(op => op.txId === txId)
    if (!operation) return
    
    setPendingOperation(operation)
    setOperationType('cancel')
    setShowBroadcasterCancelDialog(true)
  }

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
          // Optionally disconnect the wrong wallet
          disconnect();
        }
        setTargetRole(null);
      }
    }
  }, [isConnected, connectedAddress, targetRole, contractInfo, isConnecting]);

  const handleConnect = async (role: string) => {
    console.log('Attempting to connect role:', role);
    try {
      // Set the target role we're trying to connect
      setTargetRole(role);
      
      if (isConnected) {
        console.log('Disconnecting current wallet');
        setIsConnecting(true);
        disconnect();
      } else {
        console.log('No wallet connected, opening connect modal directly');
        openConnectModal?.();
      }
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

  // Watch for disconnect to trigger connect modal
  useEffect(() => {
    if (!isConnected && isConnecting) {
      console.log('Wallet disconnected, opening connect modal');
      openConnectModal?.();
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting, openConnectModal]);

  // Add role validation functions
  const isRoleConnected = (roleAddress: string) => {
    return connectedAddress?.toLowerCase() === roleAddress?.toLowerCase();
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
    <div className="container py-8 min-h-screen flex flex-col">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8 flex-1"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-start">
          <div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-left">Security Details</h1>
                <p className="mt-2 text-muted-foreground">
                  Manage security settings for contract at {contractAddress}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contract Info */}
        <motion.div variants={item} className="grid gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Contract Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate flex-1">{contractInfo.owner}</p>
                    {isRoleConnected(contractInfo.owner) && (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  <Button 
                    className="w-28 mt-2"
                    variant={isRoleConnected(contractInfo.owner) ? "default" : "outline"}
                    size="sm"
                    disabled={isRoleConnected(contractInfo.owner)}
                    onClick={() => {
                      console.log('Owner connect button clicked');
                      handleConnect('owner');
                    }}
                  >
                    {isRoleConnected(contractInfo.owner) ? "Connected" : "Connect Owner"}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Broadcaster</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate flex-1">{contractInfo.broadcaster}</p>
                    {isRoleConnected(contractInfo.broadcaster) && (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  <Button 
                    className="w-28 mt-2"
                    variant={isRoleConnected(contractInfo.broadcaster) ? "default" : "outline"}
                    size="sm"
                    disabled={isRoleConnected(contractInfo.broadcaster)}
                    onClick={() => {
                      console.log('Broadcaster connect button clicked');
                      handleConnect('broadcaster');
                    }}
                  >
                    {isRoleConnected(contractInfo.broadcaster) ? "Connected" : "Connect Broadcaster"}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovery Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate flex-1">{contractInfo.recoveryAddress}</p>
                    {isRoleConnected(contractInfo.recoveryAddress) && (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  <Button 
                    className="w-28 mt-2"
                    variant={isRoleConnected(contractInfo.recoveryAddress) ? "default" : "outline"}
                    size="sm"
                    disabled={isRoleConnected(contractInfo.recoveryAddress)}
                    onClick={() => {
                      console.log('Recovery connect button clicked');
                      handleConnect('recovery');
                    }}
                  >
                    {isRoleConnected(contractInfo.recoveryAddress) ? "Connected" : "Connect Recovery"}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timelock Period</p>
                  <p className="font-medium">{contractInfo.timeLockPeriodInMinutes} minutes</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Management Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ownership Management */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Ownership</CardTitle>
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
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => {
                    setNewOwnerAddress('');
                    setShowConnectRecoveryDialog(true);
                  }}
                  className="flex items-center gap-2 w-full"
                  size="sm"
                  variant={isRoleConnected(contractInfo.recoveryAddress) ? "default" : "outline"}
                  disabled={!isRoleConnected(contractInfo.recoveryAddress)}
                >
                  <Wallet className="h-4 w-4" />
                  Request Transfer
                </Button>
                
                <MetaTxDialog
                  isOpen={showConnectRecoveryDialog}
                  onOpenChange={setShowConnectRecoveryDialog}
                  title="Transfer Ownership"
                  description="Please connect the recovery wallet to proceed with the ownership transfer request. The ownership will be transferred to the recovery address."
                  contractInfo={contractInfo}
                  walletType="recovery"
                  currentValue={contractInfo?.owner}
                  currentValueLabel="Current Owner"
                  actionLabel="Request Transfer"
                  newValue={contractInfo?.recoveryAddress}
                  onSubmit={async () => {
                    await handleTransferOwnershipRequest();
                    setShowConnectRecoveryDialog(false);
                  }}
                >
                  <div className="space-y-2">
                    <Label>New Owner Address (Recovery Address)</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {contractInfo?.recoveryAddress}
                    </div>
                  </div>
                </MetaTxDialog>
              </CardContent>
            </Card>

            {/* Broadcaster Management */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Broadcaster</CardTitle>
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
              </CardHeader>
              <CardContent>
                <BroadcasterUpdateDialog
                  contractInfo={contractInfo}
                  isOpen={showBroadcasterDialog}
                  onOpenChange={setShowBroadcasterDialog}
                  onSubmit={handleUpdateBroadcasterRequest}
                />
                <Button 
                  onClick={() => setShowBroadcasterDialog(true)}
                  className="flex items-center gap-2 w-full" 
                  size="sm"
                  variant={isRoleConnected(contractInfo.owner) ? "default" : "outline"}
                  disabled={!isRoleConnected(contractInfo.owner)}
                >
                  <Wallet className="h-4 w-4" />
                  Request Update
                </Button>
              </CardContent>
            </Card>

            {/* Recovery Management */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recovery</CardTitle>
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
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => {
                    setNewRecoveryAddress('');
                    setShowRecoveryDialog(true);
                  }}
                  className="flex items-center gap-2 w-full" 
                  size="sm"
                  variant={isRoleConnected(contractInfo.broadcaster) ? "default" : "outline"}
                  disabled={!isRoleConnected(contractInfo.broadcaster)}
                >
                  <Key className="h-4 w-4" />
                  Update
                </Button>
                
                <MetaTxDialog
                  isOpen={showRecoveryDialog}
                  onOpenChange={setShowRecoveryDialog}
                  title="Update Recovery Address"
                  contractInfo={contractInfo}
                  walletType="broadcaster"
                  currentValue={contractInfo.recoveryAddress}
                  currentValueLabel="Current Recovery Address"
                  actionLabel="Submit Update Request"
                  newValue={newRecoveryAddress}
                  onSubmit={async () => {
                    await handleUpdateRecoveryRequest(newRecoveryAddress);
                    setShowRecoveryDialog(false);
                  }}
                >
                  <Input
                    placeholder="New Recovery Address"
                    value={newRecoveryAddress}
                    onChange={(e) => setNewRecoveryAddress(e.target.value)}
                    className={!isValidEthereumAddress(newRecoveryAddress) && newRecoveryAddress !== "" ? "border-destructive" : ""}
                  />
                  {!isValidEthereumAddress(newRecoveryAddress) && newRecoveryAddress !== "" && (
                    <p className="text-sm text-destructive">
                      Please enter a valid Ethereum address
                    </p>
                  )}
                </MetaTxDialog>
              </CardContent>
            </Card>

            {/* TimeLock Management */}
            <Card className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>TimeLock</CardTitle>
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
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => {
                    setNewTimeLockPeriod('');
                    setShowTimeLockDialog(true);
                  }}
                  className="flex items-center gap-2 w-full" 
                  size="sm"
                  variant={isRoleConnected(contractInfo.broadcaster) ? "default" : "outline"}
                  disabled={!isRoleConnected(contractInfo.broadcaster)}
                >
                  <Clock className="h-4 w-4" />
                  Update
                </Button>
                
                <MetaTxDialog
                  isOpen={showTimeLockDialog}
                  onOpenChange={setShowTimeLockDialog}
                  title="Update TimeLock Period"
                  description={`Enter a new time lock period between ${TIMELOCK_PERIODS.MIN} and ${TIMELOCK_PERIODS.MAX} minutes.`}
                  contractInfo={contractInfo}
                  walletType="broadcaster"
                  currentValue={formatTimeValue(contractInfo.timeLockPeriodInMinutes)}
                  currentValueLabel="Current TimeLock Period"
                  actionLabel="Submit Update Request"
                  newValue={newTimeLockPeriod}
                  onSubmit={async () => {
                    if (parseInt(newTimeLockPeriod) > 0 && parseInt(newTimeLockPeriod) <= TIMELOCK_PERIODS.MAX) {
                      await handleUpdateTimeLockRequest(newTimeLockPeriod);
                      setShowTimeLockDialog(false);
                    }
                  }}
                >
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={TIMELOCK_PERIODS.MIN}
                      max={TIMELOCK_PERIODS.MAX}
                      placeholder={`New TimeLock Period (${TIMELOCK_PERIODS.MIN}-${TIMELOCK_PERIODS.MAX} minutes)`}
                      value={newTimeLockPeriod}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= TIMELOCK_PERIODS.MIN && value <= TIMELOCK_PERIODS.MAX) {
                          setNewTimeLockPeriod(e.target.value);
                        } else {
                          setNewTimeLockPeriod(e.target.value);
                        }
                      }}
                    />
                    {newTimeLockPeriod && (parseInt(newTimeLockPeriod) < TIMELOCK_PERIODS.MIN || parseInt(newTimeLockPeriod) > TIMELOCK_PERIODS.MAX) && (
                      <p className="text-sm text-destructive">
                        Time lock period must be between {TIMELOCK_PERIODS.MIN} and {TIMELOCK_PERIODS.MAX} minutes
                      </p>
                    )}
                  </div>
                </MetaTxDialog>
              </CardContent>
            </Card>
          </div>

          {/* Pending Operations */}
          <OperationHistory
            operations={operationHistory.filter(op => op.status === TxStatus.PENDING)}
            title="Pending Operations"
            onApprove={handleOperationApprove}
            onCancel={handleOperationCancel}
            showFilters={false}
          />

          {/* Operation History */}
          <OperationHistory
            operations={operationHistory}
            title="Operation History"
            className="bg-card"
          />
        </motion.div>

        {/* Approval Dialog */}
        <MetaTxDialog
          isOpen={showBroadcasterApproveDialog}
          onOpenChange={setShowBroadcasterApproveDialog}
          title={`Approve ${pendingOperation ? getOperationTitle(pendingOperation) : 'Operation'}`}
          description="Please connect your broadcaster wallet to approve this operation."
          contractInfo={contractInfo}
          walletType="broadcaster"
          currentValue={pendingOperation?.details.newValue}
          currentValueLabel="New Value"
          actionLabel="Approve Operation"
          onSubmit={async () => {
            if (!pendingOperation) return
            
            try {
              if (pendingOperation.type === 'ownership_update') {
                await handleTransferOwnershipApproval(pendingOperation.txId)
              } else if (pendingOperation.type === 'broadcaster_update') {
                await handleUpdateBroadcasterApproval(pendingOperation.txId)
              }
              // Add other operation types as needed
              
              setShowBroadcasterApproveDialog(false)
              setPendingOperation(null)
              setOperationType(null)
            } catch (error) {
              console.error('Error approving operation:', error)
            }
          }}
        />

        {/* Cancellation Dialog */}
        <MetaTxDialog
          isOpen={showBroadcasterCancelDialog}
          onOpenChange={setShowBroadcasterCancelDialog}
          title={`Cancel ${pendingOperation ? getOperationTitle(pendingOperation) : 'Operation'}`}
          description="Please connect your broadcaster wallet to cancel this operation."
          contractInfo={contractInfo}
          walletType="broadcaster"
          currentValue={pendingOperation?.details.newValue}
          currentValueLabel="New Value"
          actionLabel="Cancel Operation"
          onSubmit={async () => {
            if (!pendingOperation) return
            
            try {
              if (pendingOperation.type === 'ownership_update') {
                await handleTransferOwnershipCancellation(pendingOperation.txId)
              } else if (pendingOperation.type === 'broadcaster_update') {
                await handleUpdateBroadcasterCancellation(pendingOperation.txId)
              }
              // Add other operation types as needed
              
              setShowBroadcasterCancelDialog(false)
              setPendingOperation(null)
              setOperationType(null)
            } catch (error) {
              console.error('Error cancelling operation:', error)
            }
          }}
        />
      </motion.div>
    </div>
  )
} 