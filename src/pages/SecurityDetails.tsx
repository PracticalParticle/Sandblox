import { useAccount, useDisconnect, usePublicClient, useWalletClient, useConfig } from 'wagmi'
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
import { Label } from '@/components/ui/label'
import { TIMELOCK_PERIODS } from '@/constants/contract'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { SecureOwnableManager } from '@/lib/SecureOwnableManager'
import { RoleWalletDialog } from '@/components/RoleWalletDialog'

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
    <RoleWalletDialog
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
      </div>
    </RoleWalletDialog>
  )
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
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const config = useConfig()

  // State for input fields
  const [newOwnerAddress, setNewOwnerAddress] = useState('')
  const [newBroadcasterAddress, setNewBroadcasterAddress] = useState('')
  const [newRecoveryAddress, setNewRecoveryAddress] = useState('')
  const [newTimeLockPeriod, setNewTimeLockPeriod] = useState('')
  const [showConnectRecoveryDialog, setShowConnectRecoveryDialog] = useState(false)
  const [showBroadcasterDialog, setShowBroadcasterDialog] = useState(false)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [showTimeLockDialog, setShowTimeLockDialog] = useState(false)
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
    if (!contractInfo || !connectedAddress || !publicClient || !walletClient) return;

    try {
      const chain = config.chains.find((c) => c.id === contractInfo.chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      const manager = new SecureOwnableManager(publicClient, walletClient, contractInfo.address, chain);
      const tx = await manager.transferOwnership({
        from: connectedAddress as `0x${string}`
      });

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: tx });

      toast({
        title: "Request submitted",
        description: "Transfer ownership request has been submitted.",
      });
      
      // Add a small delay before reloading contract info to allow transaction to be mined
      setTimeout(async () => {
        await loadContractInfo();
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('Error submitting transfer ownership request:', error);
      toast({
        title: "Error",
        description: "Failed to submit transfer ownership request.",
        variant: "destructive"
      });
      return false;
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
                
                <RoleWalletDialog
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
                </RoleWalletDialog>
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
                
                <RoleWalletDialog
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
                    if (!isValidEthereumAddress(newRecoveryAddress)) {
                      toast({
                        title: "Error",
                        description: "Please enter a valid Ethereum address",
                        variant: "destructive"
                      })
                      return
                    }
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
                </RoleWalletDialog>
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
                
                <RoleWalletDialog
                  isOpen={showTimeLockDialog}
                  onOpenChange={setShowTimeLockDialog}
                  title="Update TimeLock Period"
                  description={`Enter a new time lock period between ${TIMELOCK_PERIODS.MIN} and ${TIMELOCK_PERIODS.MAX} minutes.`}
                  contractInfo={contractInfo}
                  walletType="broadcaster"
                  currentValue={formatTimeValue(contractInfo?.timeLockPeriodInMinutes)}
                  currentValueLabel="Current TimeLock Period"
                  actionLabel="Submit Update Request"
                  newValue={newTimeLockPeriod}
                  onSubmit={async () => {
                    const period = parseInt(newTimeLockPeriod)
                    if (isNaN(period) || period < TIMELOCK_PERIODS.MIN || period > TIMELOCK_PERIODS.MAX) {
                      toast({
                        title: "Error",
                        description: `Please enter a valid period between ${TIMELOCK_PERIODS.MIN} and ${TIMELOCK_PERIODS.MAX} minutes`,
                        variant: "destructive"
                      })
                      return
                    }
                    await handleUpdateTimeLockRequest(newTimeLockPeriod);
                    setShowTimeLockDialog(false);
                  }}
                >
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder="New TimeLock Period (minutes)"
                      value={newTimeLockPeriod}
                      onChange={(e) => setNewTimeLockPeriod(e.target.value)}
                      min={TIMELOCK_PERIODS.MIN}
                      max={TIMELOCK_PERIODS.MAX}
                    />
                    {parseInt(newTimeLockPeriod) > 0 && (parseInt(newTimeLockPeriod) < TIMELOCK_PERIODS.MIN || parseInt(newTimeLockPeriod) > TIMELOCK_PERIODS.MAX) && (
                      <p className="text-sm text-destructive">
                        Please enter a period between {TIMELOCK_PERIODS.MIN} and {TIMELOCK_PERIODS.MAX} minutes
                      </p>
                    )}
                  </div>
                </RoleWalletDialog>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}