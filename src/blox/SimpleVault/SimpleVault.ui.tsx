"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, Config, createConfig } from "wagmi";
import { Address, formatEther, parseEther, formatUnits, parseUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import SimpleVault, { VaultTxRecord } from "./SimpleVault";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom, Provider as JotaiProvider } from "jotai";
import { AlertCircle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { TxStatus } from "../../../contracts/core/iCore";
import { useNavigate } from "react-router-dom";
import { ContractInfo } from "@/lib/verification/index";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mainnet } from "viem/chains";
import { http } from "viem";
import { injected } from "wagmi/connectors";

// State atoms following .cursorrules state management guidelines
const pendingTxsAtom = atom<VaultTxRecord[]>([]);
const vaultInstanceAtom = atom<SimpleVault | null>(null);

interface LoadingState {
  ethBalance: boolean;
  tokenBalance: boolean;
  withdrawal: boolean;
  approval: boolean;
  cancellation: boolean;
  initialization: boolean;
}

const loadingStateAtom = atom<LoadingState>({
  ethBalance: false,
  tokenBalance: false,
  withdrawal: false,
  approval: false,
  cancellation: false,
  initialization: true,
});

interface WithdrawalFormProps {
  onSubmit: (to: Address, amount: bigint, token?: Address) => Promise<void>;
  isLoading: boolean;
  type: "ETH" | "TOKEN";
  tokenAddress?: Address;
  maxAmount: bigint;
}

const WithdrawalForm = ({ onSubmit, isLoading, type, tokenAddress, maxAmount }: WithdrawalFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      const parsedAmount = type === "ETH" ? parseEther(amount) : parseUnits(amount, 18);
      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds balance");
      }
      await onSubmit(to as Address, parsedAmount, tokenAddress);
      setTo("");
      setAmount("");
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="to">Recipient Address</Label>
        <Input
          id="to"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          pattern="^0x[a-fA-F0-9]{40}$"
          aria-label="Recipient address input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Amount ({type})</Label>
        <Input
          id="amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          aria-label={`${type} amount input`}
        />
        <p className="text-sm text-muted-foreground">
          Available: {type === "ETH" ? formatEther(maxAmount) : formatUnits(maxAmount, 18)} {type}
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Processing..." : `Request ${type} Withdrawal`}
      </Button>
    </form>
  );
};

interface PendingTransactionProps {
  tx: VaultTxRecord;
  onApprove: (txId: number) => Promise<void>;
  onCancel: (txId: number) => Promise<void>;
  isLoading: boolean;
}

