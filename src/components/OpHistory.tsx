import { motion } from 'framer-motion'
import { TxRecord } from '../Guardian/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '../Guardian/sdk/typescript/types/lib.index'
import { Hex } from 'viem'
import { formatTimestamp } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Filter, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOperationHistory, statusToHuman } from '@/hooks/useOperationHistory'
import { SecureContractInfo } from '@/lib/types'
import { useOperationTypes } from '@/hooks/useOperationTypes'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TemporalActionDialog } from './security/TemporalActionDialog'
import { TxDetailsDialog } from './TxDetailsDialog'
import { PendingTransactionDialog } from './PendingTransactionDialog'
import { Button } from './ui/button'
import { useBloxOperations } from '@/hooks/useBloxOperations'
import { useOperationRegistry } from '@/hooks/useOperationRegistry'

// Generic type for blox-specific transaction records
interface BloxTxRecord {
  [key: string]: any // Allow for any fields
  txId: bigint // Match TxRecord type
  params: any
  status: TxStatus // Use TxStatus enum
  releaseTime: bigint // Match TxRecord type
  message: `0x${string}` // Match TxRecord type
  result?: any
  payment?: any
}

// Status badge variants mapping
const statusVariants: { [key: number]: { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode } } = {
  [TxStatus.UNDEFINED]: { variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
  [TxStatus.PENDING]: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  [TxStatus.CANCELLED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  [TxStatus.COMPLETED]: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  [TxStatus.FAILED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  [TxStatus.REJECTED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> }
}


// Create a new PendingBadge component to handle the progress
function PendingBadge({ record, contractInfo }: { record: TxRecord, contractInfo: { timeLockPeriodInMinutes: number } }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const calculateProgress = () => {
      const now = Math.floor(Date.now() / 1000)
      const releaseTime = Number(record.releaseTime)
      const timeLockPeriod = (contractInfo.timeLockPeriodInMinutes || 0) * 60
      const startTime = releaseTime - timeLockPeriod
      const currentProgress = Math.min(((now - startTime) / timeLockPeriod) * 100, 100)
      setProgress(currentProgress)
    }

    calculateProgress()
    const intervalId = setInterval(calculateProgress, 1000)
    return () => clearInterval(intervalId)
  }, [record.releaseTime, contractInfo.timeLockPeriodInMinutes])

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Clock className="h-3 w-3" />
      <div className="flex-1">
        <Progress value={progress} className="h-2" />
      </div>
      <span className="text-xs">{Math.round(progress)}%</span>
    </div>
  )
}

export interface OpHistoryProps {
  contractAddress: `0x${string}`
  operations: TxRecord[]
  isLoading: boolean
  contractInfo: SecureContractInfo & { bloxId?: string }
  signedTransactions?: {
    txId: string
    timestamp: number
    metadata?: {
      type: string
      action?: 'approve' | 'cancel'
      broadcasted: boolean
      status?: 'COMPLETED' | 'PENDING'
    }
  }[]
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  onSubmit?: (newValue: string) => Promise<void>
  onNewValueChange?: (value: string) => void
  newValue?: string
  validateNewValue?: (value: string) => { isValid: boolean; message: string }
  isSigning?: boolean
  showMetaTxOption?: boolean
  refreshData?: () => void
  refreshSignedTransactions?: () => void
  onNotification?: (notification: { type: string; title: string; description: string }) => void
  onMetaTxSign?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>
  onBroadcastMetaTx?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

export function OpHistory({
  contractAddress,
  operations,
  isLoading,
  contractInfo,
  signedTransactions = [],
  onApprove,
  onCancel,
  onMetaTxSign,
  onBroadcastMetaTx,
  showMetaTxOption,
  refreshData,
  refreshSignedTransactions,
  onNotification
}: OpHistoryProps) {
  const { address: connectedAddress } = useAccount()
  
  // Add local state to track operations
  const [localOperations, setLocalOperations] = useState(operations)
  
  // Update local operations when props change
  useEffect(() => {
    setLocalOperations(operations)
  }, [operations])
  
  const {
    filteredOperations,
    statusFilter,
    operationTypeFilter,
    setStatusFilter,
    setOperationTypeFilter,
    operationTypes,
    loadingTypes
  } = useOperationHistory({
    contractAddress,
    operations: localOperations,
    isLoading
  })

  const [selectedTransaction, setSelectedTransaction] = useState<TxRecord | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isOperationDialogOpen, setIsOperationDialogOpen] = useState(false)
  const { getOperationName: operationTypesGetOperationName } = useOperationTypes(contractAddress)
  const { isBloxOperation } = useOperationRegistry()
  const { getBloxOperations } = useBloxOperations()
  const [operationTx, setOperationTx] = useState<TxRecord | null>(null)
  const [bloxOperations, setBloxOperations] = useState<any>(null)
  const [isLoadingBloxOperations, setIsLoadingBloxOperations] = useState(false)

