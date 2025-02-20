"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Address, formatEther, parseEther, formatUnits, parseUnits, type PublicClient } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import SimpleVault, { VaultTxRecord, TxStatus } from "./SimpleVault";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom } from "jotai";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/ui-utils";

// State atoms following .cursorrules state management guidelines
const pendingTxsAtom = atom<VaultTxRecord[]>([]);

interface LoadingState {
  ethBalance: boolean;
  tokenBalance: boolean;
  withdrawal: boolean;
  approval: boolean;
  cancellation: boolean;
}

const loadingStateAtom = atom<LoadingState>({
  ethBalance: false,
  tokenBalance: false,
  withdrawal: false,
  approval: false,
  cancellation: false,
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
              {tx.status === TxStatus.READY && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {tx.status === TxStatus.CANCELLED && <XCircle className="h-5 w-5 text-red-500" />}
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
              disabled={!isReady || isLoading || tx.status !== TxStatus.READY}
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
}

export default function SimpleVaultUI({ contractAddress, _mock }: SimpleVaultUIProps) {
  // Use mock data in preview mode, real data otherwise
  const { address, isConnected } = _mock?.account || useAccount();
  const publicClient = _mock?.publicClient || usePublicClient();
  const { data: walletClient } = _mock?.walletClient || useWalletClient();
  const chain = _mock?.chain || useChain();
  const { toast } = useToast();
  
  const [ethBalance, setEthBalance] = useState<bigint>(_mock?.initialData?.ethBalance || BigInt(0));
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);

  // Initialize with mock data if available
  useEffect(() => {
    if (_mock?.initialData) {
      setEthBalance(_mock.initialData.ethBalance);
      setPendingTxs(_mock.initialData.pendingTransactions);
    }
  }, [_mock?.initialData, setPendingTxs]);

  const vault = React.useMemo(() => new SimpleVault(publicClient, walletClient, contractAddress, chain), [
    publicClient,
    walletClient,
    contractAddress,
    chain
  ]);

  // Fetch balances and pending transactions only if not in preview mode
  const fetchVaultData = React.useCallback(async () => {
    if (_mock) return; // Skip fetching in preview mode
    
    try {
      setLoadingState((prev: LoadingState) => ({ ...prev, ethBalance: true }));
      const [balance, transactions] = await Promise.all([
        vault.getEthBalance(),
        vault.getPendingTransactions()
      ]);
      
      setEthBalance(balance);
      setPendingTxs(transactions);
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch vault data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, ethBalance: false }));
    }
  }, [vault, setLoadingState, setEthBalance, setPendingTxs, toast, _mock]);

  useEffect(() => {
    if (!_mock) { // Only set up polling if not in preview mode
      fetchVaultData();
      const interval = setInterval(fetchVaultData, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchVaultData, _mock]);

  const handleEthWithdrawal = async (to: Address, amount: bigint) => {
    if (!address) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      const tx = await vault.withdrawEthRequest(to, amount, { from: address });
      toast({
        title: "Withdrawal Requested",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      const receipt = await tx.wait();
      toast({
        title: "Transaction Confirmed",
        description: "Your withdrawal request has been confirmed.",
      });
      fetchVaultData();
    } catch (error: any) {
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
    if (!address) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, approval: true }));
    try {
      const tx = await vault.approveWithdrawalAfterDelay(txId, { from: address });
      toast({
        title: "Approval Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
      fetchVaultData();
    } catch (error: any) {
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
    if (!address) return;
    
    setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: true }));
    try {
      const tx = await vault.cancelWithdrawal(txId, { from: address });
      toast({
        title: "Cancellation Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
      fetchVaultData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: false }));
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Simple Vault</CardTitle>
          <CardDescription>Secure storage for ETH and tokens with time-locked withdrawals</CardDescription>
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

            {/* Withdrawal Interface */}
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
                        pendingTxs.map((tx: VaultTxRecord) => (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
