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
import { Clock, Info, Shield, Zap } from "lucide-react";
import { TxInfoCard } from "./TxInfoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { NotificationMessage } from "@/lib/catalog/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TxRecord } from "@/Guardian/sdk/typescript";
import { useTransactionPermissions } from "@/hooks/useTransactionPermissions";
import { SecureOwnable } from "@/Guardian/sdk/typescript/contracts/SecureOwnable";
import { DynamicRBAC } from "@/Guardian/sdk/typescript/contracts/DynamicRBAC";
import { Definitions } from "@/Guardian/sdk/typescript/lib/Definition";
import { PermissionDebugger } from "./debug/PermissionDebugger";

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
  // Guardian SDK instances for permission checking
  secureOwnable?: SecureOwnable;
  dynamicRBAC?: DynamicRBAC;
  definitions?: Definitions;
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
  secureOwnable,
  dynamicRBAC,
  definitions,
}: PendingTransactionDialogProps): JSX.Element {
  // State to track the active tab
  const [activeTab, setActiveTab] = React.useState<'timelock' | 'metatx'>(mode);

  // Get transaction permissions based on user roles
  const permissions = useTransactionPermissions({
    transaction,
    connectedAddress,
    contractAddress: contractInfo.contractAddress,
    secureOwnable,
    dynamicRBAC,
    definitions,
    timeLockPeriodInMinutes: contractInfo.timeLockPeriodInMinutes,
  });


  const handleApproveWrapper = async (txId: number) => {
    try {
      onNotification?.({
        type: 'info',
        title: 'Submitting Transaction',
        description: 'Please wait while the transaction is being approved...'
      });

      // Call the approve handler
      if (onApprove) {
        await onApprove(txId);
      }

      onNotification?.({
        type: 'success',
        title: 'Transaction Approved',
        description: 'The transaction has been successfully approved.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      refreshData?.();
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

      // Call the cancel handler
      if (onCancel) {
        await onCancel(txId);
      }

      onNotification?.({
        type: 'success',
        title: 'Transaction Cancelled',
        description: 'The transaction has been successfully cancelled.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      refreshData?.();
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

      // Call the broadcast handler
      if (onBroadcastMetaTx) {
        await onBroadcastMetaTx(tx, type);
      }

      onNotification?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: 'The transaction has been successfully broadcast.'
      });

      // Close dialog and refresh data
      onOpenChange(false);
      refreshData?.();
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


  // Determine alert message and guidance based on permissions and time delay
  const renderAlert = () => {
    if (!isPending) return null;
    
    let alertMessage = "";
    let alertType: 'info' | 'warning' | 'error' = 'info';
    
    // Check for permission errors
    if (permissions.permissionErrors.length > 0) {
      alertMessage = `Permission issues: ${permissions.permissionErrors.join(', ')}`;
      alertType = 'error';
    } else if (permissions.isTimeDelayExpired) {
      if (permissions.canApprove) {
        alertMessage = `This transaction is pending and the time delay has expired. You can now approve this transaction directly.`;
      } else if (permissions.canBroadcast) {
        alertMessage = `This transaction is pending and the time delay has expired. As the broadcaster, you can now broadcast this transaction.`;
      } else {
        alertMessage = `This transaction is pending and the time delay has expired. You don't have permission to approve or broadcast this transaction.`;
        alertType = 'warning';
      }
    } else {
      if (permissions.canBroadcast) {
        alertMessage = `This transaction is pending. As the broadcaster, you can broadcast it now, or wait until the time delay expires.`;
      } else if (permissions.canApprove) {
        alertMessage = `This transaction is pending. Please wait until the time delay expires to approve it directly.`;
      } else {
        alertMessage = `This transaction is pending. You don't have permission to approve or broadcast this transaction.`;
        alertType = 'warning';
      }
    }
    
    const alertClasses = {
      info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
      warning: "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300",
      error: "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
    };
    
    const iconClasses = {
      info: "h-4 w-4 text-blue-600 dark:text-blue-400",
      warning: "h-4 w-4 text-yellow-600 dark:text-yellow-400",
      error: "h-4 w-4 text-red-600 dark:text-red-400"
    };
    
    return (
      <Alert className={`${alertClasses[alertType]} mb-2`}>
        <Info className={iconClasses[alertType]} />
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
            operationName={'Custom Operation'}
            showExecutionType={true}
            showStatus={true}
          />

          {renderAlert()}

          {/* Debug Information - Remove in production */}
          <PermissionDebugger
            transaction={transaction}
            connectedAddress={connectedAddress!}
            contractAddress={contractInfo.contractAddress}
            secureOwnable={secureOwnable}
            dynamicRBAC={dynamicRBAC}
            definitions={definitions}
            timeLockPeriodInMinutes={contractInfo.timeLockPeriodInMinutes}
          />

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
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      <h3 className="font-semibold">Time Lock Operations</h3>
                    </div>
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
                        <span>Time Lock Period (seconds):</span>
                        <span>{contractInfo.timeLockPeriodInMinutes * 60} seconds</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        <span className="text-yellow-600">Pending</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Time Delay Expired:</span>
                        <span className={permissions.isTimeDelayExpired ? "text-green-600" : "text-yellow-600"}>
                          {permissions.isTimeDelayExpired ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Current Time:</span>
                        <span>{new Date().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Time Difference:</span>
                        <span>{Math.floor(Date.now() / 1000) - Number(transaction.releaseTime)} seconds</span>
                      </div>
                    </div>
                    
                    {/* Permission Status */}
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-medium">Your Permissions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`flex items-center gap-1 ${permissions.canApprove ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canApprove ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Approve</span>
                        </div>
                        <div className={`flex items-center gap-1 ${permissions.canCancel ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canCancel ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Cancel</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => handleApproveWrapper(Number(transaction.txId))}
                        disabled={!permissions.canApprove || !permissions.isTimeDelayExpired}
                        className="flex-1"
                        variant={permissions.canApprove ? "default" : "secondary"}
                      >
                        {permissions.isTimeDelayExpired 
                          ? (permissions.canApprove ? 'Approve Transaction' : 'No Permission to Approve')
                          : 'Wait for Time Lock'
                        }
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleCancelWrapper(Number(transaction.txId))}
                        disabled={!permissions.canCancel}
                        className="flex-1"
                      >
                        {permissions.canCancel ? 'Cancel Transaction' : 'No Permission to Cancel'}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metatx" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4" />
                      <h3 className="font-semibold">Meta Transaction Operations</h3>
                    </div>
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
                      <div className="flex justify-between text-sm">
                        <span>Has Signature:</span>
                        <span className={transaction.message && transaction.message !== '0x' ? "text-green-600" : "text-yellow-600"}>
                          {transaction.message && transaction.message !== '0x' ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Message Length:</span>
                        <span>{transaction.message ? transaction.message.length : 0} characters</span>
                      </div>
                    </div>
                    
                    {/* Permission Status */}
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-medium">Your Permissions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`flex items-center gap-1 ${permissions.canSignMetaTx ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canSignMetaTx ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Sign</span>
                        </div>
                        <div className={`flex items-center gap-1 ${permissions.canBroadcast ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canBroadcast ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Broadcast</span>
                        </div>
                        <div className={`flex items-center gap-1 ${permissions.canExecuteMetaTx ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canExecuteMetaTx ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Execute</span>
                        </div>
                        <div className={`flex items-center gap-1 ${permissions.canCancel ? 'text-green-600' : 'text-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${permissions.canCancel ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span>Can Cancel</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => onMetaTxSign?.(transaction, 'approve')}
                        disabled={!permissions.canSignMetaTx}
                        className="flex-1"
                        variant={permissions.canSignMetaTx ? "default" : "secondary"}
                      >
                        {permissions.canSignMetaTx ? 'Sign Meta Transaction' : 'No Permission to Sign'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleBroadcastWrapper(transaction, 'approve')}
                        disabled={!permissions.canBroadcast}
                        className="flex-1"
                      >
                        {permissions.canBroadcast ? 'Broadcast Meta Transaction' : 'No Permission to Broadcast'}
                      </Button>
                    </div>
                    
                    {/* Additional Meta Transaction Actions */}
                    {(permissions.canExecuteMetaTx || permissions.canCancel) && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            onClick={() => onMetaTxSign?.(transaction, 'cancel')}
                            disabled={!permissions.canSignMetaTx}
                            className="flex-1"
                            size="sm"
                          >
                            Sign Cancel Meta Tx
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => handleBroadcastWrapper(transaction, 'cancel')}
                            disabled={!permissions.canBroadcast}
                            className="flex-1"
                            size="sm"
                          >
                            Broadcast Cancel Meta Tx
                          </Button>
                        </div>
                      </div>
                    )}
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