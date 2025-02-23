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
  Network
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSecureContract } from '@/hooks/useSecureContract'
import { useToast } from '../components/ui/use-toast'
import { Input } from '../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../components/ui/dialog'
import type { SecureContractInfo } from '@/lib/types'
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

// Define enums since we can't import them
enum TxStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

enum SecurityOperationType {
  TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP',
  UPDATE_BROADCASTER = 'UPDATE_BROADCASTER',
  UPDATE_RECOVERY = 'UPDATE_RECOVERY',
  UPDATE_TIMELOCK = 'UPDATE_TIMELOCK'
}

// Define TxRecord type
interface TxRecord {
  txId: number
  operationType: SecurityOperationType
  description: string
  status: TxStatus
  releaseTime: number
  timestamp: number
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

  const handleSubmit = async () => {
    if (!isOwner || !isValidAddress) return
    
    try {
      setIsSubmitting(true)
      await onSubmit(newBroadcasterAddress)
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting update:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
  const { validateAndLoadContract } = useSecureContract()
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
    loadOperationHistory()
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
    if (!address) return

    setLoading(true)
    setError(null)

    try {
      const info = await validateAndLoadContract(address as `0x${string}`)
      setContractInfo(info)
    } catch (error) {
      console.error('Error loading contract:', error)
      setError('Failed to load contract details. Please ensure this is a valid SecureOwnable contract.')
      toast({
        title: "Loading failed",
        description: "Failed to load contract details. Please ensure this is a valid SecureOwnable contract.",
        variant: "destructive"
      })
    }
    
    setLoading(false)
  }

  const loadOperationHistory = async () => {
    if (!contractInfo) return;
    try {
      // Mock data for now since getOperationHistory doesn't exist
      const history: TxRecord[] = [
        {
          txId: 1,
          operationType: SecurityOperationType.TRANSFER_OWNERSHIP,
          description: "Transfer ownership to 0x123...",
          status: TxStatus.PENDING,
          releaseTime: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
          timestamp: Math.floor(Date.now() / 1000)
        },
        {
          txId: 2,
          operationType: SecurityOperationType.UPDATE_BROADCASTER,
          description: "Update broadcaster to 0x456...",
          status: TxStatus.COMPLETED,
          releaseTime: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
          timestamp: Math.floor(Date.now() / 1000) - 86400
        }
      ];
      setOperationHistory(history);
    } catch (error) {
      console.error('Error loading operation history:', error);
    }
  }

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
      // Implementation
      toast({
        title: "Approval submitted",
        description: "Transfer ownership approval has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve transfer ownership.",
        variant: "destructive"
      })
    }
  }

  const handleTransferOwnershipCancellation = async (txId: number) => {
    try {
      // Implementation
      toast({
        title: "Cancellation submitted",
        description: "Transfer ownership cancellation has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel transfer ownership.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateBroadcasterRequest = async (newBroadcaster: string) => {
    try {
      // Implementation
      toast({
        title: "Request submitted",
        description: "Broadcaster update request has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit broadcaster update request.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateBroadcasterApproval = async (txId: number) => {
    try {
      // Implementation
      toast({
        title: "Approval submitted",
        description: "Broadcaster update approval has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve broadcaster update.",
        variant: "destructive"
      })
    }
  }

  const handleUpdateBroadcasterCancellation = async (txId: number) => {
    try {
      // Implementation
      toast({
        title: "Cancellation submitted",
        description: "Broadcaster update cancellation has been submitted.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel broadcaster update.",
        variant: "destructive"
      })
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
                  .map((op, index) => (
                    <div key={op.txId} className="flex flex-col gap-4 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="rounded-full bg-yellow-500/10 p-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium">{op.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {op.releaseTime > Math.floor(Date.now() / 1000)
                                ? `${Math.floor((op.releaseTime - Math.floor(Date.now() / 1000)) / 86400)} days remaining`
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
                                switch (op.operationType) {
                                  case SecurityOperationType.TRANSFER_OWNERSHIP:
                                    void handleTransferOwnershipApproval(op.txId);
                                    break;
                                  case SecurityOperationType.UPDATE_BROADCASTER:
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
                                switch (op.operationType) {
                                  case SecurityOperationType.TRANSFER_OWNERSHIP:
                                    void handleTransferOwnershipCancellation(op.txId);
                                    break;
                                  case SecurityOperationType.UPDATE_BROADCASTER:
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
                                      switch (op.operationType) {
                                        case SecurityOperationType.TRANSFER_OWNERSHIP:
                                          void handleTransferOwnershipApproval(op.txId);
                                          break;
                                        case SecurityOperationType.UPDATE_BROADCASTER:
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
                                      switch (op.operationType) {
                                        case SecurityOperationType.TRANSFER_OWNERSHIP:
                                          void handleTransferOwnershipCancellation(op.txId);
                                          break;
                                        case SecurityOperationType.UPDATE_BROADCASTER:
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
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Operation History</h2>
            <div className="space-y-4">
              {operationHistory.length > 0 ? (
                operationHistory.map((event) => (
                  <div key={event.txId} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className={`rounded-full p-2 ${
                      event.status === TxStatus.COMPLETED ? 'bg-green-500/10' :
                      event.status === TxStatus.PENDING ? 'bg-yellow-500/10' :
                      'bg-red-500/10'
                    }`}>
                      {event.status === TxStatus.COMPLETED ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : event.status === TxStatus.PENDING ? (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.status === TxStatus.COMPLETED
                          ? `${event.operationType} updated successfully`
                          : event.status === TxStatus.PENDING
                          ? `${event.operationType} pending approval`
                          : `${event.operationType} operation cancelled`}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No operation history
                </p>
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