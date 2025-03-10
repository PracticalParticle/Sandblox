import * as React from "react";
import { Address, Hex } from "viem";
import { formatEther, formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2, Clock, XCircle, RefreshCw, Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { TxStatus } from "@/particle-core/sdk/typescript/types/lib.index";
import { TxRecord } from "../../../particle-core/sdk/typescript/interfaces/lib.index";
import { VAULT_OPERATIONS } from "../hooks/useSimpleVaultOperations";
import { useOperationTypes } from "@/hooks/useOperationTypes";
import { NotificationMessage } from "../lib/types";
import { useActionPermissions } from "@/hooks/useActionPermissions";

// Helper function to recursively convert BigInt values to strings
const convertBigIntsToStrings = (obj: any): any => {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntsToStrings(obj[key]);
    }
    return converted;
  }
  
  return obj;
};

export interface VaultTxRecord extends Omit<TxRecord, 'status'> {
  status: TxStatus;
  amount: bigint;
  to: Address;
  token?: Address;
  type: "ETH" | "TOKEN";
}

export interface PendingTransactionsProps {
  transactions: VaultTxRecord[];
  isLoadingTx: boolean;
  onRefresh?: () => void;
  onApprove?: (txId: number) => Promise<void>;
  onCancel?: (txId: number) => Promise<void>;
  onMetaTxSign?: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onBroadcastMetaTx?: (tx: VaultTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  signedMetaTxStates?: Record<string, { type: 'approve' | 'cancel' }>;
  isLoading: boolean;
  contractAddress: Address;
  mode?: 'timelock' | 'metatx';
  onNotification?: (message: NotificationMessage) => void;
  ownerAddress?: Address;
  broadcasterAddress?: Address;
  connectedAddress?: Address;
}

export const PendingTransactions: React.FC<PendingTransactionsProps> = ({
  contractAddress,
  onApprove,
  onCancel,
  onMetaTxSign,
  onBroadcastMetaTx,
  isLoading = false,
  mode = 'timelock',
  onNotification,
  ownerAddress,
  broadcasterAddress,
  connectedAddress,
  transactions,
  isLoadingTx = false,
  onRefresh,
  signedMetaTxStates
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  
  // Get operation types for mapping hex values to human-readable names
  const { getOperationName, loading: loadingOperationTypes } = useOperationTypes(contractAddress);

  // Get action permissions
  const {
    canTimeLockApprove,
    canTimeLockCancel,
    canMetaTxSign,
    canMetaTxBroadcast,
    isLoading: isLoadingPermissions
  } = useActionPermissions(contractAddress, connectedAddress);

  // Refresh pending transactions manually
  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setIsRefreshing(false);
  };

  // Handle meta transaction signing and broadcasting
  const handleMetaTxSign = (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    if (onMetaTxSign) {
      onMetaTxSign(tx, type)
        .then(() => {
          onNotification?.({
            type: 'success',
            title: 'Meta Transaction Signed',
            description: `Successfully signed approval for transaction #${tx.txId}`
          });
        })
        .catch((error) => {
          onNotification?.({
            type: 'error',
            title: 'Signing Failed',
            description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
          });
        });
    }
  };

  const handleBroadcastMetaTx = (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    if (onBroadcastMetaTx) {
      onBroadcastMetaTx(tx, type)
        .then(() => {
          onNotification?.({
            type: 'success',
            title: 'Transaction Broadcast',
            description: `Successfully broadcasted approval for transaction #${tx.txId}`
          });
        })
        .catch((error) => {
          onNotification?.({
            type: 'error',
            title: 'Broadcast Failed',
            description: error instanceof Error ? error.message : 'Failed to broadcast meta transaction'
          });
        });
    }
  };

  // Handle approve action
  const handleApproveAction = async (txId: number) => {
    try {
      if (onApprove) {
        await onApprove(txId);
        onNotification?.({
          type: 'success',
          title: 'Transaction Approved',
          description: `Successfully approved transaction #${txId}`
        });
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve transaction'
      });
    }
  };

