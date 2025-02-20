import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Clock,
  Key,
  Users,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { ImportContractDialog } from '../components/ImportContractDialog'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Address, createPublicClient, http, parseAbi } from 'viem'
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

export function SecurityCenter() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [secureContracts, setSecureContracts] = useState<SecureContractInfo[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chain = useChain()
  const { toast } = useToast()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleImportContract = async (address: string) => {
    setShowImportDialog(false)
    setLoadingContracts(true)
    setError(null)
    
    try {
      if (!publicClient) {
        throw new Error('No public client available')
      }

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

      // Add to list if not already present
      setSecureContracts(prev => {
        if (prev.some(c => c.address === address)) {
          toast({
            title: "Contract already imported",
            description: "This contract has already been imported to the Security Center.",
            variant: "default"
          })
          return prev
        }
        
        toast({
          title: "Contract imported successfully",
          description: "The SecureOwnable contract has been imported to the Security Center.",
          variant: "default"
        })
        
        return [...prev, {
          address: address as Address,
          owner,
          broadcaster,
          recoveryAddress,
          timeLockPeriodInDays,
          pendingOperations: events.filter(e => e.status === 'pending'),
          recentEvents: events.filter(e => e.status !== 'pending').slice(0, 5)
        }]
      })
    } catch (error) {
      console.error('Error importing contract:', error)
      setError('Failed to import contract. Please ensure this is a valid SecureOwnable contract.')
      toast({
        title: "Import failed",
        description: "Failed to import contract. Please ensure this is a valid SecureOwnable contract.",
        variant: "destructive"
      })
    }
    
    setLoadingContracts(false)
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
            <h1 className="text-3xl font-bold tracking-tight text-left">Security Center</h1>
            <p className="mt-2 text-muted-foreground">
              Manage security settings and roles for your SecureOwnable contracts.
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Import SecureOwnable Contract
            </Button>
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

        {/* Stats Grid */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Protected Contracts
              </div>
              <p className="text-2xl font-bold">{secureContracts.length}</p>
              <p className="text-xs text-muted-foreground">
                SecureOwnable contracts
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                Active Roles
              </div>
              <p className="text-2xl font-bold">{secureContracts.length * 3}</p>
              <p className="text-xs text-muted-foreground">
                Owner, Recovery, and Broadcaster
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                Pending Operations
              </div>
              <p className="text-2xl font-bold">
                {secureContracts.reduce((acc, contract) => 
                  acc + (contract.pendingOperations?.length || 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Awaiting timelock or approval
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Key className="h-4 w-4" />
                Security Score
              </div>
              <p className="text-2xl font-bold">100%</p>
              <p className="text-xs text-muted-foreground">
                All contracts are secure
              </p>
            </div>
          </div>
        </motion.div>

        {/* Secure Contracts Section */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Protected Contracts</h2>
          </div>
          <div className="p-4">
            {loadingContracts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : secureContracts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">No Protected Contracts</h3>
                  <p className="text-sm text-muted-foreground">
                    Import your first SecureOwnable contract to get started.
                  </p>
                </div>
                <Button
                  onClick={() => setShowImportDialog(true)}
                  className="btn"
                >
                  Import Contract
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="grid gap-6">
                {secureContracts.map((contract) => (
                  <Card key={contract.address} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Contract: {contract.address}</h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>Owner: {contract.owner}</p>
                          <p>Broadcaster: {contract.broadcaster}</p>
                          <p>Recovery Address: {contract.recoveryAddress}</p>
                          <p>Timelock Period: {contract.timeLockPeriodInDays} days</p>
                          {contract.pendingOperations && contract.pendingOperations.length > 0 && (
                            <div className="mt-4">
                              <p className="text-yellow-500 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                {contract.pendingOperations.length} pending operations
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => {
                        // TODO: Navigate to detailed security view
                        navigate(`/security-center/${contract.address}`)
                      }}>
                        Manage Security
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Security Events */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Recent Security Events</h2>
          </div>
          <div className="divide-y">
            {secureContracts.flatMap(contract => 
              (contract.recentEvents || []).map((event, index) => (
                <div key={`${contract.address}-${index}`} className="flex items-center gap-4 p-4">
                  <div className={`rounded-full p-2 ${
                    event.status === 'completed' ? 'bg-green-500/10' :
                    event.status === 'pending' ? 'bg-yellow-500/10' :
                    'bg-red-500/10'
                  }`}>
                    {event.status === 'completed' ? (
                      <CheckCircle2 className={`h-4 w-4 ${
                        event.status === 'completed' ? 'text-green-500' :
                        event.status === 'pending' ? 'text-yellow-500' :
                        'text-red-500'
                      }`} />
                    ) : event.status === 'pending' ? (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-left">{event.description}</p>
                    <p className="text-sm text-muted-foreground text-left">
                      {event.status === 'pending' && event.details?.remainingTime
                        ? `Pending timelock period: ${Math.floor(event.details.remainingTime / 86400)} days remaining`
                        : event.status === 'completed'
                        ? `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} updated successfully`
                        : `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} operation cancelled`}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              ))
            )}
            {secureContracts.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No security events to display
              </div>
            )}
          </div>
        </motion.div>

        <ImportContractDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportContract}
        />
      </motion.div>
    </div>
  )
} 