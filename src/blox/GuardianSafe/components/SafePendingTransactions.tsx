import { useState } from "react";
import { Address, formatEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  Copy,
  AlertCircle,
  Shield,
  Radio,
  Timer,
  Zap
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SafePendingTx } from "../lib/safe/SafeTxService";
import { useAccount } from "wagmi";
import { useOperations } from "../hooks/useOperations";

export interface SafePendingTransactionsProps {
  pendingTransactions: SafePendingTx[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
  safeAddress?: Address;
  chainId?: number;
  connectedAddress?: Address;
  contractAddress?: Address;
  onNotification?: (message: any) => void;
}

/**
 * Component to display Safe pending transactions with Guardian protocol actions
 */
export function SafePendingTransactions({
  pendingTransactions,
  isLoading,
  error,
  onRefresh,
  safeAddress,
  chainId,
  connectedAddress,
  contractAddress,
  onNotification
}: SafePendingTransactionsProps) {
  const { address } = useAccount();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("view");

  // Guardian operations hook
  const {
    handleRequestTransaction,
    handleSinglePhaseMetaTxSign,
    handleBroadcastSinglePhaseMetaTx,
    signedMetaTxStates,
    loadingStates
  } = useOperations({
    contractAddress: contractAddress || "0x0000000000000000000000000000000000000000" as Address,
    onSuccess: onNotification,
    onError: onNotification,
    onRefresh
  });

  // Handle refresh with loading state
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format transaction value
  const formatValue = (value: bigint): string => {
    if (value === BigInt(0)) return "0 ETH";
    return `${formatEther(value)} ETH`;
  };

  // Format operation type
  const formatOperation = (operation: number): string => {
    switch (operation) {
      case 0:
        return "Call";
      case 1:
        return "DelegateCall";
      default:
        return `Unknown (${operation})`;
    }
  };

  // Get Safe UI URL for transaction
  const getSafeUIUrl = (safeTxHash: string): string => {
    if (!safeAddress) return "#";
    
    const baseUrl = chainId === 1 ? "https://app.safe.global" : "https://safe-transaction-mainnet.safe.global";
    return `${baseUrl}/transactions/queue?safe=${safeAddress}&id=${safeTxHash}`;
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(`${label} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Check if connected wallet can sign (is an owner)
  const canSign = (tx: SafePendingTx): boolean => {
    if (!connectedAddress || !address) return false;
    
    // Check if connected address is in confirmations
    const hasConfirmed = tx.confirmations.some(
      conf => conf.owner.toLowerCase() === connectedAddress.toLowerCase()
    );
    
    // Check if connected address is in confirmations
    const isOwner = tx.confirmations.some(
      conf => conf.owner.toLowerCase() === address.toLowerCase()
    );
    
    return !hasConfirmed && isOwner;
  };

  // Get confirmation status
  const getConfirmationStatus = (tx: SafePendingTx) => {
    const confirmed = tx.confirmations.length;
    const required = tx.confirmationsRequired;
    const remaining = required - confirmed;
    
    return {
      confirmed,
      required,
      remaining,
      isComplete: confirmed >= required
    };
  };

  // Handle Guardian protocol actions
  const handleGuardianRequest = async (safeTx: SafePendingTx) => {
    try {
      // Convert SafePendingTx to SafeTx format for Guardian protocol
      const safeTxData = {
        to: safeTx.to,
        value: safeTx.value,
        data: safeTx.data as `0x${string}`,
        operation: safeTx.operation,
        safeTxGas: safeTx.safeTxGas,
        baseGas: safeTx.baseGas,
        gasPrice: safeTx.gasPrice,
        gasToken: safeTx.gasToken,
        refundReceiver: safeTx.refundReceiver,
        signatures: safeTx.signatures as `0x${string}`
      };
      
      await handleRequestTransaction(safeTxData);
    } catch (error) {
      console.error('Failed to request Safe transaction:', error);
    }
  };

  const handleGuardianMetaTxSign = async (safeTx: SafePendingTx, type: 'request' | 'approve' | 'cancel') => {
    try {
      // Convert SafePendingTx to SafeTx format for Guardian protocol
      const safeTxData = {
        to: safeTx.to,
        value: safeTx.value,
        data: safeTx.data as `0x${string}`,
        operation: safeTx.operation,
        safeTxGas: safeTx.safeTxGas,
        baseGas: safeTx.baseGas,
        gasPrice: safeTx.gasPrice,
        gasToken: safeTx.gasToken,
        refundReceiver: safeTx.refundReceiver,
        signatures: safeTx.signatures as `0x${string}`
      };
      
      // For single-phase meta-transaction, we use the request type
      if (type === 'request') {
        // Use Safe nonce as the custom ID for predictable storage
        const customId = `temp_${safeTx.nonce}`;
        await handleSinglePhaseMetaTxSign(safeTxData, customId);
      } else {
        console.warn('Approval/cancellation meta-transactions require the GuardianSafe transaction ID');
      }
    } catch (error) {
      console.error('Failed to sign meta transaction:', error);
    }
  };

  const handleGuardianMetaTxBroadcast = async (safeTx: SafePendingTx, _type: 'request' | 'approve' | 'cancel') => {
    try {
      // For single-phase meta-transaction, we need to find the stored transaction
      // We'll use a temporary ID based on the Safe nonce
      const tempId = `temp_${safeTx.nonce}`;
      await handleBroadcastSinglePhaseMetaTx(tempId);
    } catch (error) {
      console.error('Failed to broadcast meta transaction:', error);
    }
  };

  // Check if meta transaction is signed
  const isMetaTxSigned = (safeTx: SafePendingTx, _type: 'request' | 'approve' | 'cancel'): boolean => {
    // Use a temporary ID based on the Safe nonce
    const tempId = `temp_${safeTx.nonce}`;
    return !!signedMetaTxStates[tempId];
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load pending transactions: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            SAFE PENDING TRANSACTIONS
          </h3>
          {pendingTransactions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendingTransactions.length}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="view" className="text-xs">View</TabsTrigger>
              <TabsTrigger value="guardian" className="text-xs">Guardian</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading pending transactions...</p>
        </div>
      )}

      {/* No Transactions */}
      {!isLoading && pendingTransactions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Pending Transactions</h3>
              <p className="text-sm text-muted-foreground">
                There are currently no pending transactions in this Safe.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      {!isLoading && pendingTransactions.length > 0 && (
        <div className="space-y-4">
          {pendingTransactions.map((tx) => {
            const confirmationStatus = getConfirmationStatus(tx);
            const canSignTx = canSign(tx);
            
            return (
              <Card key={tx.safeTxHash} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        Transaction #{tx.nonce}
                      </CardTitle>
                      <Badge 
                        variant={confirmationStatus.isComplete ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {confirmationStatus.isComplete ? "Ready to Execute" : "Pending"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Copy Transaction Hash */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => copyToClipboard(tx.safeTxHash, "Transaction hash")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy transaction hash</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* View in Safe UI */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => window.open(getSafeUIUrl(tx.safeTxHash), '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View in Safe UI</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Transaction Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">To:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs truncate max-w-[200px]" title={tx.to}>
                          {tx.to}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(tx.to, "Address")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Value:</span>
                      <div className="mt-1 font-medium">
                        {formatValue(tx.value)}
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Operation:</span>
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          {formatOperation(tx.operation)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <div className="mt-1 text-xs">
                        {formatDate(tx.submissionDate)}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Data */}
                  {tx.data && tx.data !== '0x' && (
                    <div>
                      <span className="text-muted-foreground text-sm">Data:</span>
                      <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                        {tx.data}
                      </div>
                    </div>
                  )}

                  {/* Confirmations Status */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Confirmations:</span>
                      <span className="text-sm font-medium">
                        {confirmationStatus.confirmed} / {confirmationStatus.required}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${(confirmationStatus.confirmed / confirmationStatus.confirmed) * 100}%` 
                        }}
                      />
                    </div>
                    
                    {/* Confirmation Details */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {confirmationStatus.remaining > 0 ? (
                        <span>
                          {confirmationStatus.remaining} more confirmation{confirmationStatus.remaining !== 1 ? 's' : ''} needed
                        </span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready to execute
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Guardian Protocol Actions */}
                  {activeTab === "guardian" && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">Guardian Protocol Actions</span>
                      </div>
                      
                      {/* Temporal Workflow (Request/Approve with time delay) */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">Temporal Workflow</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGuardianRequest(tx)}
                            disabled={loadingStates.request || !contractAddress}
                            className="w-full"
                          >
                            {loadingStates.request ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Shield className="h-4 w-4 mr-2" />
                            )}
                            Request Transaction (Time-lock)
                          </Button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Request this transaction through Guardian protocol with time-lock security
                        </p>
                      </div>

                      {/* Meta Transaction (Direct signing for immediate broadcast) */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Meta Transaction</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGuardianMetaTxSign(tx, 'request')}
                            disabled={loadingStates.metaTx || !contractAddress || isMetaTxSigned(tx, 'request')}
                            className="w-full"
                          >
                            {loadingStates.metaTx ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : isMetaTxSigned(tx, 'request') ? (
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            ) : (
                              <Radio className="h-4 w-4 mr-2" />
                            )}
                            {isMetaTxSigned(tx, 'request') ? 'Signed' : 'Sign Request Meta-Tx'}
                          </Button>
                          
                          {isMetaTxSigned(tx, 'request') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleGuardianMetaTxBroadcast(tx, 'request')}
                              disabled={loadingStates.metaTx}
                              className="w-full"
                            >
                              {loadingStates.metaTx ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Radio className="h-4 w-4 mr-2" />
                              )}
                              Broadcast Meta-Transaction
                            </Button>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Sign and broadcast this transaction immediately through Guardian protocol
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sign Transaction Button (Safe UI) */}
                  {activeTab === "view" && canSignTx && (
                    <div className="border-t pt-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          You can sign this transaction. Go to the Safe UI to complete the signing process.
                        </AlertDescription>
                      </Alert>
                      
                      <Button 
                        className="w-full mt-2"
                        onClick={() => window.open(getSafeUIUrl(tx.safeTxHash), '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Sign in Safe UI
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
