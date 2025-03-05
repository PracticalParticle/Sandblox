import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus, ExecutionType } from '@/particle-core/sdk/typescript/types/lib.index'
import { formatAddress, formatTimestamp } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

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

interface TxDetailsDialogProps {
  record: TxRecord | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  operationName: string
}

export function TxDetailsDialog({ record, isOpen, onOpenChange, operationName }: TxDetailsDialogProps) {
  if (!record) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Transaction Details
            <Badge 
              variant={statusVariants[record.status]?.variant || "outline"}
              className="flex items-center gap-1"
            >
              {statusVariants[record.status]?.icon}
              <span>{statusToHuman[record.status]}</span>
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Details for {operationName} operation (ID: {record.txId.toString()})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Operation Type</h4>
              <p className="text-sm text-muted-foreground">{operationName}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Release Time</h4>
              <p className="text-sm text-muted-foreground">{formatTimestamp(Number(record.releaseTime))}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Requester</h4>
              <p className="text-sm text-muted-foreground font-mono">{formatAddress(record.params.requester)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Target</h4>
              <p className="text-sm text-muted-foreground font-mono">{formatAddress(record.params.target)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Value</h4>
              <p className="text-sm text-muted-foreground">{record.params.value.toString()}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Gas Limit</h4>
              <p className="text-sm text-muted-foreground">{record.params.gasLimit.toString()}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Execution Type</h4>
              <p className="text-sm text-muted-foreground">{executionTypeToHuman[record.params.executionType]}</p>
            </div>
          </div>

          {record.payment && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">Payment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-1">Recipient</h4>
                  <p className="text-sm text-muted-foreground font-mono">{formatAddress(record.payment.recipient)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Native Token Amount</h4>
                  <p className="text-sm text-muted-foreground">{record.payment.nativeTokenAmount.toString()}</p>
                </div>
                {record.payment.erc20TokenAmount > 0n && (
                  <>
                    <div>
                      <h4 className="text-sm font-medium mb-1">ERC20 Token</h4>
                      <p className="text-sm text-muted-foreground font-mono">{formatAddress(record.payment.erc20TokenAddress)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-1">ERC20 Amount</h4>
                      <p className="text-sm text-muted-foreground">{record.payment.erc20TokenAmount.toString()}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 