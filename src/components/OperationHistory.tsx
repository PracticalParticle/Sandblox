import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  History,
  Clock,
  Hash,
  ChevronDown,
  Timer,
  Copy,
  Key,
  Radio,
  Shield,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Import types from the core SDK
import { TxStatus } from '@/particle-core/sdk/typescript/types/lib.index'
import { TxRecord as CoreTxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { OPERATION_TYPES, OperationType } from '@/particle-core/sdk/typescript/types/core.access.index'
import { Address } from 'viem'

// UI-specific types that extend core types
export interface UISecurityOperationDetails {
  oldValue: string
  newValue: string
  remainingTime: number
  requester?: Address
  target?: Address
}

export interface UITxRecord {
  txId: number
  type: string  // Changed from OperationType to string to match core type
  description: string
  status: number
  releaseTime: number
  timestamp: number
  details: Required<UISecurityOperationDetails>
}

// Mapping functions between core types and UI types
const mapCoreStatusToUIStatus = (status: number): number => {
  return status;
};

export const mapCoreTxRecordToUITxRecord = (
  coreTxRecord: CoreTxRecord, 
  details: UISecurityOperationDetails
): UITxRecord => {
  return {
    txId: Number(coreTxRecord.txId),
    type: coreTxRecord.operationType,
    description: getOperationDescription(coreTxRecord.operationType, details.newValue),
    status: Number(coreTxRecord.status),
    releaseTime: Number(coreTxRecord.releaseTime),
    timestamp: Math.floor(Date.now() / 1000),
    details: {
      oldValue: details.oldValue,
      newValue: details.newValue,
      remainingTime: details.remainingTime,
      requester: coreTxRecord.requester,
      target: coreTxRecord.target
    }
  };
};

// Utility functions
const formatHexValue = (value: string): string => {
  if (value.startsWith('0x')) {
    if (value.length <= 42) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
  return value;
};

const formatTimeValue = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  if (isNaN(numValue)) return value.toString();
  
  if (numValue === 0) return '0 days';
  if (numValue === 1) return '1 day';
  return `${numValue} days`;
};

const formatValue = (value: string, type: string): string => {
  if (!value || value === '0x0' || value === '0x') return '-';

  switch (type) {
    case 'OWNERSHIP_UPDATE':
    case 'BROADCASTER_UPDATE':
    case 'RECOVERY_UPDATE':
      return formatHexValue(value);
    case 'TIMELOCK_UPDATE':
      return formatTimeValue(value);
    default:
      return formatHexValue(value);
  }
};

const getOperationTitle = (type: string): string => {
  switch (type) {
    case 'OWNERSHIP_UPDATE':
      return 'Ownership Transfer';
    case 'BROADCASTER_UPDATE':
      return 'Broadcaster Update';
    case 'RECOVERY_UPDATE':
      return 'Recovery Update';
    case 'TIMELOCK_UPDATE':
      return 'TimeLock Update';
    default:
      return 'Unknown Operation';
  }
};

const getOperationDescription = (type: string, newValue: string): string => {
  const formattedValue = formatValue(newValue, type);
  switch (type) {
    case 'OWNERSHIP_UPDATE':
      return `Transfer ownership to ${formattedValue}`;
    case 'BROADCASTER_UPDATE':
      return `Update broadcaster to ${formattedValue}`;
    case 'RECOVERY_UPDATE':
      return `Update recovery address to ${formattedValue}`;
    case 'TIMELOCK_UPDATE':
      return `Update timelock period to ${formattedValue}`;
    default:
      return 'Unknown operation';
  }
};

const getOperationIcon = (type: string) => {
  switch (type) {
    case 'OWNERSHIP_UPDATE':
      return <Key className="h-3 w-3" />;
    case 'BROADCASTER_UPDATE':
      return <Radio className="h-3 w-3" />;
    case 'RECOVERY_UPDATE':
      return <Shield className="h-3 w-3" />;
    case 'TIMELOCK_UPDATE':
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
};

const getStatusColor = (status: number): { bg: string; text: string; icon: JSX.Element } => {
  switch (status) {
    case TxStatus.COMPLETED:
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-500',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      };
    case TxStatus.PENDING:
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-500',
        icon: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
      };
    case TxStatus.CANCELLED:
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        icon: <XCircle className="h-3.5 w-3.5 text-red-500" />
      };
    case TxStatus.FAILED:
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        icon: <XCircle className="h-3.5 w-3.5 text-red-500" />
      };
    case TxStatus.REJECTED:
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-500',
        icon: <XCircle className="h-3.5 w-3.5 text-orange-500" />
      };
    case TxStatus.UNDEFINED:
    default:
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-500',
        icon: <AlertCircle className="h-3.5 w-3.5 text-gray-500" />
      };
  }
};

const getStatusVariant = (status: number): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case TxStatus.COMPLETED:
      return "default";
    case TxStatus.PENDING:
      return "secondary";
    case TxStatus.CANCELLED:
    case TxStatus.FAILED:
      return "destructive";
    case TxStatus.REJECTED:
      return "destructive";
    case TxStatus.UNDEFINED:
    default:
      return "outline";
  }
};

