import * as React from "react";
import { Address, Hex } from "viem";
import { formatEther, formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2, Clock, XCircle } from "lucide-react";
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

interface PendingTransactionProps {
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

export const PendingTransaction: React.FC<PendingTransactionProps> = ({
  tx,
  onApprove,
  onCancel,
  isLoading,
  contractAddress,
  mode = 'timelock',
  onNotification,
  ownerAddress,
  broadcasterAddress,
  connectedAddress
}) => {
  // Add new hooks
  const { signWithdrawalApproval, isLoading: isSigningMetaTx } = useVaultMetaTx(contractAddress);
  const { transactions, storeTransaction } = useTransactionManager(contractAddress);
  const [signedMetaTxState, setSignedMetaTxState] = React.useState<{ type: 'approve' | 'cancel' } | null>(null);
  
  // Get clients from Wagmi
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const config = useConfig();

  // Store client references in state
  const [clients, setClients] = React.useState<{
    publicClient: typeof publicClient | null;
    walletClient: typeof walletClient | null;
  }>({ publicClient: null, walletClient: null });

  // Update clients when they change
  React.useEffect(() => {
    setClients({
      publicClient,
      walletClient
    });
  }, [publicClient, walletClient]);

  // Get chain configuration
  const chain = React.useMemo(() => {
    if (!chainId) return undefined;
    return config.chains.find(c => c.id === chainId);
  }, [chainId, config.chains]);

  // Use role validation hook
  const roleValidation = useRoleValidation(
    contractAddress as Address,
    connectedAddress as Address | undefined,
    chain
  );

  // Role validation hooks - moved to top
  const { isOwner, isBroadcaster, isLoading: isRoleValidationLoading } = React.useMemo(() => {
    return {
      isOwner: roleValidation.isOwner,
      isBroadcaster: roleValidation.isBroadcaster,
      isLoading: roleValidation.isLoading
    };
  }, [roleValidation]);

  // Add debug logging
  React.useEffect(() => {
    console.log('Role validation:', {
      connectedAddress,
      ownerAddress,
      isOwner,
      broadcasterAddress,
      isBroadcaster,
      roleValidation,
      isRoleValidationLoading,
      chain
    });
  }, [connectedAddress, ownerAddress, isOwner, broadcasterAddress, isBroadcaster, roleValidation, isRoleValidationLoading, chain]);

  // Memoize the operations array to prevent re-renders
  const operations = React.useMemo(() => [tx], [tx]);

  // Memoize the pendingTx object to prevent re-renders
  const pendingTx = React.useMemo(() => ({ ...tx, contractAddress }), [tx, contractAddress]);

  const { getOperationName } = useSimpleVaultOperations({
    contractAddress,
    operations,
    isLoading
  });

  const {
    isApproving,
    isCancelling,
    isSigning,
    handleApprove: handleApproveAction,
    handleCancel: handleCancelAction,
    handleBroadcast: handleBroadcastAction
  } = useMultiPhaseTemporalAction({
    isOpen: true,
    onOpenChange: () => {},
    onApprove,
    onCancel,
    pendingTx,
    showNewValueInput: false
  });

  // Check if the transaction is a valid vault operation
  const operationType = getOperationName(tx.params.operationType as Hex);
  const isValidVaultOperation = Object.values(VAULT_OPERATIONS).includes(operationType as keyof typeof VAULT_OPERATIONS);

  // If not a valid vault operation, render nothing
  if (!isValidVaultOperation) {
    return null;
  }

  // Calculate time-based values
  const now = Math.floor(Date.now() / 1000);
  const isReady = now >= Number(tx.releaseTime);
  const progress = Math.min(((now - (Number(tx.releaseTime) - 24 * 3600)) / (24 * 3600)) * 100, 100);
  const isTimeLockComplete = progress >= 100;

  // Ensure amount is a BigInt and handle undefined
  const amount = tx.amount !== undefined ? BigInt(tx.amount) : 0n;

  const handleMetaTxSign = async (type: 'approve' | 'cancel') => {
    try {
      if (type === 'approve') {
        // Log before signing
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
          txKey, // Changed from tx.txId.toString() to match the key used in broadcast
          JSON.stringify(serializedTx),
          {
            type: 'WITHDRAWAL_APPROVAL',
            timestamp: Date.now()
          }
        );

        // Verify storage immediately after storing
        console.log('Stored transactions:', transactions);
        
        setSignedMetaTxState({ type: 'approve' });

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
      throw error;
    }
  };

  const handleBroadcastWithNotification = async (type: 'approve' | 'cancel') => {
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

      setSignedMetaTxState(null);
    } catch (error) {
      console.error('Failed to broadcast transaction:', error);
      onNotification?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast transaction'
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-left">
              <div className="flex items-center gap-2">
                {tx.status === TxStatus.PENDING && <Clock className="h-4 w-4 text-yellow-500" />}
                {tx.status === TxStatus.CANCELLED && <XCircle className="h-4 w-4 text-red-500" />}
                {tx.status === TxStatus.COMPLETED && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <p className="font-medium">
                  {operationType === VAULT_OPERATIONS.WITHDRAW_ETH ? "ETH Withdrawal" : "Token Withdrawal"} #{tx.txId.toString()}
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
                          disabled={!isReady || isLoading || tx.status !== TxStatus.PENDING || !isTimeLockComplete || isApproving || isSigning}
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
                          {isApproving || isSigning ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              <span>{isSigning ? "Signing..." : "Processing..."}</span>
                            </>
                          ) : (
                            <>
                              {isTimeLockComplete && <CheckCircle2 className="h-4 w-4 mr-2" />}
                              <span>Approve</span>
                            </>
                          )}
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
                          disabled={isLoading || tx.status !== TxStatus.PENDING || isCancelling}
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
                          {isCancelling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-2" />
                              <span>Cancel</span>
                            </>
                          )}
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
                            onClick={() => handleMetaTxSign('approve')}
                            disabled={
                              isLoading || 
                              tx.status !== TxStatus.PENDING || 
                              isSigningMetaTx || 
                              signedMetaTxState?.type === 'approve' || 
                              (!isOwner && ownerAddress !== undefined) // Only disable if owner address is provided and not matching
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
                            ) : signedMetaTxState?.type === 'approve' ? (
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
                          : signedMetaTxState?.type === 'approve' 
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
                            onClick={() => handleMetaTxSign('cancel')}
                            disabled={
                              isLoading || 
                              tx.status !== TxStatus.PENDING || 
                              isSigning || 
                              signedMetaTxState?.type === 'cancel' || 
                              (!isOwner && ownerAddress !== undefined) // Only disable if owner address is provided and not matching
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
                            {isSigning ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                <span>Signing...</span>
                              </>
                            ) : signedMetaTxState?.type === 'cancel' ? (
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
                          : signedMetaTxState?.type === 'cancel'
                            ? "Transaction is signed and ready to broadcast"
                            : "Sign cancellation meta-transaction"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {signedMetaTxState?.type === 'approve' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button
                            onClick={() => handleBroadcastWithNotification('approve')}
                            disabled={
                              isLoading || 
                              !signedMetaTxState || 
                              (!isBroadcaster && broadcasterAddress !== undefined) // Only disable if broadcaster address is provided and not matching
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

                {signedMetaTxState?.type === 'cancel' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button
                            onClick={() => handleBroadcastWithNotification('cancel')}
                            disabled={
                              isLoading || 
                              !signedMetaTxState || 
                              (!isBroadcaster && broadcasterAddress !== undefined) // Only disable if broadcaster address is provided and not matching
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
}; 