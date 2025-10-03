import * as React from "react";
import { Address } from "viem";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Info } from "lucide-react";
import { TxInfoCard } from "./TxInfoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { NotificationMessage } from "@/lib/catalog/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatAddress } from "@/lib/utils";
import { useMetaTransactionManager } from "@/hooks/useMetaTransactionManager";
import { TxRecord } from "@/Guardian/sdk/typescript";
import { useOperationRegistry } from "../hooks/useOperationRegistry";
import { useBloxOperations } from "../hooks/useBloxOperations";
import { useEffect, useState } from "react";

interface PendingTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  contractInfo: {
    contractAddress: Address;
    timeLockPeriodInMinutes: number;
    chainId: number;
    chainName: string;
    broadcaster?: Address;
    owner?: Address;
    recoveryAddress?: Address;
  };
  transaction: TxRecord;
  onApprove?: (txId: number) => Promise<void>;
  onCancel?: (txId: number) => Promise<void>;
  onMetaTxSign?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onBroadcastMetaTx?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onNotification?: (message: NotificationMessage) => void;
  isLoading?: boolean;
  connectedAddress?: Address;
  showMetaTxOption?: boolean;
  refreshData?: () => void;
  mode?: 'timelock' | 'metatx';
}

export function PendingTransactionDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  contractInfo,
  transaction,
  onNotification,
  connectedAddress,
  refreshData,
  mode = 'timelock',
  onApprove,
  onCancel,
  onMetaTxSign,
  onBroadcastMetaTx,
}: PendingTransactionDialogProps): JSX.Element {
  // State to track the active tab
  const [activeTab, setActiveTab] = React.useState<'timelock' | 'metatx'>(mode);
  
  // Add transaction manager
  const { removeTransaction } = useMetaTransactionManager(contractInfo.contractAddress);

  // Get operation registry hooks
  const { getOperationInfo } = useOperationRegistry();
  const { getBloxOperations, getBloxComponents } = useBloxOperations();

  // State for blox-specific components and operations
  const [bloxOperations, setBloxOperations] = useState<any>(null);
  const [, setIsLoadingComponents] = useState(true);

  // Load blox-specific components and operations
  useEffect(() => {
    async function loadBloxComponents() {
      setIsLoadingComponents(true);
      try {
        // Get operation info to determine the blox type
        const operationInfo = await getOperationInfo(transaction.params.operationType);
        if (!operationInfo) {
          console.error('No operation info found for transaction');
          return;
        }

        // Handle the case where bloxId is optional
        if (operationInfo.bloxId) {
          // Get blox components and operations
          const [components, operations] = await Promise.all([
            getBloxComponents(operationInfo.bloxId, 'PendingTransaction'),
            getBloxOperations(operationInfo.bloxId, contractInfo.contractAddress)
          ]);

          if (components) {
            console.log('Blox components loaded successfully');
          }
          
          if (operations) {
            setBloxOperations(operations);
          }
        } else {
          // bloxId is optional, so this isn't an error case
          console.log('Operation does not have a bloxId, skipping blox-specific components');
        }
      } catch (error) {
        console.error('Failed to load blox components:', error);
        onNotification?.({
          type: 'error',
          title: 'Component Load Error',
          description: 'Failed to load transaction components'
        });
      } finally {
        setIsLoadingComponents(false);
      }
    }

    if (transaction && contractInfo.contractAddress) {
      loadBloxComponents();
    }
  }, [transaction, contractInfo.contractAddress, getOperationInfo, getBloxComponents, getBloxOperations]);

  // Handle refresh to make sure it calls refreshData
  const handleRefresh = React.useCallback(() => {
    console.log("Refresh called in dialog");
    refreshData?.();
  }, [refreshData]);

  const handleApproveWrapper = async (txId: number) => {
    try {
      onNotification?.({
        type: 'info',
        title: 'Submitting Transaction',
        description: 'Please wait while the transaction is being approved...'
      });

      // Use blox operations if available, otherwise fall back to default
      if (bloxOperations?.handleApprove) {
        await bloxOperations.handleApprove(txId);
      } else if (onApprove) {
        await onApprove(txId);
      }

      // Remove from local storage after successful approval
      removeTransaction(txId.toString());

      onNotification?.({
        type: 'success',
        title: 'Transaction Approved',
        description: 'The transaction has been successfully approved.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      handleRefresh();
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve transaction'
      });
    }
  };

  const handleCancelWrapper = async (txId: number) => {
    try {
      onNotification?.({
        type: 'info',
        title: 'Submitting Transaction',
        description: 'Please wait while the transaction is being cancelled...'
      });

      // Use blox operations if available, otherwise fall back to default
      if (bloxOperations?.handleCancel) {
        await bloxOperations.handleCancel(txId);
      } else if (onCancel) {
        await onCancel(txId);
      }

      // Remove from local storage after successful cancellation
      removeTransaction(txId.toString());

      onNotification?.({
        type: 'success',
        title: 'Transaction Cancelled',
        description: 'The transaction has been successfully cancelled.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      handleRefresh();
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel transaction'
      });
    }
  };

  const handleBroadcastWrapper = async (tx: TxRecord, type: 'approve' | 'cancel'): Promise<void> => {
    try {
      onNotification?.({
        type: 'info',
        title: 'Submitting Transaction',
        description: 'Please wait while the transaction is being broadcast...'
      });

      // Use blox operations if available, otherwise fall back to default
      if (bloxOperations?.handleBroadcast) {
        await bloxOperations.handleBroadcast(tx, type);
      } else if (onBroadcastMetaTx) {
        await onBroadcastMetaTx(tx, type);
      }

      // Remove from local storage after successful broadcast
      removeTransaction(tx.txId.toString());

      onNotification?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: 'The transaction has been successfully broadcast.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      handleRefresh();
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
    }
  };

  // Add style once on mount
  React.useEffect(() => {
    if (!document.getElementById('dialog-styles')) {
      const style = document.createElement('style');
      style.id = 'dialog-styles';
      document.head.appendChild(style);
    }
  }, []);

  if (!transaction) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Could not display transaction details. Invalid or missing transaction data.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Check if the transaction is pending (from SDK data)
  const isPending = transaction.status === 1; // TxStatus.PENDING

  // Get formatted broadcaster address
  const formattedBroadcasterAddress = contractInfo.broadcaster ? formatAddress(contractInfo.broadcaster) : 'Unknown';

  // Determine if the time delay has expired
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = Number(transaction.releaseTime);
  const isTimeDelayExpired = now >= releaseTime;
  
  // Check user roles
  const isOwner = connectedAddress?.toLowerCase() === contractInfo.owner?.toLowerCase();
  const isBroadcaster = connectedAddress?.toLowerCase() === contractInfo.broadcaster?.toLowerCase();

  // Determine alert message and guidance based on roles and time delay
  const renderAlert = () => {
    if (!isPending) return null;
    
    let alertMessage = "";
    
    if (isTimeDelayExpired) {
      if (isOwner) {
        alertMessage = `This transaction is pending and the time delay has expired. You can now approve this transaction directly, or the broadcaster (${formattedBroadcasterAddress}) can broadcast it.`;
      } else if (isBroadcaster) {
        alertMessage = `This transaction is pending and the time delay has expired. As the broadcaster, you can now broadcast this transaction.`;
      } else {
        alertMessage = `This transaction is pending and the time delay has expired. The owner can approve it directly, or the broadcaster (${formattedBroadcasterAddress}) can broadcast it.`;
      }
    } else {
      if (isBroadcaster) {
        alertMessage = `This transaction is pending. As the broadcaster, you can broadcast it now, or wait until the time delay expires.`;
      } else if (isOwner) {
        alertMessage = `This transaction is pending. Please wait until the time delay expires to approve it directly, or connect with the broadcaster wallet (${formattedBroadcasterAddress}) to broadcast it sooner.`;
      } else {
        alertMessage = `This transaction is pending. Please connect with the broadcaster wallet (${formattedBroadcasterAddress}) to broadcast it, or wait until the time delay expires for direct approval.`;
      }
    }
    
    return (
      <Alert className="bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 mb-2">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm ml-2">
          {alertMessage}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  <span>Time Lock</span>
                </Badge>
              </div>
            </div>
            <DialogDescription>
              {description || "Review and manage the pending transaction."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <TxInfoCard 
            record={transaction}
            operationName={bloxOperations?.getOperationName?.(transaction) || 'Custom Operation'}
            showExecutionType={true}
            showStatus={true}
          />

          {renderAlert()}

          <Card>
            <Tabs defaultValue="timelock" className="w-full" value={activeTab} onValueChange={(value) => setActiveTab(value as 'timelock' | 'metatx')}>
              <TabsList className="grid w-full grid-cols-2 bg-background p-1 rounded-lg">
                <TabsTrigger value="timelock" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                  TimeLock
                </TabsTrigger>
                <TabsTrigger value="metatx" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                  MetaTx
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timelock" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Time Lock Operations</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This transaction is pending and will be available for approval after the time lock period expires.
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Release Time:</span>
                        <span>{new Date(Number(transaction.releaseTime) * 1000).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Time Lock Period:</span>
                        <span>{contractInfo.timeLockPeriodInMinutes} minutes</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        <span className="text-yellow-600">Pending</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => handleApproveWrapper(Number(transaction.txId))}
                        disabled={!isTimeDelayExpired}
                        className="flex-1"
                      >
                        {isTimeDelayExpired ? 'Approve Transaction' : 'Wait for Time Lock'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleCancelWrapper(Number(transaction.txId))}
                        className="flex-1"
                      >
                        Cancel Transaction
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metatx" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Meta Transaction Operations</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Meta transactions allow gasless execution. The broadcaster can execute this transaction on behalf of the requester.
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Requester:</span>
                        <span className="font-mono text-xs">{transaction.params.requester}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Target:</span>
                        <span className="font-mono text-xs">{transaction.params.target}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Value:</span>
                        <span>{transaction.params.value.toString()} ETH</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Gas Limit:</span>
                        <span>{transaction.params.gasLimit.toString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => onMetaTxSign?.(transaction, 'approve')}
                        className="flex-1"
                      >
                        Sign Meta Transaction
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleBroadcastWrapper(transaction, 'approve')}
                        className="flex-1"
                      >
                        Broadcast Meta Transaction
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 