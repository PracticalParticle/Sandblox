"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
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
import { TxStatus, IERC20 } from "../../contracts-core/iCore";
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
import { getContract } from 'viem';
import { erc20Abi } from "viem";

// State atoms following .cursorrules state management guidelines
const pendingTxsAtom = atom<VaultTxRecord[]>([]);
const vaultInstanceAtom = atom<SimpleVault | null>(null);

// Add local storage persistence for tokens
const STORAGE_KEY = 'simpleVault.trackedTokens';

const getStoredTokens = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const parsedData = JSON.parse(stored);
    // Convert stored string balances back to BigInt
    return Object.entries(parsedData).reduce((acc, [address, token]: [string, any]) => {
      acc[address] = {
        ...token,
        balance: token.balance ? BigInt(token.balance) : BigInt(0),
        loading: false
      };
      return acc;
    }, {} as TokenBalanceState);
  } catch (error) {
    console.error('Failed to load tokens from storage:', error);
    return {};
  }
};

const tokenBalanceAtom = atom<TokenBalanceState>(getStoredTokens());

// Add near the top with other atoms
const walletBalancesAtom = atom<{
  eth: bigint;
  tokens: Record<string, bigint>;
}>({
  eth: BigInt(0),
  tokens: {}
});

interface LoadingState {
  ethBalance: boolean;
  tokenBalance: boolean;
  withdrawal: boolean;
  deposit: boolean;
  approval: boolean;
  cancellation: boolean;
  initialization: boolean;
}

const loadingStateAtom = atom<LoadingState>({
  ethBalance: false,
  tokenBalance: false,
  withdrawal: false,
  deposit: false,
  approval: false,
  cancellation: false,
  initialization: true,
});

interface WithdrawalFormProps {
  onSubmit: (to: Address, amount: bigint, token?: Address) => Promise<void>;
  isLoading: boolean;
  maxAmount: bigint;
  onTokenSelect?: (token: Address | undefined) => void;
  selectedTokenAddress: string;
  onSelectedTokenAddressChange: (value: string) => void;
}

// Utility function to validate Ethereum addresses
const isValidAddress = (address: string): address is Address => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const WithdrawalForm = ({ 
  onSubmit, 
  isLoading, 
  maxAmount, 
  selectedTokenAddress,
  onSelectedTokenAddressChange,
  onTokenSelect 
}: WithdrawalFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [tokenBalances] = useAtom(tokenBalanceAtom);

  const selectedToken = selectedTokenAddress === "ETH" ? undefined : tokenBalances[selectedTokenAddress];
  const tokenDecimals = selectedToken?.metadata?.decimals ?? 18;

  // Format the max amount based on token type
  const formattedMaxAmount = selectedTokenAddress === "ETH"
    ? formatEther(maxAmount)
    : formatUnits(maxAmount, tokenDecimals);

  useEffect(() => {
    console.log('Token selection changed:', selectedTokenAddress);
    onTokenSelect?.(selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address);
  }, [selectedTokenAddress, onTokenSelect]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      console.log('Submitting withdrawal:', { 
        to, 
        amount, 
        selectedTokenAddress,
        tokenDecimals 
      });

      const parsedAmount = selectedTokenAddress === "ETH" 
        ? parseEther(amount) 
        : parseUnits(amount, tokenDecimals);

      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds vault balance");
      }

      // Validate the recipient address
      if (!isValidAddress(to)) {
        throw new Error("Invalid recipient address");
      }

      await onSubmit(
        to as Address, 
        parsedAmount, 
        selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address
      );
      setTo("");
      setAmount("");
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tokenSelect">Select Token</Label>
        <div id="tokenSelectWrapper">
          <Select
            value={selectedTokenAddress}
            onValueChange={onSelectedTokenAddressChange}
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
                    {formatEther(maxAmount)} available
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
                        `${formatUnits(token.balance || BigInt(0), token.metadata?.decimals || 18)} available`
                      )}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="to">Recipient Address</Label>
        <Input
          id="to"
          name="recipientAddress"
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
          name="amount"
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
          <div>Available in vault: {
            selectedTokenAddress === "ETH"
              ? `${Number(formattedMaxAmount).toFixed(4)} ETH`
              : `${Number(formattedMaxAmount).toFixed(4)} ${selectedToken?.metadata?.symbol || "Tokens"}`
          }</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => setAmount(formattedMaxAmount)}
          >
            Max
          </Button>
        </div>
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