const PendingTransaction = ({ tx, onApprove, onCancel, isLoading }: PendingTransactionProps) => {
  const now = Math.floor(Date.now() / 1000);
  const isReady = now >= tx.releaseTime;
  const progress = Math.min(((now - (tx.releaseTime - 24 * 3600)) / (24 * 3600)) * 100, 100);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Transaction #{tx.txId}</p>
              <p className="text-sm text-muted-foreground">
                {tx.type === "ETH" ? formatEther(tx.amount) : formatUnits(tx.amount, 18)} {tx.type}
              </p>
              <p className="text-sm text-muted-foreground">
                To: {tx.to}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {tx.status === TxStatus.PENDING && <Clock className="h-5 w-5 text-yellow-500" />}
              {tx.status === TxStatus.CANCELLED && <XCircle className="h-5 w-5 text-red-500" />}
              {tx.status === TxStatus.COMPLETED && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Time Lock Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={() => onApprove(tx.txId)}
              disabled={!isReady || isLoading || tx.status !== TxStatus.COMPLETED}
              className="flex-1"
            >
              {isLoading ? "Processing..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => onCancel(tx.txId)}
              disabled={isLoading || tx.status !== TxStatus.PENDING}
              className="flex-1"
            >
              {isLoading ? "Processing..." : "Cancel"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface SimpleVaultUIProps {
  contractAddress: Address;
  contractInfo: ContractInfo;
  onError?: (error: Error) => void;
  _mock?: {
    account: { address: Address; isConnected: boolean };
    publicClient: any;
    walletClient: { data: any };
    chain: any;
    initialData?: {
      ethBalance: bigint;
      pendingTransactions: any[];
    };
  };
  dashboardMode?: boolean;
}

function SimpleVaultUIContent({ 
  contractAddress, 
  contractInfo, 
  onError,
  _mock, 
  dashboardMode = false 
}: SimpleVaultUIProps) {
  const { address, isConnected } = _mock?.account || useAccount();
  const publicClient = _mock?.publicClient || usePublicClient();
  const { data: walletClient } = _mock?.walletClient || useWalletClient();
  const chain = _mock?.chain || useChain();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [ethBalance, setEthBalance] = useState<bigint>(_mock?.initialData?.ethBalance || BigInt(0));
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [vault, setVault] = useAtom(vaultInstanceAtom);
  const [error, setError] = useState<string | null>(null);

  // Initialize vault instance
  useEffect(() => {
    const initializeVault = async () => {
      if (!publicClient || !chain) return;
      
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        const vaultInstance = new SimpleVault(publicClient, walletClient, contractAddress, chain);
        setVault(vaultInstance);
        setError(null);
      } catch (err: any) {
        console.error("Failed to initialize vault:", err);
        setError("Failed to initialize vault contract");
        onError?.(new Error("Failed to initialize vault contract"));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initializeVault();
  }, [publicClient, walletClient, contractAddress, chain, setVault, onError]);

  // Initialize with mock data if available
  useEffect(() => {
    if (_mock?.initialData) {
      setEthBalance(_mock.initialData.ethBalance);
      setPendingTxs(_mock.initialData.pendingTransactions);
    }
  }, [_mock?.initialData, setPendingTxs]);

  // Fetch balances and pending transactions
  const fetchVaultData = React.useCallback(async () => {
    if (!vault || _mock) return;
    
    try {
      setLoadingState(prev => ({ ...prev, ethBalance: true }));
      
      const [balance, transactions] = await Promise.all([
        vault.getEthBalance(),
        vault.getPendingTransactions()
      ]);
      
      setEthBalance(balance);
      setPendingTxs(transactions);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch vault data:", err);
      setError("Failed to fetch vault data");
      onError?.(new Error("Failed to fetch vault data"));
    } finally {
      setLoadingState(prev => ({ ...prev, ethBalance: false }));
    }
  }, [vault, setLoadingState, setEthBalance, setPendingTxs, _mock, onError]);

  useEffect(() => {
    if (!_mock && vault) {
      fetchVaultData();
    }
  }, [fetchVaultData, vault, _mock]);

  const handleEthWithdrawal = async (to: Address, amount: bigint) => {
    if (!address || !vault) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      const tx = await vault.withdrawEthRequest(to, amount, { from: address });
      toast({
        title: "Withdrawal Requested",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
      toast({
        title: "Transaction Confirmed",
        description: "Your withdrawal request has been confirmed.",
      });
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: false }));
    }
  };

  const handleApproveWithdrawal = async (txId: number) => {
    if (!address || !vault) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, approval: true }));
    try {
      const tx = await vault.approveWithdrawalAfterDelay(txId, { from: address });
      toast({
        title: "Approval Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, approval: false }));
    }
  };

  const handleCancelWithdrawal = async (txId: number) => {
    if (!address || !vault) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: true }));
    try {
      const tx = await vault.cancelWithdrawal(txId, { from: address });
      toast({
        title: "Cancellation Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: false }));
    }
  };

  // Connection state check
  if (!isConnected && !_mock) {
    return (
      <div className="h-full flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Connected</AlertTitle>
          <AlertDescription>
            Please connect your wallet to interact with the vault.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (loadingState.initialization) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Initializing vault...</p>
        </div>
      </div>
    );
  }

  // Error state with refresh button
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          onClick={() => {
            setLoadingState(prev => ({ ...prev, initialization: true }));
            fetchVaultData();
          }}
          disabled={loadingState.initialization}
        >
          {loadingState.initialization ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            'Retry Connection'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className={dashboardMode ? "p-0" : "container mx-auto p-4"}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Simple Vault</CardTitle>
              <CardDescription>Secure storage for ETH and tokens with time-locked withdrawals</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVaultData}
              disabled={loadingState.ethBalance}
            >
              {loadingState.ethBalance ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Balance Display */}
              <Card>
                <CardHeader>
                  <CardTitle>Vault Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingState.ethBalance ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {formatEther(ethBalance)} ETH
                    </div>
                  )}
                </CardContent>
              </Card>

              {!dashboardMode ? (
                <Tabs defaultValue="withdraw" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="withdraw">New Withdrawal</TabsTrigger>
                    <TabsTrigger value="pending">Pending Transactions</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="withdraw">
                    <Card>
                      <CardHeader>
                        <CardTitle>Request Withdrawal</CardTitle>
                        <CardDescription>
                          Withdrawals are subject to a time-lock period for security
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <WithdrawalForm
                          onSubmit={handleEthWithdrawal}
                          isLoading={loadingState.withdrawal}
                          type="ETH"
                          maxAmount={ethBalance}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="pending">
                    <Card>
                      <CardHeader>
                        <CardTitle>Pending Withdrawals</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {pendingTxs.length === 0 ? (
                            <Card className="bg-muted">
                              <CardContent className="pt-6">
                                <h3 className="font-semibold">No Pending Transactions</h3>
                                <p className="text-sm text-muted-foreground">
                                  There are currently no pending withdrawal requests
                                </p>
                              </CardContent>
                            </Card>
                          ) : (
                            pendingTxs.map((tx) => (
                              <PendingTransaction
                                key={tx.txId}
                                tx={tx}
                                onApprove={handleApproveWithdrawal}
                                onCancel={handleCancelWithdrawal}
                                isLoading={loadingState.approval || loadingState.cancellation}
                              />
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                /* Dashboard mode: Show simplified view */
                pendingTxs.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Pending Transactions</h3>
                    <div className="space-y-2">
                      {pendingTxs.slice(0, 2).map((tx) => (
                        <PendingTransaction
                          key={tx.txId}
                          tx={tx}
                          onApprove={handleApproveWithdrawal}
                          onCancel={handleCancelWithdrawal}
                          isLoading={loadingState.approval || loadingState.cancellation}
                        />
                      ))}
                      {pendingTxs.length > 2 && (
                        <Button
                          variant="link"
                          className="w-full"
                          onClick={() => navigate(`/contracts/${contractAddress}`)}
                        >
                          View All Transactions
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

// Main export with proper providers
export default function SimpleVaultUI(props: SimpleVaultUIProps) {
  // If using mock data, render without providers
  if (props._mock) {
    return <SimpleVaultUIContent {...props} />;
  }

  // Create a properly configured Wagmi config
  const config = createConfig({
    chains: [mainnet],
    connectors: [injected()],
    transports: {
      [mainnet.id]: http()
    }
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <SimpleVaultUIContent {...props} />
        </JotaiProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
