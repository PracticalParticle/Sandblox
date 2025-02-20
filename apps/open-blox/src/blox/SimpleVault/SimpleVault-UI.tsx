"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Address, formatEther, parseEther, type PublicClient } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import SimpleVault from "./SimpleVault";
import { useChain } from "@/hooks/useChain";

interface WithdrawalFormProps {
  onSubmit: (to: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  type: "ETH" | "TOKEN";
  tokenAddress?: Address;
}

const WithdrawalForm = ({ onSubmit, isLoading, type, tokenAddress }: WithdrawalFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!to || !amount) return;
    
    try {
      await onSubmit(to as Address, parseEther(amount));
      setTo("");
      setAmount("");
    } catch (error) {
      console.error("Withdrawal request failed:", error);
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
          required
          pattern="^0x[a-fA-F0-9]{40}$"
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Processing..." : `Request ${type} Withdrawal`}
      </Button>
    </form>
  );
};

interface SimpleVaultUIProps {
  contractAddress: Address;
}

export default function SimpleVaultUI({ contractAddress }: SimpleVaultUIProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient();
  const { chain } = useChain();
  const { toast } = useToast();

  const [ethBalance, setEthBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTxs, setPendingTxs] = useState<Array<{ id: number; type: string; releaseTime: number }>>([]);

  const vault = new SimpleVault(publicClient, walletClient, contractAddress, chain);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const balance = await vault.getEthBalance();
        setEthBalance(balance);
      } catch (error) {
        console.error("Failed to fetch balances:", error);
      }
    };

    fetchBalances();
    // Set up polling for balance updates
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [contractAddress, vault]);

  const handleEthWithdrawal = async (to: Address, amount: bigint) => {
    if (!address) return;
    
    setIsLoading(true);
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveWithdrawal = async (txId: number) => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const tx = await vault.approveWithdrawalAfterDelay(txId, { from: address });
      toast({
        title: "Approval Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelWithdrawal = async (txId: number) => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const tx = await vault.cancelWithdrawal(txId, { from: address });
      toast({
        title: "Cancellation Submitted",
        description: `Transaction hash: ${tx.hash}`,
      });
      
      await tx.wait();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
                      isLoading={isLoading}
                      type="ETH"
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
                      <div className="space-y-4">
                        {pendingTxs.map((tx) => (
                          <Card key={tx.id}>
                            <CardContent className="pt-6">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium">Transaction #{tx.id}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Release Time: {new Date(tx.releaseTime * 1000).toLocaleString()}
                                  </p>
                                </div>
                                <div className="space-x-2">
                                  <Button
                                    onClick={() => handleApproveWithdrawal(tx.id)}
                                    disabled={isLoading}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleCancelWithdrawal(tx.id)}
                                    disabled={isLoading}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Balance Display */}
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vault Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {ethBalance ? `${formatEther(ethBalance)} ETH` : (
                      <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
