import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { Trash2, AlertCircle, Network } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useOperationTypes } from '@/hooks/useOperationTypes'
import { Address } from 'viem'
import { cn } from '@/lib/utils'

export interface ExtendedSignedTransaction {
  txId: string
  signedData: string
  timestamp: number
  metadata?: {
    type: 'TIMELOCK_UPDATE' | 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE' | 'RECOVERY_UPDATE'
    purpose?: 'address_update' | 'ownership_transfer'
    action?: 'approve' | 'cancel'
    broadcasted: boolean
    operationType?: `0x${string}`
    status?: 'COMPLETED' | 'PENDING'
  }
}

interface SignedMetaTxTableProps {
  transactions: ExtendedSignedTransaction[]
  onClearAll: () => void
  onRemoveTransaction: (txId: string) => void
  contractAddress: Address
  onTxClick?: (tx: ExtendedSignedTransaction) => void
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

export function SignedMetaTxTable({ transactions, onClearAll, onRemoveTransaction, contractAddress, onTxClick }: SignedMetaTxTableProps) {
  const { getOperationName } = useOperationTypes(contractAddress)

  // Filter out any transactions that have been broadcasted
  const pendingTransactions = transactions

  if (pendingTransactions.length === 0) {
    return null
  }

  const getTypeLabel = (tx: ExtendedSignedTransaction): string => {
    // First priority: Check for dynamic operation type
    if (tx.metadata?.operationType) {
      const dynamicOpName = getOperationName(tx.metadata.operationType)
      if (dynamicOpName && dynamicOpName !== 'Unknown Operation') {
        return dynamicOpName
      }
    }

    // Second priority: Handle static operation types
    if (tx.metadata?.type) {
      switch (tx.metadata.type) {
        case 'RECOVERY_UPDATE':
          return tx.metadata.purpose === 'address_update' ? 'Recovery Address Update' : 'Recovery Ownership Transfer'
        case 'TIMELOCK_UPDATE':
          return 'TimeLock Period Update'
        case 'OWNERSHIP_TRANSFER':
          return 'Ownership Transfer'
        case 'BROADCASTER_UPDATE':
          return 'Broadcaster Update'
        default:
          // If it's not a known static type, it might be a dynamic type name
          return tx.metadata.type
      }
    }

    return 'Unknown Operation'
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Pending Meta Transactions</CardTitle>
              <Badge variant="default" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                {pendingTransactions.length} Pending
              </Badge>
            </div>
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
                  <div className="flex flex-col space-y-2 text-center sm:text-left">
                    <AlertDialog.Title className="text-lg font-semibold">Clear All Pending Transactions?</AlertDialog.Title>
                    <AlertDialog.Description className="text-sm text-muted-foreground">
                      This action will remove all pending meta transactions. This action cannot be undone.
                    </AlertDialog.Description>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                    <AlertDialog.Cancel asChild>
                      <Button variant="outline" className="mt-2 sm:mt-0">Cancel</Button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <Button variant="destructive" onClick={onClearAll}>Clear All</Button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Signed At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTransactions.map((tx) => (
                <TableRow 
                  key={tx.txId}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    !tx.metadata?.broadcasted && "cursor-pointer hover:bg-muted/50"
                  )}
                  onClick={() => {
                    if (!tx.metadata?.broadcasted && onTxClick) {
                      onTxClick(tx)
                    }
                  }}
                >
                  <TableCell className="font-mono">{tx.txId.slice(0, 10)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getTypeLabel(tx)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.metadata?.action === 'approve' ? 'default' : 'destructive'} className="capitalize">
                      {tx.metadata?.action || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTimestamp(tx.timestamp / 1000)}</TableCell>
                  <TableCell>
                    {tx.metadata?.broadcasted ? (
                      <Badge variant="default">Broadcasted</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveTransaction(tx.txId)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialog.Trigger>
                      <AlertDialog.Portal>
                        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
                          <div className="flex flex-col space-y-2 text-center sm:text-left">
                            <AlertDialog.Title className="text-lg font-semibold">Remove Transaction?</AlertDialog.Title>
                            <AlertDialog.Description className="text-sm text-muted-foreground">
                              This will remove the pending meta transaction. This action cannot be undone.
                            </AlertDialog.Description>
                          </div>
                          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                            <AlertDialog.Cancel asChild>
                              <Button variant="outline" className="mt-2 sm:mt-0">Cancel</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action asChild>
                              <Button variant="destructive" onClick={() => onRemoveTransaction(tx.txId)}>Remove</Button>
                            </AlertDialog.Action>
                          </div>
                        </AlertDialog.Content>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
} 