  // Add effect to load blox operations when needed
  useEffect(() => {
    const loadBloxOperations = async () => {
      if (!contractInfo?.bloxId) {
        console.warn('No bloxId provided in contractInfo')
        return
      }

      try {
        setIsLoadingBloxOperations(true)
        const ops = await getBloxOperations(contractInfo.bloxId, contractAddress)
        if (ops) {
          console.log(`Loaded operations for ${contractInfo.bloxId}`)
          setBloxOperations(ops)
        }
      } catch (error) {
        console.error('Failed to load blox operations:', error)
        onNotification?.({
          type: 'error',
          title: 'Operation Load Error',
          description: 'Failed to load operations. Some functionality may be limited.'
        })
      } finally {
        setIsLoadingBloxOperations(false)
      }
    }

    // Only load if we have a bloxId and don't already have the operations loaded
    if (contractInfo?.bloxId && !bloxOperations) {
      loadBloxOperations()
    }
  }, [contractInfo?.bloxId, contractAddress, getBloxOperations, bloxOperations])

  // Function to determine the action type and required role based on operation type
  const getActionTypeAndRole = (operationType: Hex): { actionType: string; requiredRole: string } => {
    const operationName = operationTypesGetOperationName(operationType)
    switch (operationName) {
      case 'OWNERSHIP_TRANSFER':
        return { actionType: 'ownership', requiredRole: 'recovery' }
      case 'BROADCASTER_UPDATE':
        return { actionType: 'broadcaster', requiredRole: 'owner' }
      case 'RECOVERY_UPDATE':
        return { actionType: 'recovery', requiredRole: 'owner' }
      case 'TIMELOCK_UPDATE':
        return { actionType: 'timelock', requiredRole: 'owner' }
      default:
        return { actionType: 'unknown', requiredRole: 'owner' }
    }
  }

  // Function to determine if an operation is a blox-specific operation
  const isBloxSpecificOperation = (operationType: Hex): boolean => {
    try {
      const operationName = operationTypesGetOperationName(operationType)
      
      // Core operations that should be handled by TemporalActionDialog
      const coreOperations = [
        'OWNERSHIP_TRANSFER',
        'BROADCASTER_UPDATE',
        'RECOVERY_UPDATE',
        'TIMELOCK_UPDATE'
      ]
      
      // Check if it's a core operation
      if (coreOperations.includes(operationName)) {
        return false
      }

      // If we have blox operations and it has a getOperationName function, use that
      if (bloxOperations?.getOperationName) {
        const bloxOpName = bloxOperations.getOperationName({ params: { operationType } })
        return Boolean(bloxOpName && bloxOpName !== 'Unknown Operation')
      }

      // Default to true if not a core operation
      return true
    } catch (error) {
      console.error('Error checking operation type:', error)
      return false
    }
  }

