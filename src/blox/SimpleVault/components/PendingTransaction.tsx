import * as React from "react";
import { Address, Hex } from "viem";
import { formatEther, formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { TxStatus } from "../../../particle-core/sdk/typescript/types/lib.index";
import { useMultiPhaseTemporalAction } from "@/hooks/useMultiPhaseTemporalAction";
import { TxRecord } from "../../../particle-core/sdk/typescript/interfaces/lib.index";
import { useSimpleVaultOperations, VAULT_OPERATIONS } from "../hooks/useSimpleVaultOperations";
import { useVaultMetaTx } from "../hooks/useVaultMetaTx";
import { useTransactionManager } from "@/hooks/useTransactionManager";
import { usePublicClient, useWalletClient, useChainId, useConfig } from "wagmi";
import SimpleVault from "../SimpleVault";
import { useRoleValidation } from "@/hooks/useRoleValidation";
import { useOperationTypes } from "@/hooks/useOperationTypes";

// Notification message type
type NotificationMessage = {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
};

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

interface PendingTransactionsProps {
  contractAddress: Address;
  onApprove: (txId: number) => Promise<void>;
  onCancel: (txId: number) => Promise<void>;
  isLoading?: boolean;
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
  isLoading = false,
  mode = 'timelock',
  onNotification,
  ownerAddress,
  broadcasterAddress,
  connectedAddress
}) => {
  // State for holding pending transactions
  const [pendingTransactions, setPendingTransactions] = React.useState<VaultTxRecord[]>([]);
  const [isLoadingTx, setIsLoadingTx] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  
  // Track meta transaction signatures to prevent double signing/broadcasting
  const [signedMetaTxStates, setSignedMetaTxStates] = React.useState<Record<string, { type: 'approve' | 'cancel' }>>({}); 
  
  // Hooks for wallet integration
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const config = useConfig();
  const { signWithdrawalApproval, isLoading: isSigningMetaTx } = useVaultMetaTx(contractAddress);
  const { transactions, storeTransaction } = useTransactionManager(contractAddress);
  
  // Get operation types for mapping hex values to human-readable names
  const { getOperationName, operationTypes, loading: loadingOperationTypes } = useOperationTypes(contractAddress);

  // Store client references in state
  const [clients, setClients] = React.useState<{
    publicClient: typeof publicClient | null;
    walletClient: typeof walletClient | null;
  }>({ publicClient: null, walletClient: null });

  // Role validation
  const roleValidation = useRoleValidation(
    contractAddress as Address,
    connectedAddress as Address | undefined,
    React.useMemo(() => {
      if (!chainId) return undefined;
      return config.chains.find(c => c.id === chainId);
    }, [chainId, config.chains])
  );
  
  const { isOwner, isBroadcaster } = roleValidation;

  // Update clients when they change
  React.useEffect(() => {
    setClients({
      publicClient,
      walletClient
    });
  }, [publicClient, walletClient]);

  // Function to fetch pending transactions
  const fetchPendingTransactions = React.useCallback(async () => {
    if (!clients.publicClient || !chainId || loadingOperationTypes) return;
    
    try {
      setIsLoadingTx(true);
      
      // Create SimpleVault instance to get pending transactions
      const vaultInstance = new SimpleVault(
        clients.publicClient,
        walletClient,
        contractAddress,
        config.chains.find(c => c.id === chainId)!
      );
      
      // Fetch pending transactions
      console.log('Fetching pending transactions for vault:', contractAddress);
      const pendingTxs = await vaultInstance.getPendingTransactions();
      
      // Filter for withdraw operations using the operation type names
      const withdrawPendingTxs = pendingTxs.filter(tx => {
        const operationTypeHex = tx.params.operationType as Hex;
        const operationName = getOperationName(operationTypeHex);
        return operationName === VAULT_OPERATIONS.WITHDRAW_ETH || 
               operationName === VAULT_OPERATIONS.WITHDRAW_TOKEN;
      });
      
      console.log('Filtered withdrawal pending transactions:', withdrawPendingTxs.length);
      setPendingTransactions(withdrawPendingTxs);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      onNotification?.({
        type: 'error',
        title: 'Failed to Load Transactions',
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsLoadingTx(false);
      setIsRefreshing(false);
    }
  }, [clients.publicClient, walletClient, contractAddress, chainId, config.chains, onNotification, getOperationName, loadingOperationTypes]);

  // Initial load of pending transactions - only after operation types are loaded
  React.useEffect(() => {
    if (!loadingOperationTypes) {
      fetchPendingTransactions();
    }
  }, [fetchPendingTransactions, loadingOperationTypes]);

  // Refresh pending transactions manually
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPendingTransactions();
  };

  // Handle meta transaction signing
  const handleMetaTxSign = async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    try {
      if (type === 'approve') {
        console.log('Starting meta transaction signing for txId:', tx.txId);
        
        const signedTx = await signWithdrawalApproval(Number(tx.txId));
        console.log('Received signed transaction:', signedTx);
        
        // Convert all BigInt values to strings recursively
        const serializedTx = convertBigIntsToStrings(signedTx);
        console.log('Serialized transaction:', serializedTx);

        // Create the correct transaction key
        const txKey = `metatx-${type}-${tx.txId}`;
        console.log('Storing with key:', txKey);

        storeTransaction(
          txKey,
          JSON.stringify(serializedTx),
          {
            type: 'WITHDRAWAL_APPROVAL',
            timestamp: Date.now()
          }
        );

        // Verify storage immediately after storing
        console.log('Stored transactions:', transactions);
        
        // Update signed state
        setSignedMetaTxStates(prev => ({
          ...prev,
          [`${tx.txId}-${type}`]: { type }
        }));

        onNotification?.({
          type: 'success',
          title: 'Meta Transaction Signed',
          description: `Successfully signed approval for transaction #${tx.txId}`
        });
      }
    } catch (error) {
      console.error('Failed to sign meta transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Signing Failed',
        description: error instanceof Error ? error.message : 'Failed to sign meta transaction'
      });
    }
  };

  // Handle broadcasting meta transaction
  const handleBroadcastMetaTx = async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    try {
      const txKey = `metatx-${type}-${tx.txId}`;
      console.log('Looking for transaction with key:', txKey);
      console.log('Available transactions:', transactions);
      
      const storedTx = transactions[txKey];
      console.log('Found stored transaction:', storedTx);
      
      if (!storedTx) {
        throw new Error('No signed transaction found');
      }

      // Parse the signed transaction data
      const signedMetaTx = JSON.parse(storedTx.signedData);
      console.log('Parsed meta transaction:', signedMetaTx);

      // Use clients from state instead of hooks
      if (!clients.publicClient || !clients.walletClient || !clients.walletClient.chain) {
        console.error('Client state:', clients);
        throw new Error('Wallet not connected');
      }

      // Get the account from the wallet client
      const [account] = await clients.walletClient.getAddresses();
      
      if (!account) {
        throw new Error('No account found in wallet');
      }

      console.log('Broadcasting with account:', account);
      console.log('Creating vault instance with:', {
        contractAddress,
        chain: clients.walletClient.chain,
        account
      });

      const vault = new SimpleVault(
        clients.publicClient, 
        clients.walletClient, 
        contractAddress, 
        clients.walletClient.chain
      );

      // Broadcast the meta transaction
      console.log('Broadcasting meta transaction...');
      const result = await vault.approveWithdrawalWithMetaTx(
        signedMetaTx,
        { from: account }
      );

      console.log('Broadcast result:', result);
      await result.wait();
      
      onNotification?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction for withdrawal #${tx.txId}`
      });

      // Clear the signed state and refresh transactions
      setSignedMetaTxStates(prev => {
        const newState = { ...prev };
        delete newState[`${tx.txId}-${type}`];
        return newState;
      });
      
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

  // Handle approve action
  const handleApproveAction = async (txId: number) => {
    try {
      await onApprove(txId);
      onNotification?.({
        type: 'success',
        title: 'Transaction Approved',
        description: `Successfully approved transaction #${txId}`
      });
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

  // Handle cancel action
  const handleCancelAction = async (txId: number) => {
    try {
      await onCancel(txId);
      onNotification?.({
        type: 'success',
        title: 'Transaction Cancelled',
        description: `Successfully cancelled transaction #${txId}`
      });
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

  // Check if pending transactions is empty
  if (pendingTransactions.length === 0 && !isLoadingTx) {
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
          Pending Transactions ({pendingTransactions.length})
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
      
      {isLoadingTx && pendingTransactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingTransactions.map(tx => {
            // Calculate time-based values
            const now = Math.floor(Date.now() / 1000);
            const isReady = now >= Number(tx.releaseTime);
            const progress = Math.min(((now - (Number(tx.releaseTime) - 24 * 3600)) / (24 * 3600)) * 100, 100);
            const isTimeLockComplete = progress >= 100;
            
            // Key for meta transaction state
            const approveKey = `${tx.txId}-approve`;
            const cancelKey = `${tx.txId}-cancel`;
            const hasSignedApproval = signedMetaTxStates[approveKey]?.type === 'approve';
            const hasSignedCancel = signedMetaTxStates[cancelKey]?.type === 'cancel';
            
            // Ensure amount is a BigInt and handle undefined
            const amount = tx.amount !== undefined ? BigInt(tx.amount) : 0n;
            
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
                          Amount: {tx.type === "ETH" ? formatEther(amount) : formatUnits(amount, 18)} {tx.type}
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
                                    disabled={!isReady || isLoading || tx.status !== TxStatus.PENDING || !isTimeLockComplete}
                                    className={`w-full transition-all duration-200 flex items-center justify-center
                                      ${isTimeLockComplete 
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                      }
                                      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:dark:bg-slate-900 disabled:dark:text-slate-500
                                    `}
                                    variant="outline"
                                    aria-label={`Approve transaction #${tx.txId}`}
                                  >
                                    {isTimeLockComplete && <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    <span>Approve</span>
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {!isTimeLockComplete 
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
                                    disabled={isLoading || tx.status !== TxStatus.PENDING}
                                    className={`w-full transition-all duration-200 flex items-center justify-center
                                      bg-rose-50 text-rose-700 hover:bg-rose-100 
                                      dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50
                                      border border-rose-200 dark:border-rose-800
                                      disabled:opacity-50 disabled:cursor-not-allowed 
                                      disabled:bg-slate-50 disabled:text-slate-400 
                                      disabled:dark:bg-slate-900 disabled:dark:text-slate-500"
                                    `}
                                    variant="outline"
                                    aria-label={`Cancel transaction #${tx.txId}`}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    <span>Cancel</span>
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {tx.status !== TxStatus.PENDING 
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
                                        isLoading || 
                                        tx.status !== TxStatus.PENDING || 
                                        isSigningMetaTx || 
                                        hasSignedApproval || 
                                        (!isOwner && ownerAddress !== undefined)
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
                                      {isSigningMetaTx ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          <span>Signing...</span>
                                        </>
                                      ) : hasSignedApproval ? (
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
                                  {!isOwner && ownerAddress 
                                    ? "Only the owner can sign approval meta-transactions"
                                    : hasSignedApproval 
                                      ? "Transaction is signed and ready to broadcast"
                                      : "Sign approval meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-1/2">
                                    <Button
                                      onClick={() => handleMetaTxSign(tx, 'cancel')}
                                      disabled={
                                        isLoading || 
                                        tx.status !== TxStatus.PENDING || 
                                        isSigningMetaTx || 
                                        hasSignedCancel || 
                                        (!isOwner && ownerAddress !== undefined)
                                      }
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
                                      {isSigningMetaTx ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          <span>Signing...</span>
                                        </>
                                      ) : hasSignedCancel ? (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          <span>Signed</span>
                                        </>
                                      ) : (
                                        <>
                                          <X className="h-4 w-4 mr-2" />
                                          <span>Sign Cancel</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {!isOwner && ownerAddress
                                    ? "Only the owner can sign cancellation meta-transactions"
                                    : hasSignedCancel
                                      ? "Transaction is signed and ready to broadcast"
                                      : "Sign cancellation meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {hasSignedApproval && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full">
                                    <Button
                                      onClick={() => handleBroadcastMetaTx(tx, 'approve')}
                                      disabled={
                                        isLoading || 
                                        !hasSignedApproval || 
                                        (!isBroadcaster && broadcasterAddress !== undefined)
                                      }
                                      className="w-full transition-all duration-200 flex items-center justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800"
                                      variant="outline"
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      <span>Broadcast</span>
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {!isBroadcaster && broadcasterAddress
                                    ? "Only the broadcaster can broadcast meta-transactions"
                                    : "Broadcast the signed meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {hasSignedCancel && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-full">
                                    <Button
                                      onClick={() => handleBroadcastMetaTx(tx, 'cancel')}
                                      disabled={
                                        isLoading || 
                                        !hasSignedCancel || 
                                        (!isBroadcaster && broadcasterAddress !== undefined)
                                      }
                                      className="w-full transition-all duration-200 flex items-center justify-center bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800"
                                      variant="outline"
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      <span>Broadcast</span>
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {!isBroadcaster && broadcasterAddress
                                    ? "Only the broadcaster can broadcast meta-transactions"
                                    : "Broadcast the signed meta-transaction"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
  onNotification?: (message: NotificationMessage) => void;
  ownerAddress?: Address;
  broadcasterAddress?: Address;
  connectedAddress?: Address;
}

export const PendingTransaction: React.FC<SinglePendingTransactionProps> = (props) => {
  return (
    <PendingTransactions
      contractAddress={props.contractAddress}
      onApprove={props.onApprove}
      onCancel={props.onCancel}
      isLoading={props.isLoading}
      mode={props.mode}
      onNotification={props.onNotification}
      ownerAddress={props.ownerAddress}
      broadcasterAddress={props.broadcasterAddress}
      connectedAddress={props.connectedAddress}
    />
  );
}; 