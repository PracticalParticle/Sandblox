import { motion } from 'framer-motion'
import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '../particle-core/sdk/typescript/types/lib.index'
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
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Filter, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'

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
import { TemporalActionDialog } from './TemporalActionDialog'
import { TxDetailsDialog } from './TxDetailsDialog'

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

interface OpHistoryProps {
  contractAddress: `0x${string}`
  operations: TxRecord[]
  isLoading: boolean
  contractInfo: SecureContractInfo
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
  onSubmit,
  showMetaTxOption,
  refreshData,
  refreshSignedTransactions
}: OpHistoryProps) {
  const { address: connectedAddress } = useAccount()
  const navigate = useNavigate()
  
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
    operations,
    isLoading
  })

  const [selectedTx, setSelectedTx] = useState<TxRecord | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const { getOperationName: operationTypesGetOperationName } = useOperationTypes(contractAddress)

  // Function to determine the action type and required role based on operation type
  const getActionTypeAndRole = (operationType: Hex): { actionType: string; requiredRole: string } => {
    const operationName = operationTypesGetOperationName(operationType)
    switch (operationName) {
      case 'OWNERSHIP_TRANSFER':
        return { actionType: 'ownership', requiredRole: 'owner_or_recovery' }
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

  // Function to determine if an operation is a withdrawal
  const isWithdrawalOperation = (operationType: Hex): boolean => {
    const operationName = operationTypesGetOperationName(operationType)
    return operationName === 'WITHDRAW_ETH' || operationName === 'WITHDRAW_TOKEN'
  }

  const handleRowClick = (record: TxRecord) => {
    const isWithdrawal = isWithdrawalOperation(record.params.operationType as Hex)
    
    // For pending withdrawals, navigate to the blox page
    if (isWithdrawal && record.status === TxStatus.PENDING) {
      navigate(`/blox/simple-vault/${contractAddress}`)
      return
    }

    // For other transactions, show the details dialog
    setSelectedTx(record)
    setIsDetailsOpen(true)
  }

  if (isLoading || loadingTypes) {
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
          <CardTitle>Operation History</CardTitle>
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
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOperations.map((record) => {
                // Check if there's a signed transaction for this record
                const hasPendingSignature = signedTransactions?.some(
                  tx => tx.txId === record.txId.toString() && 
                       tx.metadata?.status === 'PENDING' && 
                       !tx.metadata?.broadcasted
                );
                
                // Find the matching signed transaction for tooltip details
                const matchingSignedTx = hasPendingSignature ? signedTransactions?.find(
                  tx => tx.txId === record.txId.toString() && 
                       tx.metadata?.status === 'PENDING' && 
                       !tx.metadata?.broadcasted
                ) : null;
                
                const action = matchingSignedTx?.metadata?.action;
                const isApprove = action === 'approve';
                
                // Check if the transaction is completed based on both record status and signed transaction metadata
                const isCompleted = record.status === TxStatus.COMPLETED || 
                                  (matchingSignedTx?.metadata?.status === 'COMPLETED' && matchingSignedTx?.metadata?.broadcasted);
                
                const isWithdrawal = isWithdrawalOperation(record.params.operationType as Hex)
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
                        
                        {/* Show signature indicator for pending transactions with signed meta tx */}
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
                        className="flex items-center gap-1"
                      >
                        {statusVariants[record.status]?.icon}
                        <span>{statusToHuman[record.status]}</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatTimestamp(Number(record.releaseTime))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {isWithdrawal && isPending ? (
                        <>
                          <ExternalLink className="h-3 w-3" />
                          <span>View in Blox</span>
                        </>
                      ) : (
                        <span>View Details</span>
                      )}
                    </Badge>
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
          {selectedTx && selectedTx.status === TxStatus.PENDING && !isWithdrawalOperation(selectedTx.params.operationType as Hex) && (
            <TemporalActionDialog
              isOpen={isDetailsOpen}
              onOpenChange={setIsDetailsOpen}
              title={`${operationTypesGetOperationName(selectedTx.params.operationType as Hex)} Details`}
              contractInfo={{
                ...contractInfo,
                contractAddress: contractAddress
              }}
              {...getActionTypeAndRole(selectedTx.params.operationType as Hex)}
              currentValue={selectedTx.params.target}
              currentValueLabel="Target Address"
              actionLabel="Approve Operation"
              requiredRole={getActionTypeAndRole(selectedTx.params.operationType as Hex).requiredRole}
              connectedAddress={connectedAddress}
              pendingTx={selectedTx}
              showNewValueInput={false}
              onApprove={onApprove}
              onCancel={onCancel}
              showMetaTxOption={showMetaTxOption}
              operationName={operationTypesGetOperationName(selectedTx.params.operationType as Hex)}
              refreshData={refreshData}
              refreshSignedTransactions={refreshSignedTransactions}
            />
          )}
          
          {selectedTx && selectedTx.status !== TxStatus.PENDING && !isWithdrawalOperation(selectedTx.params.operationType as Hex) && (
            <TxDetailsDialog
              isOpen={isDetailsOpen}
              onOpenChange={setIsDetailsOpen}
              record={selectedTx}
              operationName={operationTypesGetOperationName(selectedTx.params.operationType as Hex)}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
} 