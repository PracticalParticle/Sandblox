import { useAccount } from 'wagmi'
import { useNavigate, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Clock,
  Key,
  Users,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Address, parseAbi } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { useChain } from '../hooks/useChain'
import { useToast } from '../components/ui/use-toast'
import type { SecureContractInfo, SecurityOperationEvent } from '../lib/types'

// Define the ABI inline since we can't import the JSON directly
const SecureOwnableABI = parseAbi([
  // View functions
  'function owner() view returns (address)',
  'function getBroadcaster() view returns (address)',
  'function getRecoveryAddress() view returns (address)',
  'function getTimeLockPeriodInDays() view returns (uint256)',
  'function getOperationHistory() view returns (tuple(string operationType, uint8 status, uint256 timestamp, string oldValue, string newValue, uint256 releaseTime)[])',
  'function isOperationTypeSupported(bytes32 operationType) view returns (bool)',
  
  // Constants
  'function OWNERSHIP_UPDATE() view returns (bytes32)',
  'function BROADCASTER_UPDATE() view returns (bytes32)',
  'function RECOVERY_UPDATE() view returns (bytes32)',
  'function TIMELOCK_UPDATE() view returns (bytes32)',
  
  // Write functions
  'function transferOwnershipRequest() returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))',
  'function transferOwnershipDelayedApproval(uint256 txId) returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))',
  'function transferOwnershipCancellation(uint256 txId) returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))',
  'function updateBroadcasterRequest(address newBroadcaster) returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))',
  'function updateBroadcasterDelayedApproval(uint256 txId) returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))',
  'function updateBroadcasterCancellation(uint256 txId) returns (tuple(uint256 txId, address requester, address target, bytes32 operationType, uint8 executionType, bytes executionOptions, uint256 value, uint256 gasLimit, uint256 timestamp, uint256 releaseTime, uint8 status))'
])

interface OperationRecord {
  operationType: string;
  status: number;
  timestamp: number;
  oldValue?: string;
  newValue?: string;
  releaseTime: number;
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

export function SecurityDetails() {
  const { address } = useParams<{ address: string }>()
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | null>(null)
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chain = useChain()
  const { toast } = useToast()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
      return
    }

    if (!address) {
      navigate('/security-center')
      return
    }

    loadContractInfo()
  }, [isConnected, address])

  const loadContractInfo = async () => {
    if (!address || !publicClient) return

    setLoading(true)
    setError(null)

    try {
      // Fetch contract details using publicClient directly
      const [owner, broadcaster, recoveryAddress, timeLockPeriodInDays] = await Promise.all([
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'owner'
        }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getBroadcaster'
        }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getRecoveryAddress'
        }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getTimeLockPeriodInDays'
        })
      ]) as [Address, Address, Address, number]

      // Get operation history
      const history = await publicClient.readContract({
        address: address as Address,
        abi: SecureOwnableABI,
        functionName: 'getOperationHistory'
      }) as OperationRecord[]
      
      // Process history into events
      const events: SecurityOperationEvent[] = history.map((op: OperationRecord) => ({
        type: op.operationType === 'OWNERSHIP_UPDATE' ? 'ownership' :
              op.operationType === 'BROADCASTER_UPDATE' ? 'broadcaster' :
              op.operationType === 'RECOVERY_UPDATE' ? 'recovery' : 'timelock',
        status: op.status === 0 ? 'pending' :
                op.status === 1 ? 'completed' : 'cancelled',
        timestamp: op.timestamp,
        description: `${op.operationType.replace('_', ' ')} operation`,
        details: {
          oldValue: op.oldValue,
          newValue: op.newValue,
          remainingTime: op.releaseTime > Date.now() / 1000 ? 
            Math.floor(op.releaseTime - Date.now() / 1000) : 0
        }
      }))

      setContractInfo({
        address: address as Address,
        owner,
        broadcaster,
        recoveryAddress,
        timeLockPeriodInDays,
        pendingOperations: events.filter(e => e.status === 'pending'),
        recentEvents: events.filter(e => e.status !== 'pending')
      })
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

        {error && (
          <motion.div variants={item}>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {loading ? (
          <motion.div variants={item} className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </motion.div>
        ) : contractInfo ? (
          <>
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

              {/* Pending Operations */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Pending Operations</h2>
                <div className="space-y-4">
                  {contractInfo.pendingOperations && contractInfo.pendingOperations.length > 0 ? (
                    contractInfo.pendingOperations.map((op, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="rounded-full bg-yellow-500/10 p-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          </div>
                          <div>
                            <p className="font-medium">{op.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {op.details?.remainingTime
                                ? `${Math.floor(op.details.remainingTime / 86400)} days remaining`
                                : 'Ready for approval'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Approve
                          </Button>
                          <Button variant="outline" size="sm">
                            Cancel
                          </Button>
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
                  {contractInfo.recentEvents && contractInfo.recentEvents.length > 0 ? (
                    contractInfo.recentEvents.map((event, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className={`rounded-full p-2 ${
                          event.status === 'completed' ? 'bg-green-500/10' :
                          event.status === 'pending' ? 'bg-yellow-500/10' :
                          'bg-red-500/10'
                        }`}>
                          {event.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : event.status === 'pending' ? (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{event.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.status === 'completed'
                              ? `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} updated successfully`
                              : `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} operation cancelled`}
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
          </>
        ) : null}
      </motion.div>
    </div>
  )
} 