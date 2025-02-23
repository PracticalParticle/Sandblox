"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, useBalance } from "wagmi";
import { Address, formatEther, parseEther, formatUnits, parseUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import SimpleVault, { VaultTxRecord } from "./SimpleVault";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom, Provider as JotaiProvider } from "jotai";
import { AlertCircle, CheckCircle2, Clock, XCircle, Loader2, Wallet, Coins, X, Shield, Info } from "lucide-react";
import { TxStatus, IERC20 } from "../../../contracts/core/iCore";
import { useNavigate } from "react-router-dom";
import { ContractInfo } from "@/lib/verification/index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mainnet } from "viem/chains";
import { http } from "viem";
import { injected } from "wagmi/connectors";
import { TokenList } from "./components/TokenList";
import { AddTokenDialog } from "./components/AddTokenDialog";
import type { TokenMetadata, TokenState, TokenBalanceState } from "./components/TokenList";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const tokenBalanceAtom = atom<TokenBalanceState>({});

interface WithdrawalFormProps {
  onSubmit: (to: Address, amount: bigint, token?: Address) => Promise<void>;
  isLoading: boolean;
  maxAmount: bigint;
  onTokenSelect?: (token: Address | undefined) => void;
}

const WithdrawalForm = ({ onSubmit, isLoading, maxAmount, onTokenSelect }: WithdrawalFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("ETH");
  const [tokenBalances] = useAtom(tokenBalanceAtom);

  useEffect(() => {
    onTokenSelect?.(selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address);
  }, [selectedTokenAddress, onTokenSelect]);

  const selectedToken = selectedTokenAddress === "ETH" ? undefined : tokenBalances[selectedTokenAddress];
  const tokenDecimals = selectedToken?.metadata?.decimals ?? 18;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      const parsedAmount = selectedTokenAddress === "ETH" 
        ? parseEther(amount) 
        : parseUnits(amount, tokenDecimals);

      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds balance");
      }

      await onSubmit(
        to as Address, 
        parsedAmount, 
        selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address
      );
      setTo("");
      setAmount("");
      setSelectedTokenAddress("ETH");
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tokenSelect">Select Token</Label>
        <Select
          value={selectedTokenAddress}
          onValueChange={setSelectedTokenAddress}
        >
          <SelectTrigger>
            <SelectValue>
              <div className="flex items-center gap-2">
                {selectedTokenAddress === "ETH" ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-3 w-3 text-primary" />
                    </div>
                    <span>ETH</span>
                  </>
                ) : tokenBalances[selectedTokenAddress]?.metadata ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      {tokenBalances[selectedTokenAddress].metadata?.logo ? (
                        <img 
                          src={tokenBalances[selectedTokenAddress].metadata.logo} 
                          alt={tokenBalances[selectedTokenAddress].metadata.symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <Coins className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <span>{tokenBalances[selectedTokenAddress].metadata.symbol}</span>
                  </>
                ) : (
                  "Select a token"
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* ETH Option */}
            <SelectItem value="ETH">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-3 w-3 text-primary" />
                </div>
                <span>ETH</span>
                <span className="ml-auto text-muted-foreground">
                  {formatEther(maxAmount)}
                </span>
              </div>
            </SelectItem>
            
            {/* ERC20 Token Options */}
            {Object.entries(tokenBalances).map(([address, token]) => (
              <SelectItem key={address} value={address}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    {token.metadata?.logo ? (
                      <img 
                        src={token.metadata.logo} 
                        alt={token.metadata.symbol} 
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <Coins className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <span>{token.metadata?.symbol || 'Unknown Token'}</span>
                  <span className="ml-auto text-muted-foreground">
                    {token.loading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      formatUnits(token.balance || BigInt(0), token.metadata?.decimals || 18)
                    )}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <Label htmlFor="amount">
          Amount ({selectedTokenAddress === "ETH" ? "ETH" : selectedToken?.metadata?.symbol || "Tokens"})
        </Label>
        <Input
          id="amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          aria-label={`${selectedTokenAddress === "ETH" ? "ETH" : "Token"} amount input`}
        />
        <p className="text-sm text-muted-foreground">
          Available: {selectedTokenAddress === "ETH" 
            ? formatEther(maxAmount) 
            : formatUnits(maxAmount, tokenDecimals)
          } {selectedTokenAddress === "ETH" ? "ETH" : selectedToken?.metadata?.symbol || "Tokens"}
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
        {isLoading ? "Processing..." : `Request ${
          selectedTokenAddress === "ETH" ? "ETH" : selectedToken?.metadata?.symbol || "Token"
        } Withdrawal`}
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

interface DepositFormProps {
  onSubmit: (amount: bigint, token?: Address) => Promise<void>;
  isLoading: boolean;
}

const DepositForm = ({ onSubmit, isLoading }: DepositFormProps) => {
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("ETH");
  const [tokenBalances] = useAtom(tokenBalanceAtom);
  const [walletBalances, setWalletBalances] = useState<{
    tokens: Record<string, bigint>;
  }>({
    tokens: {}
  });
  const [approvalState, setApprovalState] = useState<{
    isApproved: boolean;
    isApproving: boolean;
    error?: string;
  }>({
    isApproved: false,
    isApproving: false
  });
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address: address,
  });
  const publicClient = usePublicClient();

  const selectedToken = selectedTokenAddress === "ETH" ? undefined : tokenBalances[selectedTokenAddress];
  const tokenDecimals = selectedToken?.metadata?.decimals ?? 18;

  // Reset approval state when token changes
  useEffect(() => {
    setApprovalState({
      isApproved: false,
      isApproving: false
    });
  }, [selectedTokenAddress]);

  // Fetch wallet balances for tokens
  useEffect(() => {
    const fetchWalletBalances = async () => {
      if (!address || !publicClient) return;

      try {
        // Get token balances for tracked tokens
        const tokenBalancePromises = Object.entries(tokenBalances).map(async ([tokenAddress]) => {
          try {
            const balance = await publicClient.readContract({
              address: tokenAddress as Address,
              abi: [
                {
                  inputs: [{ name: 'account', type: 'address' }],
                  name: 'balanceOf',
                  outputs: [{ type: 'uint256' }],
                  stateMutability: 'view',
                  type: 'function'
                }
              ],
              functionName: 'balanceOf',
              args: [address]
            }) as bigint;

            return [tokenAddress, balance];
          } catch (error) {
            console.error(`Error fetching balance for token ${tokenAddress}:`, error);
            return [tokenAddress, BigInt(0)];
          }
        });

        const tokenBalanceResults = await Promise.all(tokenBalancePromises);
        const newTokenBalances = Object.fromEntries(tokenBalanceResults);

        setWalletBalances(prev => ({
          ...prev,
          tokens: newTokenBalances
        }));
      } catch (error) {
        console.error('Error fetching wallet balances:', error);
      }
    };

    fetchWalletBalances();
  }, [address, publicClient, tokenBalances]);

  const checkAllowance = async (token: Address, amount: bigint, spender: Address) => {
    try {
      if (!address) throw new Error("No wallet connected");
      
      const allowance = await publicClient?.readContract({
        address: token,
        abi: [
          {
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            name: 'allowance',
            outputs: [{ type: 'uint256' }],
            stateMutability: 'view',
            type: 'function'
          }
        ],
        functionName: 'allowance',
        args: [address, spender]
      }) as bigint;

      return allowance >= amount;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  };

  const handleApprove = async (token: Address, amount: bigint, spender: Address) => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    setApprovalState(prev => ({ ...prev, isApproving: true, error: undefined }));
    try {
      const hash = await walletClient.writeContract({
        address: token,
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'approve',
            outputs: [{ type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function'
          }
        ],
        functionName: 'approve',
        args: [spender, amount]
      });

      if (!publicClient) throw new Error("No public client available");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        setApprovalState(prev => ({ ...prev, isApproved: true }));
      } else {
        throw new Error("Approval transaction failed");
      }
    } catch (error: any) {
      setApprovalState(prev => ({ 
        ...prev, 
        error: error.message || "Failed to approve token"
      }));
    } finally {
      setApprovalState(prev => ({ ...prev, isApproving: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      if (!isConnected) {
        throw new Error("Please connect your wallet first");
      }

      const parsedAmount = selectedTokenAddress === "ETH" 
        ? parseEther(amount) 
        : parseUnits(amount, tokenDecimals);

      // Check wallet balance
      const walletBalance = selectedTokenAddress === "ETH"
        ? (balanceData ? parseEther(balanceData.formatted) : BigInt(0))
        : walletBalances.tokens[selectedTokenAddress] || BigInt(0);

      if (parsedAmount > walletBalance) {
        throw new Error("Insufficient balance in wallet");
      }

      // For ERC20 tokens, check and handle approval
      if (selectedTokenAddress !== "ETH") {
        const isApproved = await checkAllowance(
          selectedTokenAddress as Address,
          parsedAmount,
          address as Address
        );

        if (!isApproved) {
          await handleApprove(
            selectedTokenAddress as Address,
            parsedAmount,
            address as Address
          );
          // Return early if approval failed
          if (!approvalState.isApproved) return;
        }
      }

      await onSubmit(
        parsedAmount,
        selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address
      );
      setAmount("");
      setApprovalState({ isApproved: false, isApproving: false });
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tokenSelect">Select Token</Label>
        <Select
          value={selectedTokenAddress}
          onValueChange={setSelectedTokenAddress}
        >
          <SelectTrigger>
            <SelectValue>
              <div className="flex items-center gap-2">
                {selectedTokenAddress === "ETH" ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-3 w-3 text-primary" />
                    </div>
                    <span>ETH</span>
                  </>
                ) : tokenBalances[selectedTokenAddress]?.metadata ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      {tokenBalances[selectedTokenAddress].metadata?.logo ? (
                        <img 
                          src={tokenBalances[selectedTokenAddress].metadata.logo} 
                          alt={tokenBalances[selectedTokenAddress].metadata.symbol} 
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <Coins className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <span>{tokenBalances[selectedTokenAddress].metadata.symbol}</span>
                  </>
                ) : (
                  "Select a token"
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* ETH Option */}
            <SelectItem value="ETH">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-3 w-3 text-primary" />
                </div>
                <span>ETH</span>
                <span className="ml-auto text-muted-foreground">
                  {isBalanceLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : balanceData ? (
                    `${Number(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
                  ) : (
                    'Connect wallet'
                  )}
                </span>
              </div>
            </SelectItem>
            
            {/* ERC20 Token Options */}
            {Object.entries(tokenBalances).map(([address, token]) => (
              <SelectItem key={address} value={address}>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    {token.metadata?.logo ? (
                      <img 
                        src={token.metadata.logo} 
                        alt={token.metadata.symbol} 
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <Coins className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <span>{token.metadata?.symbol || 'Unknown Token'}</span>
                  <span className="ml-auto text-muted-foreground">
                    {token.loading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      `${formatUnits(walletBalances.tokens[address] || BigInt(0), token.metadata?.decimals || 18)} available`
                    )}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">
          Amount ({selectedTokenAddress === "ETH" ? "ETH" : selectedToken?.metadata?.symbol || "Tokens"})
        </Label>
        <Input
          id="amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          aria-label={`${selectedTokenAddress === "ETH" ? "ETH" : "Token"} amount input`}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Available in wallet: {
            selectedTokenAddress === "ETH"
              ? isBalanceLoading ? (
                  <Skeleton className="h-4 w-16 inline-block" />
                ) : balanceData ? (
                  `${Number(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
                ) : (
                  'Connect wallet'
                )
              : `${formatUnits(walletBalances.tokens[selectedTokenAddress] || BigInt(0), tokenDecimals)} ${selectedToken?.metadata?.symbol || "Tokens"}`
          }</span>
        </div>
      </div>

      {!isConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wallet not connected</AlertTitle>
          <AlertDescription>Please connect your wallet to continue</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {approvalState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Approval Error</AlertTitle>
          <AlertDescription>{approvalState.error}</AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        disabled={isLoading || approvalState.isApproving || !amount || parseFloat(amount) <= 0 || !isConnected} 
        className="w-full"
      >
        {isLoading || approvalState.isApproving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {approvalState.isApproving ? "Approving..." : "Processing..."}
          </>
        ) : !isConnected ? (
          "Connect Wallet"
        ) : selectedTokenAddress === "ETH" ? (
          "Deposit ETH"
        ) : approvalState.isApproved ? (
          `Deposit ${selectedToken?.metadata?.symbol || "Token"}`
        ) : (
          `Approve ${selectedToken?.metadata?.symbol || "Token"}`
        )}
      </Button>
    </form>
  );
};

// Add this type definition at the top with other interfaces
type NotificationMessage = {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
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
  renderSidebar?: boolean;
  addMessage?: (message: NotificationMessage) => void;
}

function SimpleVaultUIContent({ 
  contractAddress, 
  contractInfo, 
  onError,
  _mock, 
  dashboardMode = false,
  renderSidebar = false,
  addMessage
}: SimpleVaultUIProps): JSX.Element {
  const { address, isConnected } = _mock?.account || useAccount();
  const publicClient = _mock?.publicClient || usePublicClient();
  const { data: walletClient } = _mock?.walletClient || useWalletClient();
  const chain = _mock?.chain || useChain();
  const navigate = useNavigate();
  
  const isCorrectChain = chain?.id === contractInfo.chainId;
  
  const handleNotification = React.useCallback((message: NotificationMessage): void => {
    if (addMessage) {
      addMessage(message);
    } else {
      console.log('Notification:', message); // Fallback for when addMessage is not provided
    }
  }, [addMessage]);

  useEffect(() => {
    if (!isCorrectChain && chain?.id) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `This vault was deployed on ${contractInfo.chainName}. Please switch networks.`
      });
    }
  }, [chain?.id, contractInfo.chainName, isCorrectChain, handleNotification]);

  const [ethBalance, setEthBalance] = useState<bigint>(_mock?.initialData?.ethBalance || BigInt(0));
  const [tokenBalances, setTokenBalances] = useAtom(tokenBalanceAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [vault, setVault] = useAtom(vaultInstanceAtom);
  const [error, setError] = useState<string | null>(null);

  // Initialize vault instance and fetch data once
  useEffect(() => {
    const initializeVault = async () => {
      if (!publicClient || !chain) return;
      
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        const vaultInstance = new SimpleVault(publicClient, walletClient, contractAddress, chain);
        setVault(vaultInstance);
        setError(null);

        // Fetch data once after successful initialization
        if (!_mock) {
          try {
            const [balance, transactions] = await Promise.all([
              vaultInstance.getEthBalance(),
              vaultInstance.getPendingTransactions()
            ]);
            
            setEthBalance(balance);
            setPendingTxs(transactions);
          } catch (err: any) {
            console.error("Failed to fetch initial vault data:", err);
            // Don't set error state for initial fetch failure
            // User can retry using the refresh button
          }
        }
      } catch (err: any) {
        console.error("Failed to initialize vault:", err);
        setError("Failed to initialize vault contract");
        onError?.(new Error("Failed to initialize vault contract"));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initializeVault();
  }, [publicClient, walletClient, contractAddress, chain, setVault, onError, _mock, setEthBalance, setPendingTxs]);

  // Initialize with mock data if available
  useEffect(() => {
    if (_mock?.initialData) {
      setEthBalance(_mock.initialData.ethBalance);
      setPendingTxs(_mock.initialData.pendingTransactions);
    }
  }, [_mock?.initialData, setPendingTxs]);

  // Fetch balances and pending transactions (now only called via refresh button)
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

  const fetchTokenBalance = React.useCallback(async (tokenAddress: Address) => {
    if (!vault || _mock) return;
    
    try {
      setLoadingState((prev: LoadingState) => ({ ...prev, tokenBalance: true }));
      setTokenBalances((prev: TokenBalanceState) => ({
        ...prev,
        [tokenAddress]: { ...prev[tokenAddress], loading: true }
      }));

      const [balance, metadata] = await Promise.all([
        vault.getTokenBalance(tokenAddress),
        vault.getTokenMetadata(tokenAddress)
      ]);

      setTokenBalances((prev: TokenBalanceState) => ({
        ...prev,
        [tokenAddress]: {
          balance,
          metadata,
          loading: false
        }
      }));
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch token data:", err);
      setTokenBalances((prev: TokenBalanceState) => ({
        ...prev,
        [tokenAddress]: {
          ...prev[tokenAddress],
          loading: false,
          error: err.message
        }
      }));
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, tokenBalance: false }));
    }
  }, [vault, setLoadingState, setTokenBalances, _mock]);

  const handleEthWithdrawal = async (to: Address, amount: bigint) => {
    if (!address || !vault) return;
    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      const tx = await vault.withdrawEthRequest(to, amount, { from: address });
      handleNotification({
        type: 'info',
        title: "Withdrawal Requested",
        description: `Transaction hash: ${tx.hash}`
      });
      
      await tx.wait();
      handleNotification({
        type: 'success',
        title: "Transaction Confirmed",
        description: "Your withdrawal request has been confirmed."
      });
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Error",
        description: error.message
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: false }));
    }
  };

  const handleTokenWithdrawal = async (to: Address, amount: bigint, token: Address) => {
    if (!address || !vault) return;
    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      const tx = await vault.withdrawTokenRequest(token, to, amount, { from: address });
      handleNotification({
        type: 'info',
        title: "Withdrawal Requested",
        description: `Transaction hash: ${tx.hash}`
      });
      
      await tx.wait();
      handleNotification({
        type: 'success',
        title: "Transaction Confirmed",
        description: "Your withdrawal request has been confirmed."
      });
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Error",
        description: error.message
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: false }));
    }
  };

  const handleWithdrawal = async (to: Address, amount: bigint, token?: Address) => {
    if (token) {
      await handleTokenWithdrawal(to, amount, token);
    } else {
      await handleEthWithdrawal(to, amount);
    }
  };

  const handleApproveWithdrawal = async (txId: number) => {
    if (!address || !vault) return;
    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, approval: true }));
    try {
      const tx = await vault.approveWithdrawalAfterDelay(txId, { from: address });
      handleNotification({
        type: 'info',
        title: "Approval Submitted",
        description: `Transaction hash: ${tx.hash}`
      });
      
      await tx.wait();
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Error",
        description: error.message
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, approval: false }));
    }
  };

  const handleCancelWithdrawal = async (txId: number) => {
    if (!address || !vault) return;
    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: true }));
    try {
      const tx = await vault.cancelWithdrawal(txId, { from: address });
      handleNotification({
        type: 'info',
        title: "Cancellation Submitted",
        description: `Transaction hash: ${tx.hash}`
      });
      
      await tx.wait();
      await fetchVaultData();
    } catch (error: any) {
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Error",
        description: error.message
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: false }));
    }
  };

  const handleDeposit = async (amount: bigint, token?: Address) => {
    if (!address || !vault) return;
    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      const tx = token 
        ? await vault.depositToken(token, amount, { from: address })
        : await vault.depositEth(amount, { from: address });

      handleNotification({
        type: 'info',
        title: "Deposit Initiated",
        description: `Transaction submitted: ${tx.hash}`
      });
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 'success') {
        handleNotification({
          type: 'success',
          title: "Deposit Confirmed",
          description: `Your ${token ? 'token' : 'ETH'} deposit has been confirmed.`
        });

        // Refresh vault data
        await fetchVaultData();
        
        // If it's a token deposit, refresh the specific token balance
        if (token) {
          await fetchTokenBalance(token);
        }
      } else {
        handleNotification({
          type: 'error',
          title: "Deposit Failed",
          description: "The transaction failed to complete."
        });
      }
    } catch (error: any) {
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Error",
        description: error.message
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: false }));
    }
  };

  const WithdrawalFormWrapper = () => {
    const [selectedToken, setSelectedToken] = useState<Address | undefined>(undefined);

    useEffect(() => {
      if (selectedToken) {
        fetchTokenBalance(selectedToken);
      }
    }, [selectedToken, fetchTokenBalance]);

    return (
      <WithdrawalForm
        onSubmit={handleWithdrawal}
        isLoading={loadingState.withdrawal}
        maxAmount={selectedToken ? (tokenBalances[selectedToken]?.balance || BigInt(0)) : ethBalance}
        onTokenSelect={setSelectedToken}
      />
    );
  };

  // Render sidebar content
  if (renderSidebar) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">NATIVE TOKEN</h3>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">ETH</p>
                  <p className="text-sm text-muted-foreground">
                    {loadingState.ethBalance ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      formatEther(ethBalance)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground">ERC20 TOKENS</h3>
            <AddTokenDialog
              onAddToken={async (address) => {
                await fetchTokenBalance(address);
                handleNotification({
                  type: 'success',
                  title: "Token Added",
                  description: "The token has been added to your tracking list"
                });
              }}
              isLoading={loadingState.tokenBalance}
            />
          </div>
          <div className="space-y-2">
            {Object.entries(tokenBalances).map(([tokenAddress, token]) => (
              <Card key={tokenAddress} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {token.metadata?.logo ? (
                      <img 
                        src={token.metadata.logo} 
                        alt={token.metadata.symbol} 
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Coins className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{token.metadata?.symbol || 'Unknown Token'}</p>
                      <p className="text-sm text-muted-foreground">
                        {token.loading ? (
                          <Skeleton className="h-4 w-20" />
                        ) : token.error ? (
                          <span className="text-destructive">Error loading balance</span>
                        ) : (
                          formatUnits(token.balance || BigInt(0), token.metadata?.decimals || 18)
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      // TODO: Implement token removal
                      handleNotification({
                        type: 'warning',
                        title: "Not Implemented",
                        description: "Token removal coming soon"
                      });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {Object.keys(tokenBalances).length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No tokens added yet</p>
              </div>
            )}
          </div>
        </div>
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
            // Only reinitialize the vault, don't fetch data
            const initializeVault = async () => {
              if (!publicClient || !chain) return;
              try {
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

  // Add network warning to the UI
  return (
    <div className="h-full overflow-auto">
      {!isCorrectChain && contractInfo.chainId && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            This vault was deployed on {contractInfo.chainName}. Please switch to the correct network to perform operations.
          </AlertDescription>
        </Alert>
      )}
      
      <div className={dashboardMode ? "p-0" : "container mx-auto p-4"}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Simple Vault</h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Secure storage for ETH and tokens with time-locked withdrawals</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVaultData}
              disabled={loadingState.ethBalance || !vault}
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
              {!dashboardMode ? (
                <Tabs defaultValue="deposit" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-background p-1 rounded-lg">
                    <TabsTrigger value="deposit" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">Deposit</TabsTrigger>
                    <TabsTrigger value="withdraw" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">Withdraw</TabsTrigger>
                    <TabsTrigger value="pending" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">Pending</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="deposit">
                    <Card>
                      <CardHeader>
                        <CardTitle>Deposit</CardTitle>
                        <CardDescription>
                          Deposit ETH or tokens into your vault
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DepositForm
                          onSubmit={handleDeposit}
                          isLoading={loadingState.withdrawal}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="withdraw">
                    <Card>
                      <CardHeader>
                        <CardTitle>Request Withdrawal</CardTitle>
                        <CardDescription>
                          Withdrawals are subject to a time-lock period for security
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <WithdrawalFormWrapper />
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

  // Use the parent provider context directly
  return (
    <JotaiProvider>
      <SimpleVaultUIContent {...props} />
    </JotaiProvider>
  );
}
