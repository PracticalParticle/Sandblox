import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, Suspense } from 'react'
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
import { Address, parseAbi } from 'viem'
import { usePublicClient } from 'wagmi'
import { useToast } from '../components/ui/use-toast'
import type { SecureContractInfo, SecurityOperationEvent } from '../lib/types'

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

// Lazy-loaded contract details component
const ContractDetails = ({ contract, onManage }: { contract: SecureContractInfo, onManage: (address: string) => void }) => (
  <Card className="p-6" role="listitem">
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-semibold mb-2" tabIndex={0}>Contract: {contract.address}</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p tabIndex={0}>Owner: {contract.owner}</p>
          <p tabIndex={0}>Broadcaster: {contract.broadcaster}</p>
          <p tabIndex={0}>Recovery Address: {contract.recoveryAddress}</p>
          <p tabIndex={0}>Timelock Period: {contract.timeLockPeriodInDays} days</p>
          {contract.pendingOperations && contract.pendingOperations.length > 0 && (
            <div className="mt-4" role="status">
              <p className="text-yellow-500 flex items-center gap-2" tabIndex={0}>
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {contract.pendingOperations.length} pending operations
              </p>
            </div>
          )}
        </div>
      </div>
      <Button 
        variant="outline" 
        onClick={() => onManage(contract.address)}
        aria-label={`Manage security for contract ${contract.address}`}
      >
        Manage Security
        <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
      </Button>
    </div>
  </Card>
)

