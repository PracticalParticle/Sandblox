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
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TxDetailsDialog } from './TxDetailsDialog'
import { useOperationHistory, statusToHuman } from '@/hooks/useOperationHistory'
import { SecureContractInfo } from '@/lib/types'
import { useOperationTypes } from '@/hooks/useOperationTypes'

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
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  onSubmit?: (newValue: string) => Promise<void>
  onNewValueChange?: (value: string) => void
  newValue?: string
  validateNewValue?: (value: string) => { isValid: boolean; message: string }
  isSigning?: boolean
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
  onApprove,
  onCancel,
  onSubmit,
  onNewValueChange,
  newValue,
  validateNewValue,
  isSigning
}: OpHistoryProps) {
  const { address: connectedAddress } = useAccount()
  
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

  const handleRowClick = (record: TxRecord) => {
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
              {filteredOperations.map((record) => (
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
                    {record.status === TxStatus.PENDING ? (
                      <PendingBadge record={record} contractInfo={contractInfo} />
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
                    <Badge variant="secondary">
                      View Details
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOperations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No operations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TxDetailsDialog
            isOpen={isDetailsOpen}
            onOpenChange={setIsDetailsOpen}
            record={selectedTx}
            operationName={selectedTx ? operationTypesGetOperationName(selectedTx.params.operationType as Hex) : ''}
            contractInfo={contractInfo}
            connectedAddress={connectedAddress}
            onApprove={onApprove}
            onCancel={onCancel}
            onSubmit={onSubmit}
            onNewValueChange={onNewValueChange}
            newValue={newValue}
            validateNewValue={validateNewValue}
            isSigning={isSigning}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
} 