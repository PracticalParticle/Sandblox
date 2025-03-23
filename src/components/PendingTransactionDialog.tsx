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
import { Clock } from "lucide-react";
import { TxInfoCard } from "./TxInfoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

// Import the existing PendingTransactions component
import { 
  PendingTransactions, 
  VaultTxRecord 
} from "../blox/SimpleVault/components/PendingTransaction";
import { NotificationMessage } from "../blox/SimpleVault/lib/types";
import { useMetaTxActions } from '../blox/SimpleVault/hooks/useMetaTxActions';
import { useTimeLockActions } from '../blox/SimpleVault/hooks/useTimeLockActions';

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
  mode = 'timelock'
}: PendingTransactionDialogProps): JSX.Element {
  // State to track the active tab
  const [activeTab, setActiveTab] = React.useState<'timelock' | 'metatx'>(mode);
  
  // Handle refresh to make sure it calls refreshData
  const handleRefresh = React.useCallback(() => {
    console.log("Refresh called in dialog");
    refreshData?.();
  }, [refreshData]);

  // Get meta transaction actions using the same hooks as SimpleVault.ui.tsx
  const {
    handleMetaTxSign,
    handleBroadcastMetaTx,
    signedMetaTxStates,
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
    onNotification,
    handleRefresh
  );

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
                  onApprove={handleApproveWithdrawal}
                  onCancel={handleCancelWithdrawal}
                  isLoading={false}
                  contractAddress={contractInfo.contractAddress}
                  mode="timelock"
                  onNotification={onNotification}
                  connectedAddress={connectedAddress}
                  timeLockPeriodInMinutes={contractInfo.timeLockPeriodInMinutes}
                />
              </TabsContent>

              <TabsContent value="metatx" className="mt-4">
                <PendingTransactions
                  transactions={[transaction]}
                  isLoadingTx={false}
                  onRefresh={handleRefresh}
                  onMetaTxSign={handleMetaTxSign}
                  onBroadcastMetaTx={handleBroadcastMetaTx}
                  signedMetaTxStates={signedMetaTxStates}
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