const DepositForm = React.memo(({ onSubmit, isLoading }: DepositFormProps) => {
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("ETH");
  const [tokenBalances] = useAtom(tokenBalanceAtom);
  const [walletBalances] = useAtom(walletBalancesAtom);

  const selectedToken = selectedTokenAddress === "ETH" ? undefined : tokenBalances[selectedTokenAddress];
  const tokenDecimals = selectedToken?.metadata?.decimals ?? 18;

  // Get the maximum amount from wallet balance
  const maxAmount = selectedTokenAddress === "ETH"
    ? walletBalances.eth
    : walletBalances.tokens[selectedTokenAddress] || BigInt(0);

  // Format the max amount based on token type
  const formattedMaxAmount = selectedTokenAddress === "ETH"
    ? formatEther(maxAmount)
    : formatUnits(maxAmount, tokenDecimals);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      console.log('Submitting deposit:', { 
        amount, 
        selectedTokenAddress,
        tokenDecimals 
      });

      const parsedAmount = selectedTokenAddress === "ETH" 
        ? parseEther(amount) 
        : parseUnits(amount, tokenDecimals);

      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds wallet balance");
      }

      await onSubmit(
        parsedAmount,
        selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address
      );
      setAmount("");
      setSelectedTokenAddress("ETH");
    } catch (error: any) {
      console.error('Form submission error:', error);
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
                  {formatEther(walletBalances.eth)} available
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
          name="amount"
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
          <div>Available in wallet: {
            selectedTokenAddress === "ETH"
              ? `${Number(formattedMaxAmount).toFixed(4)} ETH`
              : `${Number(formattedMaxAmount).toFixed(4)} ${selectedToken?.metadata?.symbol || "Tokens"}`
          }</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => setAmount(formattedMaxAmount)}
          >
            Max
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Processing..." : `Deposit ${
          selectedTokenAddress === "ETH" ? "ETH" : selectedToken?.metadata?.symbol || "Token"
        }`}
      </Button>
    </form>
  );
});

DepositForm.displayName = 'DepositForm';

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

// Move WithdrawalFormWrapper outside of SimpleVaultUIContent
const WithdrawalFormWrapper = React.memo(({ 
  handleWithdrawal, 
  loadingState, 
  ethBalance, 
  fetchTokenBalance,
  tokenBalances
}: { 
  handleWithdrawal: (to: Address, amount: bigint, token?: Address) => Promise<void>;
  loadingState: LoadingState;
  ethBalance: bigint;
  fetchTokenBalance: (tokenAddress: Address) => Promise<void>;
  tokenBalances: TokenBalanceState;
}) => {
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("ETH");
  const lastFetchRef = useRef<string | undefined>(undefined);

  console.log('WithdrawalFormWrapper render:', {
    selectedTokenAddress,
    tokenBalancesKeys: Object.keys(tokenBalances),
    tokenBalancesState: tokenBalances,
    lastFetch: lastFetchRef.current
  });

  // Only fetch token balance if it's a new token and not already loading
  useEffect(() => {
    const tokenAddress = selectedTokenAddress === "ETH" ? undefined : selectedTokenAddress as Address;
    if (tokenAddress && 
        tokenAddress !== lastFetchRef.current && 
        !loadingState.tokenBalance && 
        !tokenBalances[tokenAddress]?.loading) {
      console.log('Fetching balance for selected token:', tokenAddress);
      lastFetchRef.current = tokenAddress;
      fetchTokenBalance(tokenAddress);
    }
  }, [selectedTokenAddress, loadingState.tokenBalance, tokenBalances, fetchTokenBalance]);

  const currentBalance = React.useMemo(() => 
    selectedTokenAddress === "ETH"
      ? ethBalance
      : (tokenBalances[selectedTokenAddress]?.balance || BigInt(0)),
    [selectedTokenAddress, tokenBalances, ethBalance]
  );

  const handleTokenSelect = React.useCallback((token: Address | undefined) => {
    console.log('Token selected in wrapper:', token);
  }, []);

  const handleSelectedTokenChange = (value: string) => {
    console.log('Token selection changing to:', value);
    setSelectedTokenAddress(value);
  };

  return (
    <WithdrawalForm
      onSubmit={handleWithdrawal}
      isLoading={loadingState.withdrawal}
      maxAmount={currentBalance}
      selectedTokenAddress={selectedTokenAddress}
      onSelectedTokenAddressChange={handleSelectedTokenChange}
      onTokenSelect={handleTokenSelect}
    />
  );
});

WithdrawalFormWrapper.displayName = 'WithdrawalFormWrapper';

function SimpleVaultUIContent({ 
  contractAddress, 
  contractInfo, 
  onError,
  _mock, 
  dashboardMode = false,
  renderSidebar = false,
  addMessage
}: SimpleVaultUIProps): JSX.Element {
  const { address } = useAccount();
  const publicClient = usePublicClient();
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
  const [tokenBalances, setTokenBalances] = useAtom<TokenBalanceState>(tokenBalanceAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [vault, setVault] = useAtom(vaultInstanceAtom);
  const [error, setError] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);

  // Initialize vault instance and fetch data once
  useEffect(() => {
    const initializeVault = async () => {
      console.log('Initializing vault with params:', { publicClient, chain, contractAddress });
      if (!publicClient || !chain) {
        console.log('Missing required dependencies:', { publicClient: !!publicClient, chain: !!chain });
        return;
      }
      
      // Skip if already initialized
      if (vault) {
        console.log('Vault already initialized, skipping');
        return;
      }
      
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        const vaultInstance = new SimpleVault(publicClient, walletClient, contractAddress, chain);
        console.log('Vault instance created successfully');
        setVault(vaultInstance);
        setError(null);

        // Fetch data once after successful initialization
        if (!_mock) {
          try {
            console.log('Fetching initial vault data...');
            const [balance, transactions] = await Promise.all([
              vaultInstance.getEthBalance(),
              vaultInstance.getPendingTransactions()
            ]);
            
            console.log('Initial vault data:', { balance: balance.toString(), transactions });
            setEthBalance(balance);
            setPendingTxs(transactions);
          } catch (err: any) {
            console.error("Failed to fetch initial vault data:", err);
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
  }, [publicClient, walletClient, contractAddress, chain]); // Remove dependencies that cause loops

  // Memoize fetchTokenBalance to prevent recreation
  const fetchTokenBalance = React.useCallback(async (tokenAddress: Address) => {
    if (!vault) {
      console.log('No vault instance available for fetching token balance');
      return;
    }
    
    // Skip if already loading this token
    if (tokenBalances[tokenAddress]?.loading) {
      console.log('Token balance already loading, skipping:', tokenAddress);
      return;
    }

    try {
      setLoadingState((prev: LoadingState) => ({ ...prev, tokenBalance: true }));
      setTokenBalances((prev: TokenBalanceState) => ({
        ...prev,
        [tokenAddress]: { 
          ...prev[tokenAddress],
          loading: true 
        }
      }));

      // Get fresh balance and metadata
      const [balance, metadata] = await Promise.all([
        vault.getTokenBalance(tokenAddress),
        // Only fetch metadata if we don't have it already
        !tokenBalances[tokenAddress]?.metadata ? 
          vault.getTokenMetadata(tokenAddress) : 
          Promise.resolve(tokenBalances[tokenAddress].metadata)
      ]);

      setTokenBalances((prev: TokenBalanceState) => ({
        ...prev,
        [tokenAddress]: {
          ...prev[tokenAddress],
          balance,
          metadata: metadata || prev[tokenAddress]?.metadata,
          loading: false,
          error: undefined
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
  }, [vault, tokenBalances]);

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

  const handleWithdrawal = async (to: Address, amount: bigint, token?: Address) => {
    if (!address || !vault) {
      handleNotification({
        type: 'error',
        title: "Error",
        description: "Wallet not connected or vault not initialized"
      });
      return;
    }

    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }

    console.log('Handling withdrawal:', { to, amount: amount.toString(), token });
    
    setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: true }));
    try {
      let tx;
      if (token) {
        // Token withdrawal
        const tokenBalance = tokenBalances[token]?.balance || BigInt(0);
        if (amount > tokenBalance) {
          throw new Error("Amount exceeds token balance in vault");
        }
        console.log('Initiating token withdrawal:', { token, to, amount: amount.toString() });
        tx = await vault.withdrawTokenRequest(token, to, amount, { from: address });
      } else {
        // ETH withdrawal
        if (amount > ethBalance) {
          throw new Error("Amount exceeds ETH balance in vault");
        }
        console.log('Initiating ETH withdrawal:', { to, amount: amount.toString() });
        tx = await vault.withdrawEthRequest(to, amount, { from: address });
      }

      handleNotification({
        type: 'info',
        title: "Withdrawal Requested",
        description: `Transaction hash: ${tx.hash}`
      });
      
      const receipt = await tx.wait();
      console.log('Withdrawal transaction receipt:', receipt);

      if (receipt.status === 'success') {
        handleNotification({
          type: 'success',
          title: "Withdrawal Request Confirmed",
          description: `Your ${token ? tokenBalances[token]?.metadata?.symbol || 'token' : 'ETH'} withdrawal request has been confirmed.`
        });

        // Refresh balances and transactions
        await fetchVaultData();
        if (token) {
          await fetchTokenBalance(token);
        }
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Withdrawal Error",
        description: error.message || "Failed to process withdrawal request"
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, withdrawal: false }));
    }
  };

  const handleDeposit = async (amount: bigint, token?: Address) => {
    if (!address || !vault) {
      handleNotification({
        type: 'error',
        title: "Error",
        description: "Wallet not connected or vault not initialized"
      });
      return;
    }

    if (!isCorrectChain) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `Please switch to ${contractInfo.chainName} to perform this operation.`
      });
      return;
    }
    
    setLoadingState((prev: LoadingState) => ({ ...prev, deposit: true }));
    try {
      console.log('Initiating deposit:', { token, amount: amount.toString() });
      
      let tx;
      if (token) {
        // First check if we need approval
        const allowance = await vault.getTokenAllowance(token, address);
        if (allowance < amount) {
          console.log('Approving token spend:', { token, amount: amount.toString() });
          const approveTx = await vault.approveTokenAllowance(token, amount, { from: address });
          await approveTx.wait();
        }

        // Now deposit the token
        console.log('Depositing token:', { token, amount: amount.toString() });
        tx = await vault.depositToken(token, amount, { from: address });
      } else {
        // ETH deposit
        console.log('Depositing ETH:', { amount: amount.toString() });
        tx = await vault.depositEth(amount, { from: address });
      }

      handleNotification({
        type: 'info',
        title: "Deposit Initiated",
        description: `Transaction submitted: ${tx.hash}`
      });
      
      const receipt = await tx.wait();
      
      if (receipt.status === 'success') {
        handleNotification({
          type: 'success',
          title: "Deposit Confirmed",
          description: `Your ${token ? tokenBalances[token]?.metadata?.symbol || 'token' : 'ETH'} deposit has been confirmed.`
        });

        // Refresh balances
        await fetchVaultData();
        if (token) {
          await fetchTokenBalance(token);
        }
        
        // Also refresh wallet balances
        await fetchWalletBalance(token);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      onError?.(error);
      handleNotification({
        type: 'error',
        title: "Deposit Error",
        description: error.message || "Failed to process deposit"
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, deposit: false }));
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

  // Add effect to persist tokens to local storage
  useEffect(() => {
    if (!tokenBalances) return;
    try {
      // Convert BigInt to string for storage
      const storageData = Object.entries(tokenBalances).reduce((acc, [address, token]) => {
        acc[address] = {
          ...token,
          balance: token.balance ? token.balance.toString() : "0",
          loading: false // Don't store loading state
        };
        return acc;
      }, {} as Record<string, any>);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    } catch (error) {
      console.error('Failed to save tokens to storage:', error);
    }
  }, [tokenBalances]);

  const handleRemoveToken = (tokenAddress: string) => {
    setTokenBalances((prev: TokenBalanceState) => {
      const newBalances = { ...prev };
      delete newBalances[tokenAddress];
      return newBalances;
    });
    handleNotification({
      type: 'success',
      title: "Token Removed",
      description: "The token has been removed from your tracking list"
    });
  };

  // Move fetchWalletBalance inside the component with proper scope
  const fetchWalletBalance = React.useCallback(async (tokenAddress?: Address) => {
    if (!address || !publicClient) return;
    
    try {
      if (!tokenAddress) {
        // Fetch ETH balance
        const ethBalance = await publicClient.getBalance({ 
          address: address 
        });
        setWalletBalances((prev: { eth: bigint; tokens: Record<string, bigint> }) => ({ 
          ...prev, 
          eth: ethBalance 
        }));
      } else {
        // Fetch token balance using contract read
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address]
        }) as bigint;

        setWalletBalances((prev: { eth: bigint; tokens: Record<string, bigint> }) => ({
          ...prev,
          tokens: {
            ...prev.tokens,
            [tokenAddress]: balance
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  }, [address, publicClient, setWalletBalances]);

  // Add effect to fetch wallet balances
  useEffect(() => {
    if (!address) return;
    
    // Fetch ETH balance
    fetchWalletBalance();
    
    // Fetch all token balances
    Object.entries(tokenBalances).forEach(([tokenAddress]) => {
      fetchWalletBalance(tokenAddress as Address);
    });
  }, [address, tokenBalances, fetchWalletBalance]);

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
                  <div className="text-sm text-muted-foreground">
                    {loadingState.ethBalance ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      formatEther(ethBalance)
                    )}
                  </div>
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
                      <div className="text-sm text-muted-foreground">
                        {token.loading ? (
                          <Skeleton className="h-4 w-20" />
                        ) : token.error ? (
                          <span className="text-destructive">Error loading balance</span>
                        ) : (
                          formatUnits(token.balance || BigInt(0), token.metadata?.decimals || 18)
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveToken(tokenAddress)}
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
                          isLoading={loadingState.deposit}
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
                        <WithdrawalFormWrapper
                          handleWithdrawal={handleWithdrawal}
                          loadingState={loadingState}
                          ethBalance={ethBalance}
                          fetchTokenBalance={fetchTokenBalance}
                          tokenBalances={tokenBalances}
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

  // Use the parent provider context directly
  return (
    <JotaiProvider>
      <SimpleVaultUIContent {...props} />
    </JotaiProvider>
  );
}
