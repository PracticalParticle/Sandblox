import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TxRecord, TxParams, PaymentDetails } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus, ExecutionType } from '@/particle-core/sdk/typescript/types/lib.index'
import { OPERATION_TYPES } from '@/particle-core/sdk/typescript/types/core.access.index'
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
} from "@/components/ui/table"
import { Loader2, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Interface for human-readable operation type mapping
interface OperationTypeMap {
  [key: string]: string;
}

// Operation type mapping for human-readable display
const operationTypeToHuman: OperationTypeMap = {
  [OPERATION_TYPES.OWNERSHIP_UPDATE]: 'Ownership Update',
  [OPERATION_TYPES.BROADCASTER_UPDATE]: 'Broadcaster Update',
  [OPERATION_TYPES.RECOVERY_UPDATE]: 'Recovery Update',
  [OPERATION_TYPES.TIMELOCK_UPDATE]: 'TimeLock Update'
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

interface SecurityOpHistoryProps {
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

export function SecurityOpHistory({ contractAddress, operations, isLoading = false }: SecurityOpHistoryProps) {
  const [sortedOperations, setSortedOperations] = useState<TxRecord[]>([])

  useEffect(() => {
    // Sort operations by txId in descending order (newest first)
    const sorted = [...operations].sort((a, b) => 
      Number(b.txId - a.txId)
    )
    setSortedOperations(sorted)
  }, [operations])

  if (isLoading) {
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
              {sortedOperations.map((record) => (
                <TableRow key={record.txId.toString()}>
                  <TableCell className="font-medium">
                    {record.txId.toString()}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline">
                            {operationTypeToHuman[record.params.operationType] || 'Unknown'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Operation Type: {record.params.operationType}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="cursor-help">
                            View Details
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="w-[300px]">
                          <div className="space-y-2">
                            <p><strong>Requester:</strong> {formatAddress(record.params.requester)}</p>
                            <p><strong>Target:</strong> {formatAddress(record.params.target)}</p>
                            <p><strong>Value:</strong> {record.params.value.toString()}</p>
                            <p><strong>Gas Limit:</strong> {record.params.gasLimit.toString()}</p>
                            <p><strong>Execution Type:</strong> {executionTypeToHuman[record.params.executionType]}</p>
                            {record.payment && (
                              <>
                                <p><strong>Payment Recipient:</strong> {formatAddress(record.payment.recipient)}</p>
                                <p><strong>Native Token Amount:</strong> {record.payment.nativeTokenAmount.toString()}</p>
                                {record.payment.erc20TokenAmount > 0n && (
                                  <>
                                    <p><strong>ERC20 Token:</strong> {formatAddress(record.payment.erc20TokenAddress)}</p>
                                    <p><strong>ERC20 Amount:</strong> {record.payment.erc20TokenAmount.toString()}</p>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
              {sortedOperations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No operations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
} 