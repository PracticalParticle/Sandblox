import { useAccount } from 'wagmi'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../components/ui/dialog'
import type { SecureContractInfo, SecurityOperationEvent, SecurityOperationDetails } from '@/lib/types'
import { Address } from 'viem'
import { SingleWalletManagerProvider, useSingleWallet } from '@/components/SingleWalletManager'
import { formatAddress, isValidEthereumAddress } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Define enums since we can't import them
enum TxStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

enum SecurityOperationType {
  OWNERSHIP_UPDATE = 'ownership',
  BROADCASTER_UPDATE = 'broadcaster',
  RECOVERY_UPDATE = 'recovery',
  TIMELOCK_UPDATE = 'timelock'
}

// Define TxRecord type
interface TxRecord {
  txId: number;
  type: SecurityOperationType;
  description: string;
  status: TxStatus;
  releaseTime: number;
  timestamp: number;
  details: Required<SecurityOperationDetails>;
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
  
  if (numValue === 0) return '0 days';
  if (numValue === 1) return '1 day';
  return `${numValue} days`;
};

const formatValue = (value: string, type: SecurityOperationType): string => {
  // Handle empty or invalid values
  if (!value || value === '0x0' || value === '0x') return '-';

  switch (type) {
    case SecurityOperationType.OWNERSHIP_UPDATE:
    case SecurityOperationType.BROADCASTER_UPDATE:
    case SecurityOperationType.RECOVERY_UPDATE:
      return formatHexValue(value);
    case SecurityOperationType.TIMELOCK_UPDATE:
      return formatTimeValue(value);
    default:
      return formatHexValue(value);
  }
};

const getOperationTitle = (event: TxRecord): string => {
  switch (event.type) {
    case SecurityOperationType.OWNERSHIP_UPDATE:
      return 'Ownership Transfer';
    case SecurityOperationType.BROADCASTER_UPDATE:
      return 'Broadcaster Update';
    case SecurityOperationType.RECOVERY_UPDATE:
      return 'Recovery Update';
    case SecurityOperationType.TIMELOCK_UPDATE:
      return 'TimeLock Update';
    default:
      return 'Unknown Operation';
  }
};

const getOperationDescription = (event: TxRecord): string => {
  const newValue = formatValue(event.details.newValue, event.type);
  switch (event.type) {
    case SecurityOperationType.OWNERSHIP_UPDATE:
      return `Transfer ownership to ${newValue}`;
    case SecurityOperationType.BROADCASTER_UPDATE:
      return `Update broadcaster to ${newValue}`;
    case SecurityOperationType.RECOVERY_UPDATE:
      return `Update recovery address to ${newValue}`;
    case SecurityOperationType.TIMELOCK_UPDATE:
      return `Update timelock period to ${newValue}`;
    default:
      return event.description;
  }
};

const getOperationIcon = (type: SecurityOperationType) => {
  switch (type) {
    case SecurityOperationType.OWNERSHIP_UPDATE:
      return <Key className="h-3 w-3" />;
    case SecurityOperationType.BROADCASTER_UPDATE:
      return <Radio className="h-3 w-3" />;
    case SecurityOperationType.RECOVERY_UPDATE:
      return <Shield className="h-3 w-3" />;
    case SecurityOperationType.TIMELOCK_UPDATE:
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
};

const getStatusColor = (status: TxStatus): { bg: string; text: string; icon: JSX.Element } => {
  switch (status) {
    case TxStatus.COMPLETED:
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-500',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      };
    case TxStatus.PENDING:
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-500',
        icon: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
      };
    case TxStatus.CANCELLED:
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        icon: <XCircle className="h-3.5 w-3.5 text-red-500" />
      };
  }
};