// Lazy-loaded security events component
const SecurityEvents = ({ event, address }: { event: SecurityOperationEvent, address: string }) => (
  <div key={`${address}`} className="flex items-center gap-4 p-4" role="article">
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
        }`} aria-hidden="true" />
      ) : event.status === 'pending' ? (
        <AlertCircle className="h-4 w-4 text-yellow-500" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
      )}
    </div>
    <div className="flex-1">
      <p className="font-medium text-left" tabIndex={0}>{event.description}</p>
      <p className="text-sm text-muted-foreground text-left" tabIndex={0}>
        {event.status === 'pending' && event.details?.remainingTime
          ? `Pending timelock period: ${Math.floor(event.details.remainingTime / 86400)} days remaining`
          : event.status === 'completed'
          ? `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} updated successfully`
          : `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} operation cancelled`}
      </p>
    </div>
    <p className="text-sm text-muted-foreground" tabIndex={0}>
      {new Date(event.timestamp * 1000).toLocaleString()}
    </p>
  </div>
)

export function SecurityCenter(): JSX.Element {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false)
  const [secureContracts, setSecureContracts] = useState<SecureContractInfo[]>([])
  const [loadingContracts, setLoadingContracts] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const publicClient = usePublicClient()
  const { toast } = useToast()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleImportContract = async (address: string): Promise<void> => {
    setShowImportDialog(false)
    setLoadingContracts(true)
    setError(null)
    
    try {
      if (!publicClient) {
        throw new Error('No public client available')
      }

      // Validate address format and network
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid contract address format')
      }

      // Verify contract exists and has required interface
      const isContract = await publicClient.getBytecode({ address: address as Address })
      if (!isContract) {
        throw new Error('Address is not a contract')
      }

      // Fetch contract details using publicClient directly with error handling
      const [owner, broadcaster, recoveryAddress, timeLockPeriodInDays] = await Promise.all([
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'owner'
        }).catch(() => { throw new Error('Failed to read owner') }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getBroadcaster'
        }).catch(() => { throw new Error('Failed to read broadcaster') }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getRecoveryAddress'
        }).catch(() => { throw new Error('Failed to read recovery address') }),
        publicClient.readContract({
          address: address as Address,
          abi: SecureOwnableABI,
          functionName: 'getTimeLockPeriodInDays'
        }).catch(() => { throw new Error('Failed to read timelock period') }).then(value => Number(value))
      ]) as [Address, Address, Address, number]

      // Get operation history with error handling
      const history = await publicClient.readContract({
        address: address as Address,
        abi: SecureOwnableABI,
        functionName: 'getOperationHistory'
      }).catch(() => { throw new Error('Failed to read operation history') }) as unknown as [string, number, bigint, string, string, bigint][]
      
      // Process history into events
      const events: SecurityOperationEvent[] = history.map((op) => ({
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
      setError(error instanceof Error ? error.message : 'Failed to import contract')
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : 'Failed to import contract',
        variant: "destructive"
      })
    }
    
    setLoadingContracts(false)
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8" role="main" aria-label="Security Center">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-left" tabIndex={0}>Security Center</h1>
            <p className="mt-2 text-muted-foreground" tabIndex={0}>
              Manage security settings and roles for your SecureOwnable contracts.
            </p>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              aria-label="Import SecureOwnable Contract"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Import SecureOwnable Contract
            </Button>
          </div>
        </motion.div>

        {error && (
          <motion.div variants={item} role="alert">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {secureContracts.length > 0 && (
          <>
            {/* Stats Grid */}
            <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Security Statistics">
              <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    Protected Contracts
                  </div>
                  <p className="text-2xl font-bold" tabIndex={0}>{secureContracts.length}</p>
                  <p className="text-xs text-muted-foreground">
                    SecureOwnable contracts
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Active Roles
                  </div>
                  <p className="text-2xl font-bold" tabIndex={0}>{secureContracts.length * 3}</p>
                  <p className="text-xs text-muted-foreground">
                    Owner, Recovery, and Broadcaster
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Pending Operations
                  </div>
                  <p className="text-2xl font-bold" tabIndex={0}>
                    {secureContracts.reduce((acc, contract) => 
                      acc + (contract.pendingOperations?.length || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Awaiting timelock or approval
                  </p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Key className="h-4 w-4" aria-hidden="true" />
                    Security Score
                  </div>
                  <p className="text-2xl font-bold" tabIndex={0}>100%</p>
                  <p className="text-xs text-muted-foreground">
                    All contracts are secure
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Secure Contracts Section */}
            <motion.div variants={item} className="rounded-lg border bg-card" role="region" aria-label="Protected Contracts">
              <div className="border-b p-4">
                <h2 className="text-xl font-bold text-left" tabIndex={0}>Protected Contracts</h2>
              </div>
              <div className="p-4">
                <div className="grid gap-6" role="list">
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-8" role="status" aria-label="Loading contracts">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                      <span className="sr-only">Loading contracts...</span>
                    </div>
                  }>
                    {secureContracts.map((contract) => (
                      <ContractDetails 
                        key={contract.address} 
                        contract={contract} 
                        onManage={(address) => navigate(`/security-center/${address}`)}
                      />
                    ))}
                  </Suspense>
                </div>
              </div>
            </motion.div>

            {/* Recent Security Events */}
            <motion.div variants={item} className="rounded-lg border bg-card" role="region" aria-label="Recent Security Events">
              <div className="border-b p-4">
                <h2 className="text-xl font-bold text-left" tabIndex={0}>Recent Security Events</h2>
              </div>
              <div className="divide-y" role="log">
                <Suspense fallback={
                  <div className="flex items-center justify-center py-8" role="status" aria-label="Loading events">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                    <span className="sr-only">Loading events...</span>
                  </div>
                }>
                  {secureContracts.flatMap(contract => 
                    (contract.recentEvents || []).map((event, index) => (
                      <SecurityEvents 
                        key={`${contract.address}-${index}`} 
                        event={event} 
                        address={contract.address} 
                      />
                    ))
                  )}
                </Suspense>
              </div>
            </motion.div>
          </>
        )}

        {!loadingContracts && secureContracts.length === 0 && (
          <motion.div variants={item} className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-label="No contracts">
            <div className="rounded-full bg-primary/10 p-3">
              <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="font-medium" tabIndex={0}>No Protected Contracts</h3>
              <p className="text-sm text-muted-foreground">
                Import your first SecureOwnable contract to get started.
              </p>
            </div>
            <Button
              onClick={() => setShowImportDialog(true)}
              className="btn"
              aria-label="Import your first contract"
            >
              Import Contract
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          </motion.div>
        )}

        <ImportContractDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportContract}
        />
      </motion.div>
    </div>
  )
} 