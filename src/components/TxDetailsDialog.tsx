import { TxRecord } from '../particle-core/sdk/typescript/interfaces/lib.index'
import { TxStatus } from '../particle-core/sdk/typescript/types/lib.index'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Key,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TxInfoCard } from './TxInfoCard'

// Status badge variants mapping with enhanced styling

// Status to human-readable text

// Execution type to human-readable text with icons

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