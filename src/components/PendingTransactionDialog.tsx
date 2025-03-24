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
import { Clock, Info } from "lucide-react";
import { TxInfoCard } from "./TxInfoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  PendingTransactions, 
  VaultTxRecord 
} from "../blox/SimpleVault/components/PendingTransaction";
import { NotificationMessage } from "../blox/SimpleVault/lib/types";
import { useMetaTxActions } from '../blox/SimpleVault/hooks/useMetaTxActions';
import { useTimeLockActions } from '../blox/SimpleVault/hooks/useTimeLockActions';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatAddress } from "@/lib/utils";
import { useTransactionManager } from "@/hooks/useTransactionManager";

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
  transaction: VaultTxRecord;
  onApprove?: (txId: number) => Promise<void>;
  onCancel?: (txId: number) => Promise<void>;
  onMetaTxSign?: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onBroadcastMetaTx?: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onNotification?: (message: NotificationMessage) => void;
  isLoading?: boolean;
  connectedAddress?: Address;
  signedMetaTxStates?: Record<string, { type: 'approve' | 'cancel' }>;
  showMetaTxOption?: boolean;
  refreshData?: () => void;
  mode?: 'timelock' | 'metatx';
  hasSignedApproval?: boolean;
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
  showMetaTxOption = true,
  refreshData,
  mode = 'timelock',
  signedMetaTxStates = {},
  hasSignedApproval: propHasSignedApproval,
}: PendingTransactionDialogProps): JSX.Element {
  // State to track the active tab
  const [activeTab, setActiveTab] = React.useState<'timelock' | 'metatx'>(mode);
  
  // Add transaction manager
  const { removeTransaction } = useTransactionManager(contractInfo.contractAddress);

  // Handle refresh to make sure it calls refreshData
  const handleRefresh = React.useCallback(() => {
    console.log("Refresh called in dialog");
    refreshData?.();
  }, [refreshData]);

  // Get meta transaction actions using the same hooks as SimpleVault.ui.tsx
  const {
    handleMetaTxSign,
    handleBroadcastMetaTx,
    signedMetaTxStates: hookSignedMetaTxStates,
    isLoading: isMetaTxLoading
  } = useMetaTxActions(
    contractInfo.contractAddress,
    onNotification,  // onSuccess
    onNotification,  // onError
    handleRefresh    // onRefresh
  );

  // Get timelock actions using the same hooks as SimpleVault.ui.tsx
  const {
    handleApproveWithdrawal,
    handleCancelWithdrawal,
    loadingStates: timeLockLoadingStates
  } = useTimeLockActions(
    contractInfo.contractAddress,
    onNotification,  // onSuccess
    onNotification,  // onError
    handleRefresh    // onRefresh
  );

  // Create wrapper for approve action to handle dialog closing
  const handleApproveWrapper = async (txId: number) => {
    try {
      await handleApproveWithdrawal(txId);
      // Remove from local storage
      removeTransaction(txId.toString());
      // Close dialog after successful approval
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      throw error; // Re-throw to let the PendingTransactions component handle the error
    }
  };

  // Create wrapper for cancel action to handle dialog closing
  const handleCancelWrapper = async (txId: number) => {
    try {
      await handleCancelWithdrawal(txId);
      // Remove from local storage
      removeTransaction(txId.toString());
      // Close dialog after successful cancellation
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      throw error; // Re-throw to let the PendingTransactions component handle the error
    }
  };

  // Update broadcast wrapper to handle local storage
  const handleBroadcastWrapper = async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    try {
      await handleBroadcastMetaTx(tx, type);
      // Remove from local storage
      removeTransaction(tx.txId.toString());
      // Close dialog after successful broadcast
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      throw error; // Re-throw to let the PendingTransactions component handle the error
    }
  };

  // Add style once on mount
  React.useEffect(() => {
    // Only add the style tag if it doesn't exist yet
    if (!document.getElementById('dialog-styles')) {
      const style = document.createElement('style');
      style.id = 'dialog-styles';
  
      document.head.appendChild(style);
    }
    
    return () => {
      // We could remove the style on unmount, but it's okay to leave it
      // since it's scoped to the dialog and won't affect other components
    };
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

  // Check if the transaction is already signed - either from hook state or from props
  const hasSignedApprovalFromHook = hookSignedMetaTxStates?.[`${transaction.txId}-approve`]?.type === 'approve' 
                                || signedMetaTxStates?.[`${transaction.txId}-approve`]?.type === 'approve';
  
  // Combine all sources to determine if the transaction has a signature
  const hasSignedApproval = hasSignedApprovalFromHook || propHasSignedApproval;

  // Determine if the time delay has expired
  const now = Math.floor(Date.now() / 1000);
  const releaseTime = Number(transaction.releaseTime);
  const isTimeDelayExpired = now >= releaseTime;
  
  // Check user roles
  const isOwner = connectedAddress?.toLowerCase() === contractInfo.owner?.toLowerCase();
  const isBroadcaster = connectedAddress?.toLowerCase() === contractInfo.broadcaster?.toLowerCase();

  // Get formatted broadcaster address
  const formattedBroadcasterAddress = contractInfo.broadcaster ? formatAddress(contractInfo.broadcaster) : 'Unknown';

  // Determine alert message and guidance based on roles and time delay
  const renderAlert = () => {
    if (!hasSignedApproval) return null;
    
    // Determine the appropriate guidance message
    let alertMessage = "";
    
    if (isTimeDelayExpired) {
      if (isOwner) {
        alertMessage = `This transaction has been signed and the time delay has expired. You can now approve this transaction directly, or the broadcaster (${formattedBroadcasterAddress}) can broadcast it.`;
      } else if (isBroadcaster) {
        alertMessage = `This transaction has been signed and the time delay has expired. As the broadcaster, you can now broadcast this transaction.`;
      } else {
        alertMessage = `This transaction has been signed and the time delay has expired. The owner can approve it directly, or the broadcaster (${formattedBroadcasterAddress}) can broadcast it.`;
      }
    } else {
      if (isBroadcaster) {
        alertMessage = `This transaction has been signed. As the broadcaster, you can broadcast it now, or wait until the time delay expires.`;
      } else if (isOwner) {
        alertMessage = `This transaction has been signed. Please wait until the time delay expires to approve it directly, or connect with the broadcaster wallet (${formattedBroadcasterAddress}) to broadcast it sooner.`;
      } else {
        alertMessage = `This transaction has been signed. Please connect with the broadcaster wallet (${formattedBroadcasterAddress}) to broadcast it, or wait until the time delay expires for direct approval.`;
      }
    }
    
    return (
      <Alert className="bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300 mb-2">
        <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
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
            operationName={transaction.type === "ETH" ? "ETH Withdrawal" : "Token Withdrawal"}
            showExecutionType={true}
            showStatus={true}
          />

          {/* Enhanced alert with contextual guidance */}
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
                <PendingTransactions
                  transactions={[transaction]}
                  isLoadingTx={false}
                  onRefresh={handleRefresh}
                  onApprove={handleApproveWrapper}
                  onCancel={handleCancelWrapper}
                  isLoading={false}
                  contractAddress={contractInfo.contractAddress}
                  mode="timelock"
                  onNotification={onNotification}
                  connectedAddress={connectedAddress}
                  timeLockPeriodInMinutes={contractInfo.timeLockPeriodInMinutes}
                />
              </TabsContent>

              <TabsContent value="metatx" className="mt-4 ">
                <PendingTransactions
                  transactions={[transaction]}
                  isLoadingTx={false}
                  onRefresh={handleRefresh}
                  onApprove={handleApproveWrapper}
                  onCancel={handleCancelWrapper}
                  onMetaTxSign={handleMetaTxSign}
                  onBroadcastMetaTx={handleBroadcastWrapper}
                  signedMetaTxStates={{...signedMetaTxStates, ...hookSignedMetaTxStates}}
                  isLoading={isMetaTxLoading}
                  contractAddress={contractInfo.contractAddress}
                  mode="metatx"
                  onNotification={onNotification}
                  connectedAddress={connectedAddress}
                  timeLockPeriodInMinutes={contractInfo.timeLockPeriodInMinutes}
                />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 