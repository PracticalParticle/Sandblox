import { motion } from 'framer-motion'
import { TxRecord, TxStatus } from '../Guardian/sdk/typescript'
import { Hex } from 'viem'
import { formatTimestamp } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Removed unused Tooltip imports
import { 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  MoreHorizontal,
  Eye,
  Calendar,
  Hash
} from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAccount, useConfig } from 'wagmi'
import { SecureContractInfo } from '@/lib/types'
import { useOperationTypes } from '@/hooks/useOperationTypes'
import { useTransactionData } from '@/hooks/useTransactionData'
import { TxDetailsDialog } from './TxDetailsDialog'
import { PendingTransactionDialog } from './PendingTransactionDialog'
import { SecureOwnable } from '@/Guardian/sdk/typescript/contracts/SecureOwnable'
import { DynamicRBAC } from '@/Guardian/sdk/typescript/contracts/DynamicRBAC'
import { Definitions } from '@/Guardian/sdk/typescript/lib/Definition'

// Status badge variants mapping
const statusVariants: { [key: number]: { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode } } = {
  [TxStatus.UNDEFINED]: { variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
  [TxStatus.PENDING]: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  [TxStatus.CANCELLED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  [TxStatus.COMPLETED]: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  [TxStatus.FAILED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  [TxStatus.REJECTED]: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> }
}

const statusToHuman: { [key: number]: string } = {
  [TxStatus.UNDEFINED]: "Undefined",
  [TxStatus.PENDING]: "Pending",
  [TxStatus.CANCELLED]: "Cancelled",
  [TxStatus.COMPLETED]: "Completed",
  [TxStatus.FAILED]: "Failed",
  [TxStatus.REJECTED]: "Rejected"
}

// PendingBadge component for progress tracking
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

export interface TransactionManagerProps {
  contractAddress: `0x${string}`
  contractInfo: SecureContractInfo & { bloxId?: string }
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  onMetaTxSign?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>
  onBroadcastMetaTx?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>
  showMetaTxOption?: boolean
  refreshData?: () => void
  refreshSignedTransactions?: () => void
  onNotification?: (notification: { type: string; title: string; description: string }) => void
  // Guardian SDK instances for permission checking
  secureOwnable?: SecureOwnable
  dynamicRBAC?: DynamicRBAC
  definitions?: Definitions
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

export function TransactionManager({
  contractAddress,
  contractInfo,
  onApprove,
  onCancel,
  onMetaTxSign,
  onBroadcastMetaTx,
  showMetaTxOption,
  refreshData,
  refreshSignedTransactions,
  onNotification,
  secureOwnable,
  dynamicRBAC,
  definitions
}: TransactionManagerProps) {
  
  // Debug logging for SDK instances in TransactionManager
  console.log('🔍 TransactionManager received SDK instances:', {
    contractAddress,
    secureOwnable: !!secureOwnable,
    dynamicRBAC: !!dynamicRBAC,
    definitions: !!definitions,
    secureOwnableType: secureOwnable?.constructor.name,
    dynamicRBACType: dynamicRBAC?.constructor.name,
    definitionsType: definitions?.constructor.name
  });
  const { address: connectedAddress } = useAccount()
  const config = useConfig()
  const { getOperationName } = useOperationTypes(contractAddress)

  // Get chain from config
  const chain = config.chains.find(c => c.id === contractInfo.chainId) || config.chains[0]

  // Use the new transaction data hook
  const { 
    pendingTransactions, 
    allTransactions, 
    isLoading, 
    error: transactionError, 
    refresh: refreshTransactionData 
  } = useTransactionData({ 
    contractAddress, 
    chain 
  })

  // State management
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [selectedTransaction, setSelectedTransaction] = useState<TxRecord | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isOperationDialogOpen, setIsOperationDialogOpen] = useState(false)
  const [operationTx, setOperationTx] = useState<TxRecord | null>(null)

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [operationTypeFilter, setOperationTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'txId' | 'releaseTime' | 'status'>('txId')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination state
  const [pageSize] = useState(25)
  const [showMore, setShowMore] = useState(false)



  // No need for separate data fetching - handled by the hook

  // Get operation types for filtering
  const operationTypes = useMemo(() => {
    const types = new Map<string, string>()
    const allTxs = activeTab === 'pending' ? pendingTransactions : allTransactions
    
    allTxs.forEach(tx => {
      const operationName = getOperationName(tx.params.operationType as Hex)
      types.set(tx.params.operationType, operationName)
    })
    
    return types
  }, [activeTab, pendingTransactions, allTransactions, getOperationName])

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    const transactions = activeTab === 'pending' ? pendingTransactions : allTransactions
    
    let filtered = transactions.filter(tx => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const txId = tx.txId.toString()
        const operationName = getOperationName(tx.params.operationType as Hex).toLowerCase()
        const status = statusToHuman[tx.status].toLowerCase()
        
        if (!txId.includes(searchLower) && 
            !operationName.includes(searchLower) && 
            !status.includes(searchLower)) {
          return false
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const statusValue = parseInt(statusFilter)
        if (tx.status !== statusValue) return false
      }

      // Operation type filter
      if (operationTypeFilter !== 'all') {
        if (tx.params.operationType !== operationTypeFilter) return false
      }

      return true
    })

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'txId':
          comparison = Number(a.txId) - Number(b.txId)
          break
        case 'releaseTime':
          comparison = Number(a.releaseTime) - Number(b.releaseTime)
          break
        case 'status':
          comparison = a.status - b.status
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [activeTab, pendingTransactions, allTransactions, searchTerm, statusFilter, operationTypeFilter, searchTerm, sortBy, sortOrder, getOperationName])

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const endIndex = pageSize
    return filteredTransactions.slice(0, showMore ? filteredTransactions.length : endIndex)
  }, [filteredTransactions, pageSize, showMore])

  const hasMore = filteredTransactions.length > pageSize && !showMore

  // Handle transaction click
  const handleTransactionClick = useCallback((record: TxRecord) => {
    if (record.status === TxStatus.PENDING) {
      setOperationTx(record)
      setIsOperationDialogOpen(true)
    } else {
      setSelectedTransaction(record)
      setIsDetailsOpen(true)
    }
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refreshTransactionData()
    refreshData?.()
    refreshSignedTransactions?.()
  }, [refreshTransactionData, refreshData, refreshSignedTransactions])

  // Handle meta transaction signing
  const handleMetaTxSign = useCallback(async (tx: TxRecord, type: 'approve' | 'cancel') => {
    if (onMetaTxSign) {
      try {
        await onMetaTxSign(tx, type)
      } catch (error) {
        console.error('Error signing meta transaction:', error)
        onNotification?.({
          type: 'error',
          title: 'Signing Error',
          description: error instanceof Error ? error.message : 'Unknown error during signing'
        })
      }
    }
  }, [onMetaTxSign, onNotification])

  // Handle meta transaction broadcasting
  const handleBroadcastMetaTx = useCallback(async (tx: TxRecord, type: 'approve' | 'cancel') => {
    if (onBroadcastMetaTx) {
      try {
        await onBroadcastMetaTx(tx, type)
      } catch (error) {
        console.error('Error broadcasting meta transaction:', error)
        onNotification?.({
          type: 'error',
          title: 'Broadcast Error',
          description: error instanceof Error ? error.message : 'Unknown error during broadcasting'
        })
      }
    }
  }, [onBroadcastMetaTx, onNotification])

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction Manager</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transactionError && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-medium">Transaction Error</span>
              </div>
              <p className="text-sm text-destructive mt-1">{transactionError}</p>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pending' | 'history')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Transactions
                {pendingTransactions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {pendingTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                History
                {allTransactions.length > 0 && (
                  <Badge variant="outline" className="ml-1">
                    {allTransactions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              <div className="space-y-4">
                {/* Filters and Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {Object.entries(statusToHuman).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={operationTypeFilter} onValueChange={setOperationTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Operation" />
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

                {/* Transactions Table */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
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
                      {paginatedTransactions.map((record) => (
                        <TableRow 
                          key={record.txId.toString()}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleTransactionClick(record)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Hash className="h-3 w-3 text-muted-foreground" />
                              {record.txId.toString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getOperationName(record.params.operationType as Hex)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.status === TxStatus.PENDING ? (
                              <div className="flex flex-col gap-2">
                                <PendingBadge record={record} contractInfo={contractInfo} />
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
                                e.stopPropagation()
                                handleTransactionClick(record)
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {record.status === TxStatus.PENDING ? 'Manage' : 'View'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedTransactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {isLoading ? 'Loading...' : 'No pending transactions found'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Pagination */}
                {hasMore && (
                  <div className="flex items-center justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowMore(true)}
                      className="gap-2"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      Show More ({filteredTransactions.length - pageSize} remaining)
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <div className="space-y-4">
                {/* Filters and Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search transaction history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {Object.entries(statusToHuman).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={operationTypeFilter} onValueChange={setOperationTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Operation" />
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
                    <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                      const [field, order] = value.split('-')
                      setSortBy(field as 'txId' | 'releaseTime' | 'status')
                      setSortOrder(order as 'asc' | 'desc')
                    }}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="txId-desc">ID (Newest)</SelectItem>
                        <SelectItem value="txId-asc">ID (Oldest)</SelectItem>
                        <SelectItem value="releaseTime-desc">Release Time (Latest)</SelectItem>
                        <SelectItem value="releaseTime-asc">Release Time (Earliest)</SelectItem>
                        <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                        <SelectItem value="status-desc">Status (Z-A)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* History Table */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
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
                      {paginatedTransactions.map((record) => (
                        <TableRow 
                          key={record.txId.toString()}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleTransactionClick(record)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Hash className="h-3 w-3 text-muted-foreground" />
                              {record.txId.toString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getOperationName(record.params.operationType as Hex)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={statusVariants[record.status]?.variant || "outline"}
                              className="flex w-24 items-center justify-center gap-1.5 py-1"
                            >
                              {statusVariants[record.status]?.icon}
                              <span>{statusToHuman[record.status]}</span>
                            </Badge>
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
                                e.stopPropagation()
                                handleTransactionClick(record)
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedTransactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {isLoading ? 'Loading...' : 'No transaction history found'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Pagination */}
                {hasMore && (
                  <div className="flex items-center justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowMore(true)}
                      className="gap-2"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      Show More ({filteredTransactions.length - pageSize} remaining)
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Dialogs */}
          {selectedTransaction && (
            <>
              {(selectedTransaction.status === TxStatus.COMPLETED || 
                selectedTransaction.status === TxStatus.CANCELLED || 
                selectedTransaction.status === TxStatus.FAILED ||
                selectedTransaction.status === TxStatus.REJECTED) && (
                <TxDetailsDialog
                  isOpen={isDetailsOpen}
                  onOpenChange={setIsDetailsOpen}
                  record={selectedTransaction}
                  operationName={getOperationName(selectedTransaction.params.operationType as Hex)}
                />
              )}
            </>
          )}

          {operationTx && (
            <PendingTransactionDialog
              isOpen={isOperationDialogOpen}
              onOpenChange={setIsOperationDialogOpen}
              title={`Transaction #${operationTx.txId.toString()}`}
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
              transaction={operationTx}
              onApprove={onApprove}
              onCancel={onCancel}
              onMetaTxSign={handleMetaTxSign}
              onBroadcastMetaTx={handleBroadcastMetaTx}
              onNotification={onNotification}
              isLoading={false}
              connectedAddress={connectedAddress}
              showMetaTxOption={showMetaTxOption}
              refreshData={refreshData}
              mode="timelock"
              // Guardian SDK instances for permission checking
              secureOwnable={secureOwnable}
              dynamicRBAC={dynamicRBAC}
              definitions={definitions}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
