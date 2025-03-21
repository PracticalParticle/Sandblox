import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus, ExecutionType } from '../particle-core/sdk/typescript/types/lib.index'
import { formatAddress, formatTimestamp } from '@/lib/utils'
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
import { TxInfoCard } from './TxInfoCard'

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
}

export function TxDetailsDialog({ record, isOpen, onOpenChange, operationName }: TxDetailsDialogProps) {
  if (!record) return null

  const isPending = record.status === TxStatus.PENDING

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <TxInfoCard
            record={record}
            operationName={operationName}
            showExecutionType={true}
            showStatus={true}
            txId={true}
          />

          {/* Next Action Alert for Pending Transactions */}
          {isPending && (
            <Card className="border-yellow-500/20">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-medium text-yellow-500">Next Required Action</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 ">
                      <Badge variant="default" className="bg-blue-500/10 text-blue-500">
                        <Shield className="h-3 w-3 mr-1" />
                        Owner
                      </Badge>
                      <span className="text-sm text-muted-foreground">approval required</span>
                    </div>
                    
                    <div className="flex items-center gap-2 ">
                      <Badge variant="default" className="bg-green-500/10 text-green-500">
                        <Key className="h-3 w-3 mr-1" />
                        Recovery
                      </Badge>
                      <span className="text-sm text-muted-foreground">approval required</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 