  // Convert TxRecord to BloxTxRecord for operations
  const convertToBloxTxRecord = (record: TxRecord): BloxTxRecord | null => {
    try {
      if (!bloxOperations) {
        console.warn('No blox operations available for conversion')
        // Return a basic conversion as fallback
        return {
          ...record,
          txId: record.txId,
          params: record.params,
          status: record.status,
          releaseTime: record.releaseTime,
          message: record.message,
          result: record.result,
          payment: record.payment
        }
      }
      
      // Use the blox-specific conversion if available
      if (typeof bloxOperations.convertRecord === 'function') {
        const converted = bloxOperations.convertRecord(record)
        if (converted) {
          return {
            ...converted,
            // Ensure critical fields are always present
            txId: record.txId,
            params: record.params || converted.params,
            status: record.status,
            releaseTime: record.releaseTime,
            message: record.message,
            result: record.result,
            payment: record.payment
          }
        }
      }
      
      // Default to passing through the record if no conversion method
      return {
        ...record,
        txId: record.txId,
        params: record.params,
        status: record.status,
        releaseTime: record.releaseTime,
        message: record.message,
        result: record.result,
        payment: record.payment
      }
    } catch (error) {
      console.error('Error converting to BloxTxRecord:', error)
      return null
    }
  }

  // Function to handle notification events from the dialog
  const handleNotification = (message: { type: string; title: string; description: string }) => {
    console.log(`${message.type}: ${message.title} - ${message.description}`)
    // Pass the notification to the parent component if available
    onNotification?.(message)
  }

  // Handle meta transaction signing with type safety
  const handleMetaTxSign = async (tx: TxRecord, type: 'approve' | 'cancel') => {
    const bloxTx = convertToBloxTxRecord(tx)
    if (!bloxTx) {
      console.error('Failed to convert transaction record')
      onNotification?.({
        type: 'error',
        title: 'Transaction Error',
        description: 'Failed to prepare transaction for signing'
      })
      return
    }
    
    if (onMetaTxSign) {
      try {
        // Convert back to TxRecord for the handler
        await onMetaTxSign(tx, type)
      } catch (error) {
        console.error('Error signing meta transaction:', error)
        onNotification?.({
          type: 'error',
          title: 'Signing Error',
          description: error instanceof Error ? error.message : 'Unknown error during signing'
        })
      }
    } else {
      console.warn('No meta transaction sign handler provided')
    }
  }

  // Handle meta transaction broadcasting with type safety
  const handleBroadcastMetaTx = async (tx: TxRecord, type: 'approve' | 'cancel') => {
    const bloxTx = convertToBloxTxRecord(tx)
    if (!bloxTx) {
      console.error('Failed to convert transaction record')
      onNotification?.({
        type: 'error',
        title: 'Transaction Error',
        description: 'Failed to prepare transaction for broadcasting'
      })
      return
    }
    
    if (onBroadcastMetaTx) {
      try {
        // Convert back to TxRecord for the handler
        await onBroadcastMetaTx(tx, type)
      } catch (error) {
        console.error('Error broadcasting meta transaction:', error)
        onNotification?.({
          type: 'error',
          title: 'Broadcast Error',
          description: error instanceof Error ? error.message : 'Unknown error during broadcasting'
        })
      }
    } else {
      console.warn('No meta transaction broadcast handler provided')
    }
  }

  const handleRowClick = async (record: TxRecord) => {
    try {
      // Check if this is a blox operation
      const isBlox = await isBloxOperation(record.params.operationType as Hex, contractInfo?.bloxId)
      
      // For pending blox-specific operations, open the PendingTransactionDialog
      if (isBlox && record.status === TxStatus.PENDING) {
        console.log('Opening blox-specific dialog for record:', record)
        
        // Ensure we have blox operations loaded
        if (!bloxOperations && contractInfo?.bloxId) {
          setIsLoadingBloxOperations(true)
          try {
            const ops = await getBloxOperations(contractInfo.bloxId, contractAddress)
            if (ops) {
              setBloxOperations(ops)
            } else {
              console.error('Failed to load blox operations')
              onNotification?.({
                type: 'error',
                title: 'Operation Load Error',
                description: 'Failed to load operations for this transaction type.'
              })
              return
            }
          } finally {
            setIsLoadingBloxOperations(false)
          }
        }

        // Convert the record if needed
        let bloxTx = record
        if (bloxOperations?.convertRecord) {
          bloxTx = bloxOperations.convertRecord(record) || record
        }

        setOperationTx(bloxTx)
        setIsOperationDialogOpen(true)
      } else {
        // Handle non-blox operations as before
        setSelectedTransaction(record)
        setIsDetailsOpen(true)
      }
    } catch (error) {
      console.error('Error processing transaction:', error)
      onNotification?.({
        type: 'error',
        title: 'Transaction Error',
        description: error instanceof Error ? error.message : 'Failed to process transaction details'
      })
    }
  }

