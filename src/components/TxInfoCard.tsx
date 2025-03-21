import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { ExecutionType, TxStatus } from '../particle-core/sdk/typescript/types/lib.index'
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
  Wallet
} from 'lucide-react'
import { ReactNode } from 'react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

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
    <div className={`space-y-4 ${className}`}>
      {/* Header with Status and Operation Type */}
      {(showStatus || operationName) && (
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            {operationName && (
              <>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        Operation Type
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Type of operation being performed</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-muted-foreground">{operationName}</span>
              </>
            )}
            {txId && (
              <span className="text-muted-foreground">(ID: {record.txId.toString()})</span>
            )}
          </div>
          
          {showStatus && (
            <Badge 
              variant={statusVariant.variant}
              className={`flex items-center gap-1 ${statusVariant.bgColor} ${statusVariant.textColor}`}
            >
              {statusVariant.icon}
              <span>{statusToHuman[record.status]}</span>
            </Badge>
          )}
        </div>
      )}

      {/* Execution Type Badge */}
      {showExecutionType && (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {executionTypeToHuman[record.params.executionType].icon}
                  <span>{executionTypeToHuman[record.params.executionType].text}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{executionTypeToHuman[record.params.executionType].description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Main Card Content */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Roles Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono shrink-0">
                  Requester
                </Badge>
                <span className="font-mono text-sm">{formatAddress(record.params.requester)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono shrink-0">
                  Target
                </Badge>
                <span className="font-mono text-sm">{formatAddress(record.params.target)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Transaction Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Release Time</h4>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{formatTimestamp(Number(record.releaseTime))}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Value</h4>
              <div className="flex items-center gap-2">
                <Wallet className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{record.params.value.toString()}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Gas Limit</h4>
              <p className="text-sm text-muted-foreground">{record.params.gasLimit.toString()}</p>
            </div>
          </div>

          {/* Payment Details Section */}
          {record.payment && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Payment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Recipient</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500/10 text-green-500">
                        <Wallet className="h-3 w-3 mr-1" />
                        <span className="font-mono text-xs">{formatAddress(record.payment.recipient)}</span>
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Native Token Amount</h4>
                    <p className="text-sm text-muted-foreground">{record.payment.nativeTokenAmount.toString()}</p>
                  </div>
                  {record.payment.erc20TokenAmount > 0n && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium mb-1">ERC20 Token</h4>
                        <p className="text-sm font-mono text-muted-foreground">{formatAddress(record.payment.erc20TokenAddress)}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">ERC20 Amount</h4>
                        <p className="text-sm text-muted-foreground">{record.payment.erc20TokenAmount.toString()}</p>
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