const getStatusName = (status: number): string => {
  return Object.entries(TxStatus)
    .find(([_, value]) => value === status)?.[0]
    ?.toLowerCase() || 'unknown';
};

interface OperationHistoryProps {
  operations: UITxRecord[]
  title?: string
  showFilters?: boolean
  onApprove?: (txId: number, type: string) => Promise<void>
  onCancel?: (txId: number, type: string) => Promise<void>
  className?: string
  isLoading?: boolean
}

export function OperationHistory({
  operations,
  title = "Operation History",
  showFilters = true,
  onApprove,
  onCancel,
  className = "",
  isLoading = false
}: OperationHistoryProps) {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<number[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const statusEntries = Object.entries(TxStatus)
    .filter(([key]) => !isNaN(Number(key)))
    .map(([key, value]) => ({ key: Number(key), value }))

  const typeEntries = Object.entries(OPERATION_TYPES)
    .map(([key, value]) => ({ key, value }))

  const filteredOperations = operations.filter(op => {
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(op.status)
    const matchesType = typeFilter.length === 0 || typeFilter.includes(op.type)
    return matchesStatus && matchesType
  })

  const handleCopyTxId = (txId: number) => {
    navigator.clipboard.writeText(txId.toString())
    toast({
      title: "Copied!",
      description: "Transaction ID copied to clipboard"
    })
  }

  const toggleStatusFilter = (status: number) => {
    setStatusFilter(prev => 
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const toggleTypeFilter = (type: string) => {
    setTypeFilter(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  return (
    <Card className={`p-6 ${className}`}>
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center justify-between mb-6">
          <CardTitle>{title}</CardTitle>
          {showFilters && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusEntries.map(({ key, value }) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => toggleStatusFilter(key)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-4 h-4 border rounded flex items-center justify-center">
                        {statusFilter.includes(key) && "✓"}
                      </div>
                      {value.toString().charAt(0).toUpperCase() + value.toString().slice(1).toLowerCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Type
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {typeEntries.map(({ key, value }) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => toggleTypeFilter(key)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-4 h-4 border rounded flex items-center justify-center">
                        {typeFilter.includes(key) && "✓"}
                      </div>
                      {key.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                      ).join(' ')}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardHeader>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <History className="h-12 w-12 mb-4 opacity-50" />
            </motion.div>
            <p className="text-sm font-medium">Loading operations...</p>
          </div>
        ) : filteredOperations.length > 0 ? (
          filteredOperations
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((event) => {
              const statusStyle = getStatusColor(event.status);
              const icon = getOperationIcon(event.type);
              return (
                <Collapsible key={event.txId}>
                  <div className="group border rounded-lg bg-background">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 hover:bg-accent/5 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`rounded-full p-2 ${statusStyle.bg} shrink-0`}>
                            {statusStyle.icon}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold truncate">
                                {getOperationTitle(event.type)}
                              </h3>
                              <Badge 
                                variant={getStatusVariant(event.status)}
                                className="capitalize"
                              >
                                {getStatusName(event.status)}
                              </Badge>
                              {event.status === TxStatus.PENDING && event.details.remainingTime > 0 && (
                                <span className="flex items-center gap-1 text-xs text-yellow-500">
                                  <Timer className="h-3 w-3" />
                                  {Math.floor(event.details.remainingTime / 86400)}d {Math.floor((event.details.remainingTime % 86400) / 3600)}h
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(event.timestamp * 1000).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {event.txId}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyTxId(event.txId);
                                  }}
                                >
                                  <span className="sr-only">Copy transaction ID</span>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy transaction ID</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-4 pb-3 pt-1">
                        <p className="text-sm text-muted-foreground mb-3">
                          {getOperationDescription(event.type, event.details.newValue)}
                        </p>
                        
                        <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
                            <div className="flex items-center gap-2 text-sm">
                              {icon}
                              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {formatValue(event.details.oldValue, event.type)}
                              </code>
                            </div>
                          </div>
                          <div className="text-muted-foreground">→</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
                            <div className="flex items-center gap-2 text-sm">
                              {icon}
                              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {formatValue(event.details.newValue, event.type)}
                              </code>
                            </div>
                          </div>
                        </div>

                        {(onApprove || onCancel) && event.status === TxStatus.PENDING && (
                          <div className="flex items-center justify-end gap-2 mt-3">
                            {onApprove && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={event.releaseTime > Math.floor(Date.now() / 1000)}
                                onClick={() => onApprove(event.txId, event.type)}
                              >
                                Approve
                              </Button>
                            )}
                            {onCancel && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={event.releaseTime > Math.floor(Date.now() / 1000)}
                                onClick={() => onCancel(event.txId, event.type)}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm font-medium">No operations available</p>
            <p className="text-xs mt-1">Operations will appear here once executed</p>
          </div>
        )}
      </div>
    </Card>
  )
} 