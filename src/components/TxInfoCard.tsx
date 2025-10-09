import { TxRecord } from '../Guardian/sdk/typescript/interfaces/lib.index'
import { ExecutionType, TxStatus } from '../Guardian/sdk/typescript/types/lib.index'
import { formatAddress, formatTimestamp } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Network, 
  Timer,
  Wallet,
  User,
  Target,
  Activity
} from 'lucide-react'
import { ReactNode } from 'react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Status badge variants mapping with enhanced styling
const statusVariants: { 
  [key: number]: { 
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: ReactNode;
    bgColor: string;
    textColor: string;
  } 
} = {
  [TxStatus.UNDEFINED]: { 
    variant: "outline", 
    icon: <AlertTriangle className="h-3 w-3" />,
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-500"
  },
  [TxStatus.PENDING]: { 
    variant: "secondary", 
    icon: <Clock className="h-3 w-3" />,
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-500"
  },
  [TxStatus.CANCELLED]: { 
    variant: "destructive", 
    icon: <XCircle className="h-3 w-3" />,
    bgColor: "bg-red-500/10",
    textColor: "text-red-500"
  },
  [TxStatus.COMPLETED]: { 
    variant: "default", 
    icon: <CheckCircle2 className="h-3 w-3" />,
    bgColor: "bg-green-500/10",
    textColor: "text-green-500"
  },
  [TxStatus.FAILED]: { 
    variant: "destructive", 
    icon: <XCircle className="h-3 w-3" />,
    bgColor: "bg-red-500/10",
    textColor: "text-red-500"
  },
  [TxStatus.REJECTED]: { 
    variant: "destructive", 
    icon: <XCircle className="h-3 w-3" />,
    bgColor: "bg-red-500/10",
    textColor: "text-red-500"
  }
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

// Execution type to human-readable text with icons
const executionTypeToHuman: { 
  [key: number]: { 
    text: string;
    icon: ReactNode;
    description: string;
  } 
} = {
  [ExecutionType.NONE]: { 
    text: 'None',
    icon: <Network className="h-3 w-3" />,
    description: 'No specific execution type'
  },
  [ExecutionType.STANDARD]: { 
    text: 'Standard',
    icon: <Timer className="h-3 w-3" />,
    description: 'Two-phase temporal security'
  },
  [ExecutionType.RAW]: { 
    text: 'Raw',
    icon: <Network className="h-3 w-3" />,
    description: 'Single-phase meta tx security'
  }
}

interface TxInfoCardProps {
  record: TxRecord
  className?: string
  operationName?: string
  showExecutionType?: boolean
  showStatus?: boolean
  txId?: boolean
}

export function TxInfoCard({ 
  record, 
  className = "",
  operationName,
  showExecutionType = true,
  showStatus = true,
  txId = true
}: TxInfoCardProps) {
  const statusVariant = statusVariants[record.status]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Status and Operation Type */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {operationName && (
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      <span className="truncate max-w-[100px] sm:max-w-none">
                        {operationName}
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>Operation Type</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {txId && (
            <span className="text-xs text-muted-foreground">ID: {record.txId.toString()}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {showExecutionType && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {executionTypeToHuman[record.params.executionType].icon}
                    <span>{executionTypeToHuman[record.params.executionType].text}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{executionTypeToHuman[record.params.executionType].description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {showStatus && (
            <Badge 
              variant={statusVariant.variant}
              className={cn("flex items-center gap-1", statusVariant.bgColor, statusVariant.textColor)}
            >
              {statusVariant.icon}
              <span>{statusToHuman[record.status]}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Main Card Content */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Roles Section */}
          <div className="space-y-0 divide-y divide-border">
            <div className="p-4 bg-muted/50">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Requester</span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {formatAddress(record.params.requester)}
                </span>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Target</span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {formatAddress(record.params.target)}
                </span>
              </div>
            </div>
          </div>
          
          <Separator />

          {/* Transaction Details */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Release Time</h4>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm">{formatTimestamp(Number(record.releaseTime))}</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Value</h4>
              <div className="flex items-center gap-2">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm font-mono">{record.params.value.toString()}</p>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Gas Limit</h4>
              <div className="flex items-center gap-2">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm font-mono">{record.params.gasLimit.toString()}</p>
              </div>
            </div>
          </div>

          {/* Payment Details Section */}
          {record.payment && (
            <>
              <Separator />
              <div className="p-4 space-y-4 bg-muted/30">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Recipient</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatAddress(record.payment.recipient)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Native Token Amount</h4>
                    <p className="text-sm font-mono">{record.payment.nativeTokenAmount.toString()}</p>
                  </div>
                  
                  {record.payment.erc20TokenAmount > 0n && (
                    <>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">ERC20 Token</h4>
                        <p className="text-sm font-mono">{formatAddress(record.payment.erc20TokenAddress)}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">ERC20 Amount</h4>
                        <p className="text-sm font-mono">{record.payment.erc20TokenAmount.toString()}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 