import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus, ExecutionType } from '../particle-core/sdk/typescript/types/lib.index'
import { formatAddress, formatTimestamp, isValidEthereumAddress } from '@/lib/utils'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  Key,
  Timer,
  Network,
  Wallet,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TemporalActionContent } from './TemporalActionContent'
import { MetaTxActionContent } from './MetaTxActionContent'

// Status badge variants mapping with enhanced styling
const statusVariants: { [key: number]: { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; bgColor: string; textColor: string } } = {
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
const executionTypeToHuman: { [key: number]: { text: string; icon: React.ReactNode; description: string } } = {
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

interface TxDetailsDialogProps {
  record: TxRecord | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  operationName: string
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
  connectedAddress?: string
  onApprove?: (txId: number) => Promise<void>
  onCancel?: (txId: number) => Promise<void>
  onSubmit?: (newValue: string) => Promise<void>
  onNewValueChange?: (value: string) => void
  newValue?: string
  validateNewValue?: (value: string) => { isValid: boolean; message: string }
  isSigning?: boolean
}

export function TxDetailsDialog({ 
  record, 
  isOpen, 
  onOpenChange, 
  operationName,
  contractInfo,
  connectedAddress,
  onApprove,
  onCancel,
  onSubmit,
  onNewValueChange,
  newValue,
  validateNewValue,
  isSigning
}: TxDetailsDialogProps) {
  // Local state for form values and UI state
  const [localNewValue, setLocalNewValue] = useState('')
  const [isLocalSigning, setIsLocalSigning] = useState(false)

  if (!record) return null

  const isPending = record.status === TxStatus.PENDING
  const statusVariant = statusVariants[record.status]
  const isMetaTx = record.params.executionType === ExecutionType.RAW
  const isTemporalTx = record.params.executionType === ExecutionType.STANDARD

  // Determine required role based on operation type and execution type
  const getRequiredRole = () => {
    if (isMetaTx) {
      return 'owner' // Meta transactions are always signed by owner
    }
    
    if (isTemporalTx) {
      switch (operationName.toLowerCase()) {
        case 'ownership_transfer':
          return isPending ? 'owner_or_recovery' : 'recovery'
        case 'broadcaster_update':
          return 'owner'
        case 'recovery_update':
          return 'owner'
        default:
          return 'owner'
      }
    }

    return 'owner'
  }

  // Default validation function if none provided
  const defaultValidateNewValue = (value: string) => ({
    isValid: isValidEthereumAddress(value),
    message: "Please enter a valid Ethereum address"
  })

  const handleNewValueChange = (value: string) => {
    setLocalNewValue(value)
    onNewValueChange?.(value)
  }

  const handleSubmit = async () => {
    if (!onSubmit) return
    setIsLocalSigning(true)
    try {
      await onSubmit(newValue || localNewValue)
    } finally {
      setIsLocalSigning(false)
    }
  }

  const renderActionContent = () => {
    if (!isPending) return null

    const commonProps = {
      contractInfo,
      actionType: operationName,
      currentValue: record.params.target,
      currentValueLabel: "Target Address",
      requiredRole: getRequiredRole(),
      connectedAddress,
      isOpen,
      onOpenChange,
      newValue: newValue || localNewValue,
      onNewValueChange: handleNewValueChange,
      validateNewValue: validateNewValue || defaultValidateNewValue,
      isSigning: isSigning || isLocalSigning
    }

    if (isMetaTx) {
      return (
        <MetaTxActionContent
          {...commonProps}
          actionLabel="Sign"
          onSubmit={handleSubmit}
        />
      )
    }

    if (isTemporalTx) {
      return (
        <TemporalActionContent
          {...commonProps}
          actionLabel="Approve"
          pendingTx={record}
          onApprove={onApprove}
          onCancel={onCancel}
        />
      )
    }

    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transaction Details
            <Badge 
              variant={statusVariant.variant}
              className={`flex items-center gap-1 ${statusVariant.bgColor} ${statusVariant.textColor}`}
            >
              {statusVariant.icon}
              <span>{statusToHuman[record.status]}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <div className="flex items-center gap-2">
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
            </div>
            <span className="text-muted-foreground">(ID: {record.txId.toString()})</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Execution Type Badge */}
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

          {/* Main Info Card */}
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

          {/* Action Content for Pending Transactions */}
          {renderActionContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 