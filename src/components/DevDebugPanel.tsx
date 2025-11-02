import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  Network, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  BarChart3,
  Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGlobalTransactionMonitor } from '@/hooks/useGlobalTransactionMonitor'
import { env } from '@/config/env'

interface DevDebugPanelProps {
  className?: string
}

export function DevDebugPanel({ className }: DevDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<any>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [showStats, setShowStats] = useState(false)

  const {
    isAvailable,
    isDebuggingEnabled,
    transactions,
    getFilteredTransactions,
    getTransactionStats,
    clearAllTransactions,
    getNetworkInfo
  } = useGlobalTransactionMonitor()


  // Only render if debugging is enabled
  if (!env.VITE_ENABLE_TRANSACTION_DEBUGGING) {
    return null
  }

  const filteredTransactions = getFilteredTransactions({
    ...(filterStatus !== 'all' && { status: filterStatus }),
    ...(filterSource !== 'all' && { source: filterSource })
  })

  const stats = getTransactionStats()

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        const info = await getNetworkInfo()
        setNetworkInfo(info)
      } catch (error) {
        console.warn('Failed to fetch network info:', error)
      }
    }

    if (isAvailable) {
      fetchNetworkInfo()
    }
  }, [isAvailable, getNetworkInfo, refreshKey])

  const handleClearHistory = () => {
    clearAllTransactions()
    setRefreshKey(prev => prev + 1)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'simulated_success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
      case 'simulated_failure':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'simulation_error':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'pending':
        return <Activity className="h-4 w-4 text-blue-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'simulated_success':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      case 'error':
      case 'simulated_failure':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
      case 'simulation_error':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
      case 'pending':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'contract_call':
        return <Activity className="h-3 w-3" />
      case 'meta_tx':
        return <Network className="h-3 w-3" />
      case 'deployment':
        return <Bug className="h-3 w-3" />
      case 'simulation':
        return <Eye className="h-3 w-3" />
      default:
        return <Activity className="h-3 w-3" />
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatGasEstimate = (gas: bigint) => {
    return gas.toString()
  }

  return (
    <div className={`fixed bottom-4 right-4 z-[100] ${className}`}>
      <Card className="w-80 shadow-lg border border-orange-200 dark:border-orange-800">
        <CardHeader 
          className="pb-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-orange-500" />
              <CardTitle className="text-sm">Global Debug Panel</CardTitle>
              {transactions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {transactions.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={`text-xs ${
                  isDebuggingEnabled 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {isDebuggingEnabled ? 'ON' : 'OFF'}
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                {/* Network Info */}
                {networkInfo && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Network className="h-3 w-3" />
                      <span className="text-xs font-medium">Network</span>
                    </div>
                    <div className="text-xs space-y-1 pl-5">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <Badge variant="outline" className="text-xs">
                          {networkInfo.networkType}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Chain ID:</span>
                        <span className="font-mono">{networkInfo.chainId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Block:</span>
                        <span className="font-mono">{networkInfo.blockNumber.toString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>RPC:</span>
                        <span className="font-mono text-xs truncate max-w-32" title={networkInfo.rpcUrl}>
                          {networkInfo.rpcUrl.split('/').pop() || 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Separator className="my-3" />

                {/* Transaction History */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3" />
                      <span className="text-xs font-medium">Global Transactions</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowStats(!showStats)}
                        title="Toggle Statistics"
                      >
                        <BarChart3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        title="Refresh"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={handleClearHistory}
                        title="Clear All"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Statistics Panel */}
                  {showStats && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-2 rounded border border-border/50 bg-muted/30"
                    >
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-mono">{stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="font-mono text-green-500">{stats.success}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Error:</span>
                          <span className="font-mono text-red-500">{stats.error}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-mono text-blue-500">{stats.pending}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Filters */}
                  <div className="flex gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="simulated_success">Simulated Success</SelectItem>
                        <SelectItem value="simulated_failure">Simulated Failure</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger className="h-6 text-xs">
                        <SelectValue placeholder="Source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {Object.keys(stats.bySource).map(source => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-48">
                    {filteredTransactions.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No transactions found
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTransactions.slice(-10).reverse().map((tx) => (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-2 rounded border border-border/50 bg-muted/30"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex items-center gap-1">
                                {getStatusIcon(tx.status)}
                                {getTypeIcon(tx.type)}
                                <span className="text-xs font-medium truncate">
                                  {tx.operation}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${getStatusColor(tx.status)}`}
                                >
                                  {tx.status.replace('simulated_', '')}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                >
                                  {tx.type}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Time:</span>
                                <span className="font-mono">{formatTimestamp(tx.timestamp)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Source:</span>
                                <span className="font-mono text-xs truncate max-w-20" title={tx.source}>
                                  {tx.source}
                                </span>
                              </div>
                              {tx.gasEstimate && (
                                <div className="flex justify-between">
                                  <span>Gas:</span>
                                  <span className="font-mono">{formatGasEstimate(tx.gasEstimate)}</span>
                                </div>
                              )}
                              {tx.txHash && (
                                <div className="flex justify-between">
                                  <span>Hash:</span>
                                  <span className="font-mono text-xs truncate max-w-20" title={tx.txHash}>
                                    {tx.txHash.slice(0, 8)}...
                                  </span>
                                </div>
                              )}
                              {tx.error && (
                                <div className="text-red-500 text-xs truncate" title={tx.error}>
                                  Error: {tx.error}
                                </div>
                              )}
                              {tx.errorDetails?.revertReason && (
                                <div className="text-orange-500 text-xs truncate" title={tx.errorDetails.revertReason}>
                                  Revert: {tx.errorDetails.revertReason}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Debug Info */}
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Debugger:</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        isAvailable 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {isAvailable ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Mode:</span>
                    <span className="font-mono">{env.VITE_DEBUG_LOG_LEVEL}</span>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
