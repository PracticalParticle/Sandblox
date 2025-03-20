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
import { Address, Hex } from 'viem'
import { useState } from 'react'
import { TxDetailsDialog } from './TxDetailsDialog'
import { TxStatus, ExecutionType } from '../particle-core/sdk/typescript/types/lib.index'
import { TxRecord, TxParams, PaymentDetails } from '../particle-core/sdk/typescript/interfaces/lib.index'

interface ExtendedSignedTransaction {
  txId: string
  signedData: string
  timestamp: number
  metadata?: {
    type: string
    purpose?: 'address_update' | 'ownership_transfer'
    action?: 'approve' | 'cancel'
    broadcasted: boolean
    operationType?: `0x${string}`
  }
}

interface SignedMetaTxTableProps {
  transactions: ExtendedSignedTransaction[]
  onClearAll: () => void
  onRemoveTransaction: (txId: string) => void
  contractAddress: Address
  contractInfo: {
    contractAddress: string
    timeLockPeriodInMinutes: number
    chainId: number
    chainName: string
    broadcaster: string
    owner: string
    recoveryAddress: string
    [key: string]: any
  }
  connectedAddress?: Address
  onBroadcast?: (txId: string, actionType?: string) => Promise<void>
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

export function SignedMetaTxTable({ 
  transactions, 
  onClearAll, 
  onRemoveTransaction, 
  contractAddress, 
  contractInfo,
  connectedAddress,
  onBroadcast
}: SignedMetaTxTableProps) {
  const { getOperationName } = useOperationTypes(contractAddress)
  const [selectedTx, setSelectedTx] = useState<ExtendedSignedTransaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Filter out any transactions that have been broadcasted
  const pendingTransactions = transactions.filter(tx => !tx.metadata?.broadcasted)

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
        case 'RECOVERY_ADDRESS_UPDATE':
          return 'Recovery Address Update'
        default:
          // If it's not a known static type, it might be a dynamic type name
          return tx.metadata.type
      }
    }

    return 'Unknown Operation'
  }

  // Handle row click to show transaction details
  const handleRowClick = (tx: ExtendedSignedTransaction) => {
    setSelectedTx(tx)
    setDetailsOpen(true)
  }

  // Handle broadcasting of a transaction
  const handleBroadcast = async () => {
    if (!selectedTx || !onBroadcast) return
    
    try {
      // Extract type from metadata or use a default value
      const actionType = selectedTx.metadata?.type || getTypeLabel(selectedTx)
      await onBroadcast(selectedTx.txId, actionType)
      
      // The parent component will handle removing the transaction from storage
      // and updating its state. We just need to close the dialog.
      setDetailsOpen(false)
      // Clear the selected transaction
      setSelectedTx(null)
    } catch (error) {
      console.error('Error broadcasting transaction:', error)
    }
  }

  // Convert to TxRecord format expected by TxDetailsDialog
  const convertToTxRecord = (tx: ExtendedSignedTransaction): TxRecord | null => {
    if (!tx) return null
    
    // Create a TxRecord object from the signed transaction data
    const params: TxParams = {
      requester: contractInfo.owner as Address,
      target: contractInfo.contractAddress as Address,
      value: BigInt(0),
      gasLimit: BigInt(300000),
      operationType: (tx.metadata?.operationType || '0x00000000') as Hex,
      executionType: ExecutionType.RAW,
      executionOptions: '0x' as Hex
    }

    const payment: PaymentDetails = {
      recipient: '0x0000000000000000000000000000000000000000' as Address,
      nativeTokenAmount: BigInt(0),
      erc20TokenAddress: '0x0000000000000000000000000000000000000000' as Address,
      erc20TokenAmount: BigInt(0)
    }

    // For signed meta transactions, ensure they are correctly identified
    // as pending and already signed (result is '0x')
    return {
      txId: BigInt(tx.txId),
      releaseTime: BigInt(tx.timestamp),
      status: TxStatus.PENDING,
      params,
      result: '0x' as Hex,
      payment
    }
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
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(tx)}
                >
                  <TableCell className="font-medium">{tx.txId}</TableCell>
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
                    <Badge variant="secondary" className="flex items-center w-fit gap-1">
                      <Network className="h-3 w-3" />
                      Pending Broadcast
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click when clicking delete button
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
                              <Button 
                                variant="destructive" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveTransaction(tx.txId);
                                }}
                              >
                                Remove
                              </Button>
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