  // Handle cancel action
  const handleCancelAction = async (txId: number) => {
    try {
      if (onCancel) {
        await onCancel(txId);
        onNotification?.({
          type: 'success',
          title: 'Transaction Cancelled',
          description: `Successfully cancelled transaction #${txId}`
        });
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel transaction'
      });
    }
  };

  // Check if still loading operation types
  if (loadingOperationTypes) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Pending Transactions</h3>
        </div>
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading operation types...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if transactions is empty
  if (transactions.length === 0 && !isLoadingTx) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Pending Transactions</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No pending transactions found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Pending Transactions ({transactions.length})
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoadingTx || isRefreshing}
        >
          {isRefreshing || isLoadingTx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>
      
      {isLoadingTx && transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map(tx => {
            // Calculate time-based values
            const now = Math.floor(Date.now() / 1000);
            const isReady = now >= Number(tx.releaseTime);
            const progress = Math.min(((now - (Number(tx.releaseTime) - 24 * 3600)) / (24 * 3600)) * 100, 100);
            const isTimeLockComplete = progress >= 100;
            
            // Key for meta transaction state
            const approveKey = `${tx.txId}-approve`;
            //  const cancelKey = `${tx.txId}-cancel`;
            const hasSignedApproval = signedMetaTxStates?.[approveKey]?.type === 'approve';
            // const hasSignedCancel = signedMetaTxStates?.[cancelKey]?.type === 'cancel';
            
            // Get operation name from hex
            const operationTypeHex = tx.params.operationType as Hex;
            const operationName = getOperationName(operationTypeHex);
            const isEthWithdrawal = operationName === VAULT_OPERATIONS.WITHDRAW_ETH;
            const isTokenWithdrawal = operationName === VAULT_OPERATIONS.WITHDRAW_TOKEN;
            
            // Skip if not a withdraw operation (should not happen due to our filter)
            if (!isEthWithdrawal && !isTokenWithdrawal) {
              return null;
            }
            
            return (
              <Card key={tx.txId.toString()}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          {tx.status === TxStatus.PENDING && <Clock className="h-4 w-4 text-yellow-500" />}
                          {tx.status === TxStatus.CANCELLED && <XCircle className="h-4 w-4 text-red-500" />}
                          {tx.status === TxStatus.COMPLETED && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          <p className="font-medium">
                            {isEthWithdrawal ? "ETH Withdrawal" : "Token Withdrawal"} #{tx.txId.toString()}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Amount: {tx.type === "ETH" ? formatEther(tx.amount) : formatUnits(tx.amount, 18)} {tx.type}
                        </p>
                        <p className="text-sm text-muted-foreground">To: {tx.to}</p>
                        {tx.type === "TOKEN" && tx.token && (
                          <p className="text-sm text-muted-foreground">Token: {tx.token}</p>
                        )}
                      </div>
                    </div>

                    {mode === 'timelock' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Time Lock Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress 
                          value={progress} 
                          className={`h-2 ${isTimeLockComplete ? 'bg-muted' : ''}`}
                          aria-label="Time lock progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                        />
                      </div>
                    )}

                    <div className="flex space-x-2">
                      {mode === 'timelock' ? (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-1">
                                  <Button
                                    onClick={() => handleApproveAction(Number(tx.txId))}
                                    disabled={
                                      !canTimeLockApprove || 
                                      !isReady || 
                                      isLoading || 
                                      tx.status !== TxStatus.PENDING || 
                                      !isTimeLockComplete
                                    }
                                    className={`w-full transition-all duration-200 flex items-center justify-center
                                      ${isTimeLockComplete 
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                      }
                                      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:dark:bg-slate-900 disabled:dark:text-slate-500
                                    `}
                                    variant="outline"
                                  >
                                    {isTimeLockComplete && <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    <span>Approve</span>
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {!canTimeLockApprove
                                  ? "Only the owner can approve transactions"
                                  : !isTimeLockComplete 
                                    ? "Time lock period not complete" 
                                    : isReady 
                                      ? "Approve this withdrawal request" 
                                      : "Not yet ready for approval"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-1">
                                  <Button
                                    onClick={() => handleCancelAction(Number(tx.txId))}
                                    disabled={!canTimeLockCancel || isLoading || tx.status !== TxStatus.PENDING}
                                    className={`w-full transition-all duration-200 flex items-center justify-center
                                      bg-rose-50 text-rose-700 hover:bg-rose-100 
                                      dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50
                                      border border-rose-200 dark:border-rose-800
                                      disabled:opacity-50 disabled:cursor-not-allowed 
                                      disabled:bg-slate-50 disabled:text-slate-400 
                                      disabled:dark:bg-slate-900 disabled:dark:text-slate-500
                                    `}
                                    variant="outline"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    <span>Cancel</span>
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {!canTimeLockCancel
                                  ? "Only the owner can cancel transactions"
                                  : tx.status !== TxStatus.PENDING 
                                    ? "This transaction cannot be cancelled" 
                                    : "Cancel this withdrawal request"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      ) : (
                        <div className="w-full space-y-2">
                          <div className="flex space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-1/2">
                                    <Button
                                      onClick={() => handleMetaTxSign(tx, 'approve')}
                                      disabled={
                                        !canMetaTxSign ||
                                        isLoading || 
                                        tx.status !== TxStatus.PENDING || 
                                        hasSignedApproval
                                      }
                                      className={`w-full transition-all duration-200 flex items-center justify-center
                                        bg-emerald-50 text-emerald-700 hover:bg-emerald-100 
                                        dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 
                                        border border-emerald-200 dark:border-emerald-800
                                        disabled:opacity-50 disabled:cursor-not-allowed 
                                        disabled:bg-slate-50 disabled:text-slate-400 
                                        disabled:dark:bg-slate-900 disabled:dark:text-slate-500
                                      `}
                                      variant="outline"
                                    >
                                      {hasSignedApproval ? (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          <span>Signed</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          <span>Sign Approval</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {!canMetaTxSign
                                    ? "Only the owner can sign approval meta-transactions"
                                    : hasSignedApproval
                                      ? "Transaction is already signed"
                                      : "Sign approval meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-1/2">
                                    <Button
                                      onClick={() => handleBroadcastMetaTx(tx, 'approve')}
                                      disabled={
                                        !canMetaTxBroadcast ||
                                        isLoading || 
                                        !hasSignedApproval
                                      }
                                      className={`w-full transition-all duration-200 flex items-center justify-center
                                        ${hasSignedApproval 
                                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
                                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed 
                                        disabled:bg-slate-50 disabled:text-slate-400 
                                        disabled:dark:bg-slate-900 disabled:dark:text-slate-500
                                      `}
                                      variant="outline"
                                    >
                                      <Radio className="h-4 w-4 mr-2" />
                                      <span>Broadcast</span>
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {!hasSignedApproval
                                    ? "Transaction must be signed before broadcasting"
                                    : !canMetaTxBroadcast
                                      ? "Only the broadcaster can broadcast meta-transactions"
                                      : "Broadcast the signed meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// For backwards compatibility, also export the single transaction component
interface SinglePendingTransactionProps {
  tx: VaultTxRecord;
  onApprove: (txId: number) => Promise<void>;
  onCancel: (txId: number) => Promise<void>;
  isLoading: boolean;
  contractAddress: Address;
  mode?: 'timelock' | 'metatx';
  onNotification: (message: NotificationMessage) => void;
  onRefresh?: () => void;
}

export const PendingTransaction: React.FC<SinglePendingTransactionProps> = ({
  tx,
  onApprove,
  onCancel,
  isLoading,
  contractAddress,
  onNotification,
  onRefresh
}) => {
  // Create a single-item array from the tx prop
  const transactions = [tx];
  
  return (
    <PendingTransactions
      contractAddress={contractAddress}
      onApprove={onApprove}
      onCancel={onCancel}
      isLoading={isLoading}
      mode="timelock"
      onNotification={onNotification}
      transactions={transactions}
      isLoadingTx={false}
      onRefresh={onRefresh}
    />
  );
}; 