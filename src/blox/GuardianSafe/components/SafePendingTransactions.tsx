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
  Zap,
  Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SafePendingTx } from "../lib/safe/SafeTxService";
import { useAccount } from "wagmi";
import { useOperations } from "../hooks/useOperations";
import { useMetaTransactionManager } from "@/hooks/useMetaTransactionManager";
import { decodeSafeMethodEnhanced } from "../lib/safeMethodDecoder";


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

  // Get transactions from parent context (TransactionManagerProvider)
  // We don't need to call useMetaTransactionManager here since we're inside GuardianSafe UI
  // which already provides the TransactionManagerProvider context
  const { transactions } = useMetaTransactionManager(contractAddress || "0x0000000000000000000000000000000000000000" as Address);

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

  // Format operation type with enhanced method decoding
  const formatOperation = (operation: number, data?: string): string => {
    // First check if we have data to decode the specific method
    if (data && data !== '0x' && data !== '0x0') {
      const methodInfo = decodeSafeMethodEnhanced(data);
      if (methodInfo.isSafeMethod) {
        return methodInfo.methodName;
      }
    }
    
    // Fallback to operation type
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
    
    // Use the correct Safe app URL format
    const baseUrl = "https://app.safe.global";
    
    // Determine chain prefix based on chainId
    let chainPrefix = "eth"; // default to mainnet
    if (chainId === 11155111) {
      chainPrefix = "sep"; // Sepolia testnet
    } else if (chainId === 5) {
      chainPrefix = "gor"; // Goerli testnet
    } else if (chainId === 1) {
      chainPrefix = "eth"; // Ethereum mainnet
    }
    
    // Format the multisig ID with chain prefix and safe address
    const multisigId = `multisig_${safeAddress}_${safeTxHash}`;
    
    return `${baseUrl}/transactions/tx?safe=${chainPrefix}:${safeAddress}&id=${multisigId}`;
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

  // Get Safe signature status
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
      // Extract signatures from confirmations if safeTx.signatures is empty (same as meta tx flow)
      let extractedSignatures = safeTx.signatures;
      
      if (!extractedSignatures || extractedSignatures === '0x') {
        // Combine signatures from confirmations
        const signatureArray: string[] = [];
        
        safeTx.confirmations?.forEach(confirmation => {
          if (confirmation.signature) {
            // Remove '0x' prefix if present
            const cleanSig = confirmation.signature.startsWith('0x') 
              ? confirmation.signature.slice(2) 
              : confirmation.signature;
            signatureArray.push(cleanSig);
          }
        });
        
        if (signatureArray.length > 0) {
          extractedSignatures = '0x' + signatureArray.join('');
        }
      }

      // Convert SafePendingTx to SafeTx format for Guardian protocol
      // Ensure data is properly formatted hex string
      const formattedData = safeTx.data?.startsWith('0x') ? safeTx.data : `0x${safeTx.data || ''}`;

      // Ensure signatures is properly formatted hex string
      const formattedSignatures = extractedSignatures?.startsWith('0x') 
        ? extractedSignatures 
        : extractedSignatures 
          ? `0x${extractedSignatures}` 
          : '0x';

      const safeTxData = {
        to: safeTx.to,
        value: safeTx.value,
        data: formattedData as `0x${string}`,
        operation: safeTx.operation,
        safeTxGas: safeTx.safeTxGas,
        baseGas: safeTx.baseGas,
        gasPrice: safeTx.gasPrice,
        gasToken: safeTx.gasToken,
        refundReceiver: safeTx.refundReceiver,
        signatures: formattedSignatures as `0x${string}`
      };
      
      await handleRequestTransaction(safeTxData);
    } catch (error) {
      console.error('Failed to request Safe transaction:', error);
    }
  };

  const handleGuardianMetaTxSign = async (safeTx: SafePendingTx, type: 'request' | 'approve' | 'cancel') => {
    try {
      // Extract signatures from confirmations if safeTx.signatures is empty
      let extractedSignatures = safeTx.signatures;
      
      if (!extractedSignatures || extractedSignatures === '0x') {
        // Combine signatures from confirmations
        const signatureArray: string[] = [];
        
        safeTx.confirmations?.forEach(confirmation => {
          if (confirmation.signature) {
            // Remove '0x' prefix if present
            const cleanSig = confirmation.signature.startsWith('0x') 
              ? confirmation.signature.slice(2) 
              : confirmation.signature;
            signatureArray.push(cleanSig);
          }
        });
        
        if (signatureArray.length > 0) {
          extractedSignatures = '0x' + signatureArray.join('');
        }
      }
      // Convert SafePendingTx to SafeTx format for Guardian protocol
      // Ensure data is properly formatted hex string
      const formattedData = safeTx.data?.startsWith('0x') ? safeTx.data : `0x${safeTx.data || ''}`;

      // Ensure signatures is properly formatted hex string
      const formattedSignatures = extractedSignatures?.startsWith('0x') 
        ? extractedSignatures 
        : extractedSignatures 
          ? `0x${extractedSignatures}` 
          : '0x';
      
      const safeTxData = {
        to: safeTx.to,
        value: safeTx.value,
        data: formattedData as `0x${string}`,
        operation: safeTx.operation,
        safeTxGas: safeTx.safeTxGas,
        baseGas: safeTx.baseGas,
        gasPrice: safeTx.gasPrice,
        gasToken: safeTx.gasToken,
        refundReceiver: safeTx.refundReceiver,
        signatures: formattedSignatures as `0x${string}`
      };

      // For single-phase meta-transaction, we use the request type
      if (type === 'request') {
        // Use Safe nonce as the numeric ID for consistent storage
        const customId = safeTx.nonce.toString();
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
      // Use Safe nonce as the numeric ID for consistent storage
      const txId = safeTx.nonce.toString();
      
      // Check if the transaction exists in storage
      if (!transactions[Number(txId)]) {
        throw new Error('No signed meta-transaction found. Please sign the transaction first.');
      }
      
      await handleBroadcastSinglePhaseMetaTx(txId);
    } catch (error) {
      console.error('Failed to broadcast meta transaction:', error);
      // Show error to user
      onNotification?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error instanceof Error ? error.message : 'Failed to broadcast meta transaction'
      });
    }
  };

  // Check if meta transaction is signed
  const isMetaTxSigned = (safeTx: SafePendingTx, _type: 'request' | 'approve' | 'cancel'): boolean => {
    // Use Safe nonce as the numeric ID for consistent storage
    const txId = safeTx.nonce.toString();
    // Check both the signed states and the actual stored transactions
    return !!signedMetaTxStates[txId] && !!transactions[Number(txId)];
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
            SAFE PENDING TRANSACTION
          </h3>
          {pendingTransactions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Nonce: {pendingTransactions.sort((a, b) => a.nonce - b.nonce)[0]?.nonce}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
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
          {pendingTransactions
            .sort((a, b) => a.nonce - b.nonce) // Sort by nonce (lowest first)
            .slice(0, 1) // Only show the first (lowest nonce) transaction
            .map((tx) => {
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
                
                <CardContent className="space-y-6">
                  {/* Transaction Information & Signatures Section */}
                  <div className="space-y-6">
                    {/* Submitted timestamp as subtitle */}
                    <div className="text-xs text-muted-foreground">
                      Submitted: {formatDate(tx.submissionDate)}
                    </div>
                    
                    {/* Main Transaction Details Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left Column - Transaction Details */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="space-y-4 text-sm">
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Recipient</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm" title={tx.to}>
                                {tx.to.length > 20 ? `${tx.to.slice(0, 10)}...${tx.to.slice(-10)}` : tx.to}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-muted"
                                onClick={() => copyToClipboard(tx.to, "Address")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Value</span>
                            <div className="text-sm font-semibold">
                              {formatValue(tx.value)}
                            </div>
                          </div>
                        </div>

                        {/* Transaction Data */}
                        {tx.data && tx.data !== '0x' && (
                          <div className="space-y-2">
                            <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Transaction Data</span>
                            <div className="p-3 bg-muted/50 rounded-lg border">
                              <div className="flex items-center justify-between">
                                <span className="truncate max-w-[300px] font-mono text-xs" title={tx.data}>
                                  {tx.data.length > 66 ? `${tx.data.slice(0, 32)}...${tx.data.slice(-32)}` : tx.data}
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
                                            {tx.data}
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => copyToClipboard(tx.data, "Transaction data")}
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
                                    onClick={() => copyToClipboard(tx.data, "Transaction data")}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column - Safe Signatures Status */}
                      <div className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-lg border">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Safe Signatures</span>
                              <Badge 
                                variant={confirmationStatus.isComplete ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {confirmationStatus.confirmed}/{confirmationStatus.required}
                              </Badge>
                            </div>
                            
                            {/* Enhanced Progress Bar */}
                            <div className="space-y-2">
                              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                <div 
                                  className={`h-3 rounded-full transition-all duration-500 ${
                                    confirmationStatus.isComplete 
                                      ? 'bg-green-500' 
                                      : 'bg-primary'
                                  }`}
                                  style={{ 
                                    width: `${(confirmationStatus.confirmed / confirmationStatus.required) * 100}%` 
                                  }}
                                />
                              </div>
                              
                              <div className="text-xs text-muted-foreground">
                                {confirmationStatus.remaining > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {confirmationStatus.remaining} more signature{confirmationStatus.remaining !== 1 ? 's' : ''} needed
                                  </span>
                                ) : (
                                  <span className="text-green-600 flex items-center gap-1 font-medium">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Ready to execute
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Transaction Status Summary */}
                        <div className="p-3 bg-card rounded-lg border">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Operation</span>
                              <div className="flex items-center gap-1">
                                {(() => {
                                  const methodInfo = decodeSafeMethodEnhanced(tx.data || '0x');
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Badge 
                                        variant={methodInfo.isSafeMethod ? "default" : "outline"} 
                                        className="text-xs"
                                      >
                                        {formatOperation(tx.operation, tx.data)}
                                      </Badge>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Status</span>
                              <span className={`font-medium ${
                                confirmationStatus.isComplete ? 'text-green-600' : 'text-amber-600'
                              }`}>
                                {confirmationStatus.isComplete ? 'Ready' : 'Pending'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Nonce</span>
                              <span className="font-mono">{tx.nonce}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Gas Price</span>
                              <span className="font-mono">{formatEther(tx.gasPrice)} ETH</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Guardian Protocol Actions Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">Guardian Protocol Actions</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Two-column layout for Guardian options */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Temporal Workflow (Request/Approve with time delay) */}
                        <div className="space-y-3 p-4 border rounded-lg bg-card">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Timer className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Temporal Workflow</span>
                              <Badge variant="secondary" className="text-xs">Time-lock</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Request with time-lock security. Includes waiting period for enhanced security.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleGuardianRequest(tx)}
                              disabled={loadingStates.request || !contractAddress}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {loadingStates.request ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Shield className="h-4 w-4 mr-2" />
                              )}
                              Request Transaction
                            </Button>
                          </div>
                        </div>

                        {/* Meta Transaction (Direct signing for immediate broadcast) */}
                        <div className="space-y-3 p-4 border rounded-lg bg-card">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium">Meta Transaction</span>
                              <Badge variant="secondary" className="text-xs">Immediate</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sign and broadcast immediately. No waiting period for faster execution.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleGuardianMetaTxSign(tx, 'request')}
                              disabled={loadingStates.metaTx || !contractAddress || isMetaTxSigned(tx, 'request')}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              {loadingStates.metaTx ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : isMetaTxSigned(tx, 'request') ? (
                                <CheckCircle2 className="h-4 w-4 mr-2 text-white" />
                              ) : (
                                <Radio className="h-4 w-4 mr-2" />
                              )}
                              {isMetaTxSigned(tx, 'request') ? 'Signed' : 'Sign Meta-Tx'}
                            </Button>
                            
                            {isMetaTxSigned(tx, 'request') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleGuardianMetaTxBroadcast(tx, 'request')}
                                disabled={loadingStates.metaTx}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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
                        </div>
                      </div>
                      
                      {/* Additional info */}
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          <strong>Choose your approach:</strong> Use Temporal Workflow for enhanced security with time-lock, 
                          or Meta Transaction for immediate execution. You can use both approaches independently.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Safe UI Signing Section */}
                  {canSignTx && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground">Safe UI Signing</h4>
                      </div>
                      
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          You can sign this transaction. Go to the Safe UI to complete the signing process.
                        </AlertDescription>
                      </Alert>
                      
                      <Button 
                        className="w-full"
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