  // Function to handle cancellation

  if (isLoading || loadingTypes || isLoadingBloxOperations) {
    return (
      <motion.div variants={container} initial="hidden" animate="show">
        <Card>
          <CardHeader>
            <CardTitle>Operation History</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Operation History</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (refreshData) refreshData()
                if (refreshSignedTransactions) refreshSignedTransactions()
              }}
              className="gap-2"
              disabled={isLoading || loadingTypes || isLoadingBloxOperations}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || loadingTypes || isLoadingBloxOperations ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusToHuman).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={operationTypeFilter} onValueChange={setOperationTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operations</SelectItem>
                  {Array.from(operationTypes.entries()).map(([type, name]) => (
                    <SelectItem key={type} value={type}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Release Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOperations.map((record) => {
                // Check if there's a signed transaction for this record
                const hasPendingSignature = signedTransactions?.some(
                  tx => tx.txId === record.txId.toString() && 
                       tx.metadata?.status === 'PENDING' && 
                       !tx.metadata?.broadcasted
                )
                
                // Find the matching signed transaction for tooltip details
                const matchingSignedTx = hasPendingSignature ? signedTransactions?.find(
                  tx => tx.txId === record.txId.toString() && 
                       tx.metadata?.status === 'PENDING' && 
                       !tx.metadata?.broadcasted
                ) : null
                
                const action = matchingSignedTx?.metadata?.action
                const isApprove = action === 'approve'
                
                // Check if the transaction is completed based on both record status and signed transaction metadata
                const isCompleted = record.status === TxStatus.COMPLETED || 
                                  (matchingSignedTx?.metadata?.status === 'COMPLETED' && matchingSignedTx?.metadata?.broadcasted)
                
                const isBloxOperation = isBloxSpecificOperation(record.params.operationType as Hex)
                const isPending = record.status === TxStatus.PENDING
                
                return (
                <TableRow 
                  key={record.txId.toString()}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(record)}
                >
                  <TableCell className="font-medium">
                    {record.txId.toString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {operationTypesGetOperationName(record.params.operationType as Hex)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {record.status === TxStatus.PENDING && !isCompleted ? (
                      <div className="flex flex-col gap-2">
                        <PendingBadge record={record} contractInfo={contractInfo} />
                        
                        {hasPendingSignature && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="secondary" 
                                  className={`${isApprove ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'} flex items-center gap-1 w-fit`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    <path d="M14.5 9.5 16 8" />
                                    <path d="m9.5 14.5-1.5 1.5" />
                                    <path d="M9.5 9.5 8 8" />
                                    <path d="m14.5 14.5 1.5 1.5" />
                                    <path d="M20 12h1" />
                                    <path d="M3 12h1" />
                                    <path d="M12 20v1" />
                                    <path d="M12 3v1" />
                                  </svg>
                                  Signed {action === 'approve' ? 'Approval' : 'Cancellation'}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-medium">Signature Details</p>
                                  <p className="text-xs">
                                    Type: {matchingSignedTx?.metadata?.type || 'Unknown'} <br />
                                    Action: {action || 'Unknown'} <br />
                                    Status: Pending broadcast <br />
                                    Signed at: {matchingSignedTx?.timestamp ? formatTimestamp(matchingSignedTx.timestamp / 1000) : 'Unknown'}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : (
                      <Badge 
                        variant={statusVariants[record.status]?.variant || "outline"}
                        className="flex w-24 items-center justify-center gap-1.5 py-1"
                      >
                        {statusVariants[record.status]?.icon}
                        <span>{statusToHuman[record.status]}</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatTimestamp(Number(record.releaseTime))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation() // Prevent row click
                        handleRowClick(record)
                      }}
                    >
                      {isBloxOperation && isPending ? (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          <span>Manage Transaction</span>
                        </>
                      ) : (
                        <span>View Details</span>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              )})}
              {filteredOperations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No operations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Dialogs */}
          {selectedTransaction && (
            <>
              {/* Show TxDetailsDialog only for completed, cancelled, failed or rejected transactions */}
              {(selectedTransaction.status === TxStatus.COMPLETED || 
                selectedTransaction.status === TxStatus.CANCELLED || 
                selectedTransaction.status === TxStatus.FAILED ||
                selectedTransaction.status === TxStatus.REJECTED) && (
                <TxDetailsDialog
                  isOpen={isDetailsOpen}
                  onOpenChange={setIsDetailsOpen}
                  record={selectedTransaction}
                  operationName={operationTypesGetOperationName(selectedTransaction.params.operationType as Hex)}
                />
              )}
              
              {/* Show TemporalActionDialog for pending transactions that aren't blox specific */}
              {selectedTransaction.status === TxStatus.PENDING && !isBloxSpecificOperation(selectedTransaction.params.operationType as Hex) && (
                <TemporalActionDialog
                  isOpen={isDetailsOpen}
                  onOpenChange={setIsDetailsOpen}
                  title={`${operationTypesGetOperationName(selectedTransaction.params.operationType as Hex)} Details`}
                  contractInfo={{
                    ...contractInfo,
                    contractAddress: contractAddress
                  }}
                  {...getActionTypeAndRole(selectedTransaction.params.operationType as Hex)}
                  currentValue={selectedTransaction.params.target}
                  currentValueLabel="Target Address"
                  actionLabel="Approve Operation"
                  requiredRole={getActionTypeAndRole(selectedTransaction.params.operationType as Hex).requiredRole}
                  connectedAddress={connectedAddress}
                  pendingTx={selectedTransaction}
                  showNewValueInput={false}
                  onApprove={onApprove}
                  onCancel={onCancel}
                  showMetaTxOption={showMetaTxOption}
                  operationName={operationTypesGetOperationName(selectedTransaction.params.operationType as Hex)}
                />
              )}
            </>
          )}

          {/* PendingTransactionDialog for blox-specific operations */}
          {operationTx && (
            <PendingTransactionDialog
              isOpen={isOperationDialogOpen}
              onOpenChange={setIsOperationDialogOpen}
              title={`Operation #${operationTx.txId.toString()}`}
              description="Review and manage this transaction"
              contractInfo={{
                contractAddress: contractAddress,
                timeLockPeriodInMinutes: contractInfo.timeLockPeriodInMinutes,
                chainId: contractInfo.chainId,
                chainName: contractInfo.chainName,
                broadcaster: contractInfo.broadcaster as `0x${string}`,
                owner: contractInfo.owner as `0x${string}`,
                recoveryAddress: contractInfo.recoveryAddress as `0x${string}`
              }}
              transaction={operationTx as unknown as TxRecord}
              onApprove={onApprove}
              onCancel={onCancel}
              onMetaTxSign={handleMetaTxSign}
              onBroadcastMetaTx={handleBroadcastMetaTx}
              onNotification={handleNotification}
              isLoading={false}
              connectedAddress={connectedAddress}
              signedMetaTxStates={signedTransactions.reduce((acc, tx) => {
                if (tx.txId === operationTx.txId.toString() && tx.metadata?.action) {
                  acc[`${tx.txId}-${tx.metadata.action}`] = { type: tx.metadata.action as 'approve' | 'cancel' }
                }
                return acc
              }, {} as Record<string, { type: 'approve' | 'cancel' }>)}
              showMetaTxOption={showMetaTxOption}
              refreshData={refreshData}
              mode="timelock"
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
} 