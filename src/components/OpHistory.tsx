import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus, ExecutionType } from '@/particle-core/sdk/typescript/types/lib.index'
import { Address } from 'viem'
import { formatAddress, formatTimestamp } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useOperationTypes } from '@/hooks/useOperationTypes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// Status to human-readable text
const statusToHuman: { [key: number]: string } = {
  [TxStatus.UNDEFINED]: 'Undefined',
  [TxStatus.PENDING]: 'Pending',
  [TxStatus.CANCELLED]: 'Cancelled',
  [TxStatus.COMPLETED]: 'Completed',
  [TxStatus.FAILED]: 'Failed',
  [TxStatus.REJECTED]: 'Rejected'
}

// Execution type to human-readable text
const executionTypeToHuman: { [key: number]: string } = {
  [ExecutionType.NONE]: 'None',
  [ExecutionType.STANDARD]: 'Standard',
  [ExecutionType.RAW]: 'Raw'
}

interface OpHistoryProps {
  contractAddress: Address
  operations: TxRecord[]
  isLoading?: boolean
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

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function OpHistory({ contractAddress, operations, isLoading = false }: OpHistoryProps) {
  const [sortedOperations, setSortedOperations] = useState<TxRecord[]>([])
  const [filteredOperations, setFilteredOperations] = useState<TxRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all')
  const { getOperationName, operationTypes, loading: loadingTypes } = useOperationTypes(contractAddress)
  const [selectedRecord, setSelectedRecord] = useState<TxRecord | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    // Sort operations by txId in descending order (newest first)
    const sorted = [...operations].sort((a, b) => 
      Number(b.txId - a.txId)
    )
    setSortedOperations(sorted)
  }, [operations])

  useEffect(() => {
    // Apply filters
    let filtered = [...sortedOperations]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(op => op.status === parseInt(statusFilter))
    }

    if (operationTypeFilter !== 'all') {
      filtered = filtered.filter(op => op.params.operationType === operationTypeFilter)
    }

    setFilteredOperations(filtered)
  }, [sortedOperations, statusFilter, operationTypeFilter])

  const handleRowClick = (record: TxRecord) => {
    setSelectedRecord(record)
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
                      {getOperationName(record.params.operationType)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={statusVariants[record.status]?.variant || "outline"}
                      className="flex items-center gap-1"
                    >
                      {statusVariants[record.status]?.icon}
                      <span>{statusToHuman[record.status]}</span>
                    </Badge>
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
            record={selectedRecord}
            isOpen={isDetailsOpen}
            onOpenChange={setIsDetailsOpen}
            operationName={selectedRecord ? getOperationName(selectedRecord.params.operationType) : ''}
          />
        </CardContent>
      </Card>
    </motion.div>
  )
} 