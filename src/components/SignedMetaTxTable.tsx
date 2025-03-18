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
import { cn } from '@/lib/utils'

interface ExtendedSignedTransaction {
  txId: string
  signedData: string
  timestamp: number
  metadata?: {
    type: 'RECOVERY_UPDATE' | 'TIMELOCK_UPDATE' | 'OWNERSHIP_TRANSFER' | 'BROADCASTER_UPDATE'
    purpose?: 'address_update' | 'ownership_transfer'
    action?: 'approve' | 'cancel'
    broadcasted: boolean
  }
}

interface SignedMetaTxTableProps {
  transactions: ExtendedSignedTransaction[]
  onClearAll: () => void
  onRemoveTransaction: (txId: string) => void
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

const getTypeLabel = (type: string, purpose?: string) => {
  switch (type) {
    case 'RECOVERY_UPDATE':
      return purpose === 'address_update' ? 'Recovery Address Update' : 'Recovery Ownership Transfer'
    case 'TIMELOCK_UPDATE':
      return 'TimeLock Period Update'
    case 'OWNERSHIP_TRANSFER':
      return 'Ownership Transfer'
    case 'BROADCASTER_UPDATE':
      return 'Broadcaster Update'
    default:
      return type
  }
}

export function SignedMetaTxTable({ transactions, onClearAll, onRemoveTransaction }: SignedMetaTxTableProps) {
  const pendingTransactions = transactions.filter(tx => !tx.metadata?.broadcasted)

  if (pendingTransactions.length === 0) {
    return null
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
                <TableRow key={tx.txId}>
                  <TableCell className="font-medium">{tx.txId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getTypeLabel(tx.metadata?.type || '', tx.metadata?.purpose)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.metadata?.action === 'approve' ? 'default' : 'destructive'} className="capitalize">
                      {tx.metadata?.action || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTimestamp(tx.timestamp / 1000)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex items-center w-fit gap-1">
                      <Network className="h-3 w-3" />
                      Pending Broadcast
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
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