function RecoveryWalletContent({ 
  contractInfo, 
  onSuccess,
  onClose 
}: { 
  contractInfo: SecureContractInfo | null,
  onSuccess: () => void,
  onClose: () => void
}) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet()
  const [isRecoveryWalletConnected, setIsRecoveryWalletConnected] = useState(false)

  useEffect(() => {
    if (session && contractInfo) {
      setIsRecoveryWalletConnected(
        session.account.toLowerCase() === contractInfo.recoveryAddress.toLowerCase()
      )
    } else {
      setIsRecoveryWalletConnected(false)
    }
  }, [session, contractInfo])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {formatAddress(session.account)}
                  </span>
                </div>
                <Button
                  onClick={() => void disconnect()}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!isRecoveryWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected wallet does not match the recovery address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isRecoveryWalletConnected && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-500">
                    Recovery wallet connected successfully!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Recovery Wallet'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function TimeLockWalletContent({ 
  contractInfo, 
  onSuccess,
  onClose 
}: { 
  contractInfo: SecureContractInfo | null,
  onSuccess: () => void,
  onClose: () => void
}) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet()
  const [isOwnerWalletConnected, setIsOwnerWalletConnected] = useState(false)

  useEffect(() => {
    if (session && contractInfo) {
      setIsOwnerWalletConnected(
        session.account.toLowerCase() === contractInfo.owner.toLowerCase()
      )
    } else {
      setIsOwnerWalletConnected(false)
    }
  }, [session, contractInfo])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {formatAddress(session.account)}
                  </span>
                </div>
                <Button
                  onClick={() => void disconnect()}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!isOwnerWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected wallet does not match the owner address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isOwnerWalletConnected && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-500">
                    Owner wallet connected successfully!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Owner Wallet'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function BroadcasterWalletContent({ 
  contractInfo, 
  onSuccess,
  onClose,
  actionLabel = "Confirm Update",
  newValue = ""
}: { 
  contractInfo: SecureContractInfo | null,
  onSuccess: () => void,
  onClose: () => void,
  actionLabel?: string,
  newValue?: string
}) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet()
  const [isBroadcasterWalletConnected, setIsBroadcasterWalletConnected] = useState(false)

  useEffect(() => {
    if (session && contractInfo) {
      setIsBroadcasterWalletConnected(
        session.account.toLowerCase() === contractInfo.broadcaster.toLowerCase()
      )
    } else {
      setIsBroadcasterWalletConnected(false)
    }
  }, [session, contractInfo])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {formatAddress(session.account)}
                  </span>
                </div>
                <Button
                  onClick={() => void disconnect()}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!isBroadcasterWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected wallet does not match the broadcaster address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isBroadcasterWalletConnected && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-500">
                      Broadcaster wallet connected successfully!
                    </AlertDescription>
                  </Alert>
                  {newValue && (
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-sm font-medium">New Value:</p>
                      <code className="text-xs">{newValue}</code>
                    </div>
                  )}
                  <Button 
                    onClick={onSuccess}
                    className="w-full"
                    variant="default"
                  >
                    {actionLabel}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : 'Connect Broadcaster Wallet'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { address } = useAccount()

  const isOwner = address?.toLowerCase() === contractInfo?.owner.toLowerCase()
  const isValidAddress = isValidEthereumAddress(newBroadcasterAddress)
  const showAddressError = newBroadcasterAddress !== '' && !isValidAddress

  // Clear input when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewBroadcasterAddress('')
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!isOwner || !isValidAddress) return
    
    try {
      setIsSubmitting(true)
      await onSubmit(newBroadcasterAddress)
      setNewBroadcasterAddress('') // Clear input after successful submission
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting update:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNewBroadcasterAddress('') // Clear input when manually closing
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle>Request Broadcaster Update</DialogTitle>
          <div className="p-2 bg-muted rounded-lg text-sm">
            <p className="font-medium">Current Broadcaster:</p>
            <code className="text-xs">{contractInfo?.broadcaster}</code>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="New Broadcaster Address"
              value={newBroadcasterAddress}
              onChange={(e) => setNewBroadcasterAddress(e.target.value)}
              className={showAddressError ? "border-destructive" : ""}
            />
            {showAddressError && (
              <p className="text-sm text-destructive">
                Please enter a valid Ethereum address
              </p>
            )}
          </div>
          {!isOwner && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Only the owner can request broadcaster updates
              </AlertDescription>
            </Alert>
          )}
          {isOwner && (
            <Button 
              onClick={() => void handleSubmit()}
              className="w-full"
              disabled={!isValidAddress || !newBroadcasterAddress || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Update Request'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SecurityDetails() {
  const { address } = useParams<{ address: string }>()
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | null>(null)
  const { validateAndLoadContract, updateBroadcaster, approveOperation, cancelOperation } = useSecureContract()
  const { toast } = useToast()

  // State for input fields
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [newBroadcasterAddress, setNewBroadcasterAddress] = useState('')
  const [newRecoveryAddress, setNewRecoveryAddress] = useState('')
  const [newTimeLockPeriod, setNewTimeLockPeriod] = useState('')
  const [selectedTxId, setSelectedTxId] = useState('')

  const { session, connect, disconnect } = useSingleWallet()
  const [isRecoveryWalletConnected, setIsRecoveryWalletConnected] = useState(false)
  const [showConnectRecoveryDialog, setShowConnectRecoveryDialog] = useState(false)
  const [showBroadcasterDialog, setShowBroadcasterDialog] = useState(false)
  const [showBroadcasterApproveDialog, setShowBroadcasterApproveDialog] = useState(false)
  const [showBroadcasterCancelDialog, setShowBroadcasterCancelDialog] = useState(false)
  const [operationHistory, setOperationHistory] = useState<TxRecord[]>([])

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
      return
    }

    if (!address) {
      navigate('/security-center')
      return
    }

    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid contract address format')
      setLoading(false)
      return
    }

    loadContractInfo()
  }, [isConnected, address])

  useEffect(() => {
    if (session && contractInfo) {
      setIsRecoveryWalletConnected(
        session.account.toLowerCase() === contractInfo.recoveryAddress.toLowerCase()
      )
    } else {
      setIsRecoveryWalletConnected(false)
    }
  }, [session, contractInfo])

  const loadContractInfo = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const info = await validateAndLoadContract(address as `0x${string}`);
      if (!info) {
        throw new Error('Contract info not found');
      }
      setContractInfo(info);

      // Convert contract events to TxRecord format
      const pendingOps = info.pendingOperations || [];
      const recentOps = info.recentEvents || [];
      const allEvents: SecurityOperationEvent[] = [...pendingOps, ...recentOps];
      
      // Convert timeLockPeriodInDays to number first
      const timeLockPeriodInDays = convertBigIntToNumber(info.timeLockPeriodInDays);
      const timeLockPeriodInSeconds = timeLockPeriodInDays * 24 * 60 * 60;
      
      const history: TxRecord[] = allEvents
        .filter((event): event is SecurityOperationEvent & { details: Required<SecurityOperationDetails> } => 
          event.details !== undefined &&
          typeof event.details.oldValue !== 'undefined' &&
          typeof event.details.newValue !== 'undefined' &&
          typeof event.details.remainingTime !== 'undefined'
        )
        .map(event => {
          // Convert timestamp to number first
          const timestamp = convertBigIntToNumber(event.timestamp);
          
          return {
            txId: typeof event.details.newValue === 'bigint' ? 
              Number(event.details.newValue) : 
              parseInt(event.details.newValue.toString()) || Date.now(),
            type: event.type as SecurityOperationType,
            description: event.description,
            status: event.status as TxStatus,
            releaseTime: timestamp + timeLockPeriodInSeconds,
            timestamp: timestamp,
            details: {
              oldValue: event.details.oldValue.toString(),
              newValue: event.details.newValue.toString(),
              remainingTime: convertBigIntToNumber(event.details.remainingTime)
            }
          };
        });

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
      if (!session) {
        setShowConnectRecoveryDialog(true)
        return
      }

      if (!isRecoveryWalletConnected) {
        // If wrong wallet is connected, disconnect it first
        await disconnect()
        setShowConnectRecoveryDialog(true)
        return
      }

      // Implementation with connected recovery wallet
      toast({
        title: "Request submitted",
        description: "Transfer ownership request has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit transfer ownership request.",
        variant: "destructive"
      })
    }
  }

  const handleTransferOwnershipApproval = async (txId: number) => {
    try {
      await approveOperation(address as `0x${string}`, txId, 'ownership');
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
      await cancelOperation(address as `0x${string}`, txId, 'ownership');
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
      await updateBroadcaster(address as `0x${string}`, newBroadcaster as `0x${string}`);
      
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
      await approveOperation(address as `0x${string}`, txId, 'broadcaster');
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
      await cancelOperation(address as `0x${string}`, txId, 'broadcaster');
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

  const RecoveryWalletDialog = () => {
    const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
    if (!projectId) {
      throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
    }

    return (
      <Dialog open={showConnectRecoveryDialog} onOpenChange={setShowConnectRecoveryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Recovery Wallet</DialogTitle>
            <DialogDescription>
              Please connect the recovery wallet to proceed with the ownership transfer request.
            </DialogDescription>
            {contractInfo && (
              <div className="mt-2 p-2 bg-muted rounded-lg">
                <p className="text-sm font-medium">Recovery Address:</p>
                <code className="text-xs">{contractInfo.recoveryAddress}</code>
              </div>
            )}
          </DialogHeader>
          <SingleWalletManagerProvider
            projectId={projectId}
            autoConnect={false}
            metadata={{
              name: 'OpenBlox Recovery',
              description: 'OpenBlox Recovery Wallet Connection',
              url: window.location.origin,
              icons: ['https://avatars.githubusercontent.com/u/37784886']
            }}
          >
            <RecoveryWalletContent 
              contractInfo={contractInfo}
              onSuccess={() => {
                setShowConnectRecoveryDialog(false)
                handleTransferOwnershipRequest()
              }}
              onClose={() => setShowConnectRecoveryDialog(false)}
            />
          </SingleWalletManagerProvider>
        </DialogContent>
      </Dialog>
    )
  }

  if (!address || error) {
    return (
      <div className="container py-8">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Button
              variant="ghost"
              onClick={() => navigate('/security-center')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Security Center
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
              onClick={() => navigate('/security-center')}
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
    <div className="container py-8">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-start">
          <div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/security-center')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-left">Security Details</h1>
                <p className="mt-2 text-muted-foreground">
                  Manage security settings for contract at {address}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Owner</p>
                  <p className="font-medium">{contractInfo.owner}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Broadcaster</p>
                  <p className="font-medium">{contractInfo.broadcaster}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recovery Address</p>
                  <p className="font-medium">{contractInfo.recoveryAddress}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timelock Period</p>
                  <p className="font-medium">{contractInfo.timeLockPeriodInDays} days</p>
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
                  onClick={handleTransferOwnershipRequest}
                  className="flex items-center gap-2 w-full"
                  size="sm"
                >
                  <Wallet className="h-4 w-4" />
                  Request Transfer
                </Button>
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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2 w-full" size="sm">
                      <Key className="h-4 w-4" />
                      Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader className="space-y-3">
                      <DialogTitle>Update Recovery Address</DialogTitle>
                      <div className="p-2 bg-muted rounded-lg text-sm">
                        <p className="font-medium">Current Recovery Address:</p>
                        <code className="text-xs">{contractInfo.recoveryAddress}</code>
                      </div>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="New Recovery Address"
                        value={newRecoveryAddress}
                        onChange={(e) => setNewRecoveryAddress(e.target.value)}
                      />
                      <SingleWalletManagerProvider
                        projectId={import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID}
                        autoConnect={false}
                        metadata={{
                          name: 'OpenBlox Broadcaster',
                          description: 'OpenBlox Broadcaster Wallet Connection',
                          url: window.location.origin,
                          icons: ['https://avatars.githubusercontent.com/u/37784886']
                        }}
                      >
                        <BroadcasterWalletContent 
                          contractInfo={contractInfo}
                          onSuccess={() => {
                            handleUpdateRecoveryRequest(newRecoveryAddress)
                            setShowBroadcasterDialog(false)
                          }}
                          onClose={() => {
                            setShowBroadcasterDialog(false)
                          }}
                          actionLabel="Submit Update Request"
                          newValue={newRecoveryAddress}
                        />
                      </SingleWalletManagerProvider>
                    </div>
                  </DialogContent>
                </Dialog>
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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2 w-full" size="sm">
                      <Clock className="h-4 w-4" />
                      Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader className="space-y-3">
                      <DialogTitle>Update TimeLock Period</DialogTitle>
                      <div className="p-2 bg-muted rounded-lg text-sm">
                        <p className="font-medium">Current TimeLock Period:</p>
                        <p className="text-xs">{contractInfo.timeLockPeriodInDays} days</p>
                      </div>
                      <DialogDescription>
                        Enter a new time lock period between 1 and 30 days.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          placeholder="New TimeLock Period (1-30 days)"
                          value={newTimeLockPeriod}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value > 0 && value <= 30) {
                              setNewTimeLockPeriod(e.target.value);
                            }
                          }}
                        />
                        {newTimeLockPeriod && (parseInt(newTimeLockPeriod) <= 0 || parseInt(newTimeLockPeriod) > 30) && (
                          <p className="text-sm text-destructive">Time lock period must be between 1 and 30 days</p>
                        )}
                      </div>
                      <SingleWalletManagerProvider
                        projectId={import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID}
                        autoConnect={false}
                        metadata={{
                          name: 'OpenBlox Broadcaster',
                          description: 'OpenBlox Broadcaster Wallet Connection',
                          url: window.location.origin,
                          icons: ['https://avatars.githubusercontent.com/u/37784886']
                        }}
                      >
                        <BroadcasterWalletContent 
                          contractInfo={contractInfo}
                          onSuccess={() => {
                            if (parseInt(newTimeLockPeriod) > 0 && parseInt(newTimeLockPeriod) <= 30) {
                              handleUpdateTimeLockRequest(newTimeLockPeriod);
                            }
                          }}
                          onClose={() => {}}
                          actionLabel="Submit Update Request"
                          newValue={newTimeLockPeriod}
                        />
                      </SingleWalletManagerProvider>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          {/* Pending Operations */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Pending Operations</h2>
            <div className="space-y-4">
              {operationHistory.filter(op => op.status === TxStatus.PENDING).length > 0 ? (
                operationHistory
                  .filter(op => op.status === TxStatus.PENDING)
                  .map((op) => (
                    <div key={op.txId} className="flex flex-col gap-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="rounded-full bg-yellow-500/10 p-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium">{op.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {op.details.remainingTime > 0
                                ? `${Math.floor(op.details.remainingTime / 86400)} days remaining`
                                : 'Ready for approval'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {/* Temporal Option */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Temporal Security</p>
                              <p className="text-sm text-muted-foreground">Valid after timelock period</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={op.releaseTime > Math.floor(Date.now() / 1000)}
                              onClick={() => {
                                switch (op.type) {
                                  case SecurityOperationType.OWNERSHIP_UPDATE:
                                    void handleTransferOwnershipApproval(op.txId);
                                    break;
                                  case SecurityOperationType.BROADCASTER_UPDATE:
                                    void handleUpdateBroadcasterApproval(op.txId);
                                    break;
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={op.releaseTime > Math.floor(Date.now() / 1000)}
                              onClick={() => {
                                switch (op.type) {
                                  case SecurityOperationType.OWNERSHIP_UPDATE:
                                    void handleTransferOwnershipCancellation(op.txId);
                                    break;
                                  case SecurityOperationType.BROADCASTER_UPDATE:
                                    void handleUpdateBroadcasterCancellation(op.txId);
                                    break;
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        {/* Meta Tx Option */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Meta Transaction</p>
                              <p className="text-sm text-muted-foreground">Requires broadcaster wallet</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Dialog open={showBroadcasterApproveDialog} onOpenChange={setShowBroadcasterApproveDialog}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Approve via Meta Transaction</DialogTitle>
                                  <DialogDescription>
                                    Connect the broadcaster wallet to approve this operation.
                                  </DialogDescription>
                                </DialogHeader>
                                <SingleWalletManagerProvider
                                  projectId={import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID}
                                  autoConnect={false}
                                  metadata={{
                                    name: 'OpenBlox Broadcaster',
                                    description: 'OpenBlox Broadcaster Wallet Connection',
                                    url: window.location.origin,
                                    icons: ['https://avatars.githubusercontent.com/u/37784886']
                                  }}
                                >
                                  <BroadcasterWalletContent 
                                    contractInfo={contractInfo}
                                    onSuccess={() => {
                                      switch (op.type) {
                                        case SecurityOperationType.OWNERSHIP_UPDATE:
                                          void handleTransferOwnershipApproval(op.txId);
                                          break;
                                        case SecurityOperationType.BROADCASTER_UPDATE:
                                          void handleUpdateBroadcasterApproval(op.txId);
                                          break;
                                      }
                                      setShowBroadcasterApproveDialog(false);
                                    }}
                                    onClose={() => setShowBroadcasterApproveDialog(false)}
                                    actionLabel="Approve Operation"
                                  />
                                </SingleWalletManagerProvider>
                              </DialogContent>
                            </Dialog>
                            <Dialog open={showBroadcasterCancelDialog} onOpenChange={setShowBroadcasterCancelDialog}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Cancel
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Cancel via Meta Transaction</DialogTitle>
                                  <DialogDescription>
                                    Connect the broadcaster wallet to cancel this operation.
                                  </DialogDescription>
                                </DialogHeader>
                                <SingleWalletManagerProvider
                                  projectId={import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID}
                                  autoConnect={false}
                                  metadata={{
                                    name: 'OpenBlox Broadcaster',
                                    description: 'OpenBlox Broadcaster Wallet Connection',
                                    url: window.location.origin,
                                    icons: ['https://avatars.githubusercontent.com/u/37784886']
                                  }}
                                >
                                  <BroadcasterWalletContent 
                                    contractInfo={contractInfo}
                                    onSuccess={() => {
                                      switch (op.type) {
                                        case SecurityOperationType.OWNERSHIP_UPDATE:
                                          void handleTransferOwnershipCancellation(op.txId);
                                          break;
                                        case SecurityOperationType.BROADCASTER_UPDATE:
                                          void handleUpdateBroadcasterCancellation(op.txId);
                                          break;
                                      }
                                      setShowBroadcasterCancelDialog(false);
                                    }}
                                    onClose={() => setShowBroadcasterCancelDialog(false)}
                                    actionLabel="Cancel Operation"
                                  />
                                </SingleWalletManagerProvider>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No pending operations
                </p>
              )}
            </div>
          </Card>

          {/* Operation History */}
          <Card className="p-6 bg-card">
            <h2 className="text-xl font-bold mb-6">Operation History</h2>
            <div className="space-y-2">
              {operationHistory.length > 0 ? (
                operationHistory
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((event) => {
                    const statusStyle = getStatusColor(event.status);
                    const icon = getOperationIcon(event.type);
                    return (
                      <Collapsible key={event.txId}>
                        <div className="group border rounded-lg bg-background">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 hover:bg-accent/5 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`rounded-full p-2 ${statusStyle.bg} shrink-0`}>
                                  {statusStyle.icon}
                                </div>
                                <div className="min-w-0 text-left">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-semibold truncate">
                                      {getOperationTitle(event)}
                                    </h3>
                                    <Badge 
                                      variant={
                                        event.status === TxStatus.COMPLETED ? "default" :
                                        event.status === TxStatus.PENDING ? "secondary" :
                                        "destructive"
                                      }
                                      className="capitalize"
                                    >
                                      {event.status}
                                    </Badge>
                                    {event.status === TxStatus.PENDING && event.details.remainingTime > 0 && (
                                      <span className="flex items-center gap-1 text-xs text-yellow-500">
                                        <Timer className="h-3 w-3" />
                                        {Math.floor(event.details.remainingTime / 86400)}d {Math.floor((event.details.remainingTime % 86400) / 3600)}h
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <Clock className="h-3 w-3" />
                                    {new Date(event.timestamp * 1000).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Hash className="h-3 w-3" />
                                      {event.txId}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(event.txId.toString());
                                          toast({
                                            title: "Copied!",
                                            description: "Transaction ID copied to clipboard"
                                          });
                                        }}
                                      >
                                        <span className="sr-only">Copy transaction ID</span>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Copy transaction ID</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-3 pt-1">
                              <p className="text-sm text-muted-foreground mb-3">
                                {getOperationDescription(event)}
                              </p>
                              
                              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
                                  <div className="flex items-center gap-2 text-sm">
                                    {icon}
                                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {formatValue(event.details.oldValue, event.type)}
                                    </code>
                                  </div>
                                </div>
                                <div className="text-muted-foreground">→</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
                                  <div className="flex items-center gap-2 text-sm">
                                    {icon}
                                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {formatValue(event.details.newValue, event.type)}
                                    </code>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm font-medium">No operation history available</p>
                  <p className="text-xs mt-1">Operations will appear here once executed</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Recovery Wallet Connection Dialog */}
        <RecoveryWalletDialog />
      </motion.div>
    </div>
  )
} 