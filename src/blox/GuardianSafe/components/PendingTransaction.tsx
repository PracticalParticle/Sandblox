import * as React from "react";
import { Address, Hex } from "viem";
import { formatEther } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2, Clock, XCircle, RefreshCw, Radio, Info, Eye, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
// removed internal Tabs to rely on parent-provided mode
import { TxStatus } from "../../../Guardian/sdk/typescript/types/lib.index";
import { SAFE_OPERATIONS } from "../hooks/useOperations";
import { useOperationTypes } from "@/hooks/useOperationTypes";
import { NotificationMessage, SafeTxRecord, EnhancedSafeTx } from "../lib/types";
import { useWorkflowManager } from "@/hooks/useWorkflowManager";
import { OperationPhase } from "@/types/OperationRegistry";
import { usePublicClient } from "wagmi";
import { useMetaTransactionManager } from "@/hooks/useMetaTransactionManager";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface PendingTransactionsProps {
  transactions: SafeTxRecord[];
  isLoadingTx: boolean;
  onRefresh?: () => void;
  onApprove?: (txId: number) => Promise<void>;
  onCancel?: (txId: number) => Promise<void>;
  onMetaTxSign?: (tx: SafeTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onBroadcastMetaTx?: (tx: SafeTxRecord, type: 'approve' | 'cancel') => Promise<void>;
  signedMetaTxStates?: Record<string, { type: 'approve' | 'cancel' | 'singlePhase' }>;
  isLoading: boolean;
  contractAddress: Address;
  mode?: 'timelock' | 'metatx';
  onNotification?: (message: NotificationMessage) => void;
  connectedAddress?: Address;
  timeLockPeriodInMinutes: number;
  formatSafeTxForDisplay?: (safeTx: any) => EnhancedSafeTx;
  broadcasterAddress?: Address;
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
  connectedAddress,
  transactions,
  isLoadingTx = false,
  onRefresh,
  signedMetaTxStates,
  timeLockPeriodInMinutes,
  formatSafeTxForDisplay,
  broadcasterAddress
}) => {
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  // broadcasterAddress is provided via props (optional)
  
  // Get operation types for mapping hex values to human-readable names
  const { getOperationName, loading: loadingOperationTypes } = useOperationTypes(contractAddress);

  const {
    isBroadcaster,
    canExecutePhase,
    isLoading: isLoadingPermissions
  } = useWorkflowManager(contractAddress);

  // Create permission check functions using canExecutePhase for more precise control
  // These memoized functions check permissions for each transaction based on its operation type
  const checkTimeLockApprove = React.useCallback((tx: SafeTxRecord): boolean => {
    if (!connectedAddress) return false;
    
    const operationTypeHex = tx.params.operationType as Hex;
    const operationName = getOperationName(operationTypeHex);
    
    // For safe operations, owner can approve after timelock
    return canExecutePhase(operationName, OperationPhase.APPROVE, connectedAddress);
  }, [canExecutePhase, connectedAddress, getOperationName]);

  const checkTimeLockCancel = React.useCallback((tx: SafeTxRecord): boolean => {
    if (!connectedAddress) return false;
    
    const operationTypeHex = tx.params.operationType as Hex;
    const operationName = getOperationName(operationTypeHex);
    
    // For safe operations, owner can cancel pending transactions
    return canExecutePhase(operationName, OperationPhase.CANCEL, connectedAddress);
  }, [canExecutePhase, connectedAddress, getOperationName]);

  const checkMetaTxSign = React.useCallback((tx: SafeTxRecord): boolean => {
    if (!connectedAddress) return false;
    
    const operationTypeHex = tx.params.operationType as Hex;
    const operationName = getOperationName(operationTypeHex);
    
    // For meta transactions, owner can sign approvals
    return canExecutePhase(operationName, OperationPhase.META_APPROVE, connectedAddress);
  }, [canExecutePhase, connectedAddress, getOperationName]);

  const checkMetaTxBroadcast = React.useCallback((_tx: SafeTxRecord): boolean => {
    // Only broadcaster can broadcast meta transactions
    if (!connectedAddress) return false;
    if (isBroadcaster) return true;
    // Fallback: allow based on explicit broadcaster address if provided
    return Boolean((broadcasterAddress && connectedAddress.toLowerCase() === broadcasterAddress.toLowerCase()));
  }, [isBroadcaster, connectedAddress, broadcasterAddress]);

  const publicClient = usePublicClient();
  const { transactions: storedTransactions } = useMetaTransactionManager(contractAddress);

  // Refresh pending transactions manually
  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setIsRefreshing(false);
  };

  // Handle meta transaction signing and broadcasting
  const handleMetaTxSign = (tx: SafeTxRecord, type: 'approve' | 'cancel') => {
    console.log('PendingTransactions: handleMetaTxSign called with txId:', tx.txId.toString(), 'type:', type);
    
    if (onMetaTxSign) {
      // Ensure we're calling the function with the correct parameters
      onMetaTxSign(tx, type)
        .then(() => {
          console.log('PendingTransactions: onMetaTxSign completed successfully');
          onNotification?.({
            type: 'success',
            title: 'Meta Transaction Signed',
            description: `Successfully signed approval for transaction #${tx.txId}`
          });
        })
        .catch((error) => {
          console.error('PendingTransactions: onMetaTxSign error:', error);
          onNotification?.({
            type: 'error',
            title: 'Signing Failed',
            description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
          });
        });
    } else {
      console.warn('PendingTransactions: onMetaTxSign handler is not defined');
    }
  };

  const handleBroadcastMetaTx = (tx: SafeTxRecord, type: 'approve' | 'cancel') => {
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
      }
    } catch (error) {
      console.error('Failed to approve transaction:', error);
      throw error; // Re-throw to let the dialog handle the error notification
    }
  };

  // Handle cancel action
  const handleCancelAction = async (txId: number) => {
    try {
      if (!publicClient) {
        throw new Error("Blockchain client not initialized")
      }

      if (onCancel) {
        await onCancel(txId);
      }
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      throw error; // Re-throw to let the dialog handle the error notification
    }
  };

  // removed unused formatData helper (not referenced)

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Helper to create description for transaction
  const createTransactionDescription = (tx: SafeTxRecord): string => {
    if (formatSafeTxForDisplay) {
      const formattedTx = formatSafeTxForDisplay({
        to: (tx as any)?.to ?? (tx as any)?.params?.target,
        value: typeof (tx as any)?.value === 'bigint' ? (tx as any).value : BigInt(((tx as any)?.params?.value) ?? 0),
        data: ((tx as any)?.data ?? (tx as any)?.params?.data ?? '0x') as Hex,
        operation: typeof (tx as any)?.operation === 'number' ? (tx as any).operation : 0
      });
      return formattedTx.description || "Unknown transaction";
    }

    const op = typeof (tx as any)?.operation === 'number' ? (tx as any).operation : 0;
    const operationType = op === 0 ? "Call" : "DelegateCall";
    const valueBigInt = typeof (tx as any)?.value === 'bigint' ? (tx as any).value : BigInt(((tx as any)?.params?.value) ?? 0);
    const valueEth = Number(valueBigInt) / 1e18;
    
    const target = (tx as any)?.to ?? (tx as any)?.params?.target ?? 'Unknown';
    let description = `${operationType} to ${target}`;
    
    if (valueBigInt > 0n) {
      description += ` with ${valueEth} ETH`;
    }
    
    const dataHex = ((tx as any)?.data ?? (tx as any)?.params?.data ?? '0x') as string;
    if (dataHex && dataHex.length > 2) {
      description += " with data";
    }
    
    return description;
  };

  // Check if still loading operation types or permissions
  if (loadingOperationTypes || isLoadingPermissions) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-muted-foreground">PENDING TRANSACTIONS</h3>
        </div>
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading...</span>
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
          <h3 className="text-sm font-medium text-muted-foreground">PENDING TRANSACTIONS</h3>
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
        <h3 className="text-sm font-medium text-muted-foreground">
          PENDING TRANSACTIONS ({transactions.length})
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
            
            // Update progress calculation with safety check
            const timeLockPeriodInSeconds = timeLockPeriodInMinutes * 60;
            
            // Handle edge case where timelock period is 0
            let progress = 100; // Default to complete if no timelock
            let isTimeLockComplete = true;
            
            if (timeLockPeriodInSeconds > 0) {
              const startTime = Number(tx.releaseTime) - timeLockPeriodInSeconds;
              const elapsedTime = now - startTime;
              progress = Math.min(Math.max((elapsedTime / timeLockPeriodInSeconds) * 100, 0), 100);
              isTimeLockComplete = progress >= 100;
            }

            // Key for meta transaction state
            const approveKey = `${tx.txId}-approve`;
            const hasSignedApprovalFromState = signedMetaTxStates?.[approveKey]?.type === 'approve';
            const hasStoredSignedApproval = Boolean((storedTransactions as any)?.[Number(tx.txId)]);
            const hasSignedApproval = hasSignedApprovalFromState || hasStoredSignedApproval;
            
            // Get operation name from hex
            const operationTypeHex = tx.params.operationType as Hex;
            const operationName = getOperationName(operationTypeHex);
            
            // Skip if not a supported operation type
            if (!Object.values(SAFE_OPERATIONS).includes(operationName as any)) {
              return null;
            }
            
            // Derive safe display fields with fallbacks to avoid runtime errors
            const displayTo = (tx as any)?.to ?? (tx as any)?.params?.target ?? 'Unknown';
            const displayValue: bigint = typeof (tx as any)?.value === 'bigint' 
              ? (tx as any).value 
              : BigInt(((tx as any)?.params?.value) ?? 0);
            const displayOperation: number = typeof (tx as any)?.operation === 'number' ? (tx as any).operation : 0;
            const displayData: Hex = ((tx as any)?.data ?? (tx as any)?.params?.data ?? '0x') as Hex;

            // Create readable description of the transaction
            const txDescription = createTransactionDescription(tx);
            
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
                            Transaction #{tx.txId.toString()}
                          </p>
                          <Badge variant="outline" className={displayOperation === 0 ? "bg-blue-50" : "bg-purple-50"}>
                            {displayOperation === 0 ? "Call" : "DelegateCall"}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{txDescription}</p>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-xs">Target:</p>
                            <p className="truncate">{displayTo}</p>
                          </div>
                          <div>
                            <p className="font-medium text-xs">Value:</p>
                            <p>{formatEther(displayValue)} ETH</p>
                          </div>
                          {displayData && displayData !== '0x' && (
                            <div className="col-span-2">
                              <p className="font-medium text-xs">Data:</p>
                              <div className="p-3 bg-muted/50 rounded-lg border">
                                <div className="flex items-center justify-between">
                                  <span className="truncate max-w-[300px] font-mono text-xs" title={displayData}>
                                    {displayData.length > 66 ? `${displayData.slice(0, 32)}...${displayData.slice(-32)}` : displayData}
                                  </span>
                                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 hover:bg-muted"
                                        >
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                                        <DialogHeader>
                                          <DialogTitle>Transaction Data Preview</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div>
                                            <h4 className="text-sm font-medium mb-2">Raw Data:</h4>
                                            <div className="p-3 bg-muted rounded text-xs font-mono break-all">
                                              {displayData}
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => copyToClipboard(displayData, 'Transaction data')}
                                            >
                                              <Copy className="h-4 w-4 mr-2" />
                                              Copy Data
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 hover:bg-muted"
                                      onClick={() => copyToClipboard(displayData, 'Transaction data')}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Render content based on mode; tabs are controlled by parent dialog */}
                    {mode === 'timelock' ? (
                      <div className="space-y-4">
                        {/* Time Lock Progress */}
                        <div className="space-y-2">
                          {/* Info about temporal approval timing */}
                          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              <Clock className="h-4 w-4 inline mr-2" />
                              Temporal approval requires waiting for the time lock period to complete. 
                              This provides security by ensuring transactions cannot be executed immediately.
                            </p>
                          </div>
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
                        {/* Temporal Action Buttons */}
                        <div className="flex space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleApproveAction(Number(tx.txId))}
                                  disabled={
                                    !checkTimeLockApprove(tx) || 
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
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {!checkTimeLockApprove(tx)
                                  ? "Only the owner can approve transactions"
                                  : !isTimeLockComplete 
                                    ? "Time lock period not complete" 
                                    : isReady 
                                      ? "Approve this transaction request" 
                                      : "Not yet ready for approval"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handleCancelAction(Number(tx.txId))}
                                  disabled={!checkTimeLockCancel(tx) || isLoading || tx.status !== TxStatus.PENDING }
                                  variant="outline"
                                  className="w-full transition-all duration-200 flex items-center justify-center
                                    bg-rose-50 text-rose-700 hover:bg-rose-100 
                                    dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50
                                    border border-rose-200 dark:border-rose-800
                                    disabled:opacity-50 disabled:cursor-not-allowed 
                                    disabled:bg-slate-50 disabled:text-slate-400 
                                    disabled:dark:bg-slate-900 disabled:dark:text-slate-500"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  <span>Cancel</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {!checkTimeLockCancel(tx)
                                  ? "Only the owner can cancel transactions"
                                  : "Cancel this transaction request"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Meta Transaction Action Buttons */}
                        <div className="w-full space-y-2">
                          {/* Info about meta-transaction timing */}
                          <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/30">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              <Info className="h-4 w-4 inline mr-2" />
                              Meta-transactions can be signed immediately after the request phase, 
                              regardless of the time lock period. The time delay only applies to 
                              temporal (timelock) approvals.
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-1/2">
                                    <Button
                                      onClick={() => handleMetaTxSign(tx, 'approve')}
                                      disabled={
                                        !checkMetaTxSign(tx) ||
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
                                  {!checkMetaTxSign(tx)
                                    ? "Only the owner can sign approval meta-transactions"
                                    : hasSignedApproval
                                      ? "Transaction is already signed"
                                      : "Sign approval meta-transaction (available immediately)"}
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
                                        !hasSignedApproval ||
                                        !checkMetaTxBroadcast(tx) ||
                                        isLoading
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
                                    : !checkMetaTxBroadcast(tx)
                                      ? "Only the broadcaster can broadcast meta-transactions"
                                      : "Broadcast the signed meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    )}
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
  tx: SafeTxRecord;
  onApprove: (txId: number) => Promise<void>;
  onCancel: (txId: number) => Promise<void>;
  isLoading: boolean;
  contractAddress: Address;
  mode?: 'timelock' | 'metatx';
  onNotification: (notification: NotificationMessage) => void;
  onRefresh?: () => void;
  timeLockPeriodInMinutes: number;
  formatSafeTxForDisplay?: (safeTx: any) => EnhancedSafeTx;
}

export const PendingTransaction: React.FC<SinglePendingTransactionProps> = ({
  tx,
  onApprove,
  onCancel,
  isLoading,
  contractAddress,
  onNotification,
  onRefresh,
  timeLockPeriodInMinutes,
  formatSafeTxForDisplay,
  mode = 'timelock'
}) => {
  // Create a single-item array from the tx prop
  const transactions = [tx];
  
  return (
    <PendingTransactions
      contractAddress={contractAddress}
      onApprove={onApprove}
      onCancel={onCancel}
      isLoading={isLoading}
      mode={mode}
      onNotification={onNotification}
      transactions={transactions}
      isLoadingTx={false}
      onRefresh={onRefresh}
      timeLockPeriodInMinutes={timeLockPeriodInMinutes}
      formatSafeTxForDisplay={formatSafeTxForDisplay}
    />
  );
};
