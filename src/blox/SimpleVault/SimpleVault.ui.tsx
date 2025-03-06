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
import SimpleVault from "./SimpleVault";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom, Provider as JotaiProvider, useSetAtom } from "jotai";
import { AlertCircle, CheckCircle2, Clock, XCircle, Loader2, Wallet, Coins, X, Shield, Info, Settings2 } from "lucide-react";
import { TxStatus, ExecutionType } from "../../particle-core/sdk/typescript/types/lib.index";
import { useNavigate } from "react-router-dom";
import { ContractInfo as BaseContractInfo } from "@/lib/verification/index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mainnet } from "viem/chains";
import { http } from "viem";
import { injected } from "wagmi/connectors";
import { TokenList, AddTokenDialog } from "./components";
import { PendingTransaction } from "./components/PendingTransaction";
import type { TokenMetadata, TokenState, TokenBalanceState } from "./components";
import type { VaultTxRecord } from "./components/PendingTransaction";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getContract } from 'viem';
import { erc20Abi } from "viem";
import { DeploymentForm } from './components/DeploymentForm'
import { useContractDeployment } from '@/lib/deployment'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createWalletClient } from "viem";
import { Hex, Chain } from "viem";
import { MetaTransaction } from '../../particle-core/sdk/typescript/interfaces/lib.index';
import { PublicClient, WalletClient } from 'viem';
import SimpleVaultABIJson from './SimpleVault.abi.json';
import SecureOwnable from '../../particle-core/sdk/typescript/SecureOwnable';
import { TxRecord, MetaTxParams, ReadableOperationType } from '../../particle-core/sdk/typescript/interfaces/lib.index';
import { TransactionOptions, TransactionResult } from '../../particle-core/sdk/typescript/interfaces/base.index';
import { ContractValidations } from '../../particle-core/sdk/typescript/utils/validations';
import { VaultMetaTxParams } from './SimpleVault';
import { TransactionManagerProvider } from "@/contexts/TransactionManager";

// Extend the base ContractInfo interface to include broadcaster and other properties
interface ContractInfo extends BaseContractInfo {
  owner: string;
  broadcaster: string;
  recoveryAddress: string;
  timeLockPeriod: number;
}

// Helper function to format addresses
const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

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
  approval: Record<number, boolean>;  // Map of txId to loading state
  cancellation: Record<number, boolean>;  // Map of txId to loading state
  initialization: boolean;
  transactions: boolean;
}

const loadingStateAtom = atom<LoadingState>({
  ethBalance: false,
  tokenBalance: false,
  withdrawal: false,
  deposit: false,
  approval: {},
  cancellation: {},
  initialization: true,
  transactions: false,
});

// Add a background fetching atom to track background processes
const backgroundFetchingAtom = atom<{
  transactions: boolean;
}>({
  transactions: false,
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
  contractAddress: Address;
}

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
  contractAddress?: Address;  // Make contractAddress optional
  contractInfo?: ContractInfo;  // Make contractInfo optional
  onError?: (error: Error) => void;
  onDeployed?: (address: Address) => void;  // Add callback for deployment success
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

// Create atoms for contract info and notifications
const contractInfoAtom = atom<ContractInfo | null>(null);
const addMessageAtom = atom<((message: NotificationMessage) => void) | null>(null);

// Add storage key for meta tx settings
const META_TX_SETTINGS_KEY = 'simpleVault.metaTxSettings';

// Default values for meta tx settings
const DEFAULT_META_TX_SETTINGS: VaultMetaTxParams = {
  deadline: BigInt(3600), // 1 hour in seconds
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

// Initialize settings from local storage
export const getStoredMetaTxSettings = (): VaultMetaTxParams => {
  try {
    const stored = localStorage.getItem(META_TX_SETTINGS_KEY);
    if (!stored) return DEFAULT_META_TX_SETTINGS;
    const parsed = JSON.parse(stored);
    return {
      deadline: BigInt(parsed.deadline),
      maxGasPrice: BigInt(parsed.maxGasPrice)
    };
  } catch (error) {
    console.error('Failed to load meta tx settings:', error);
    return DEFAULT_META_TX_SETTINGS;
  }
};

// Create VaultMetaTxParams from settings
export const createVaultMetaTxParams = (settings: VaultMetaTxParams): VaultMetaTxParams => {
  // Get current timestamp in seconds
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  
  // Convert deadline from seconds to actual timestamp by adding to current time
  const deadlineTimestamp = currentTimestamp + settings.deadline;
  
  return {
    deadline: deadlineTimestamp,
    maxGasPrice: settings.maxGasPrice
  };
};

// Update the settings atom to be writable with initial value from storage
const metaTxSettingsAtom = atom<VaultMetaTxParams>(getStoredMetaTxSettings());

// Add settings dialog component
function MetaTxSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [settings, setSettings] = useAtom(metaTxSettingsAtom);
  const [deadline, setDeadline] = useState(() => Number(settings.deadline / BigInt(3600)));
  const [maxGasPrice, setMaxGasPrice] = useState(() => Number(settings.maxGasPrice / BigInt(1000000000)));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDeadline(Number(settings.deadline / BigInt(3600)));
      setMaxGasPrice(Number(settings.maxGasPrice / BigInt(1000000000)));
    }
  }, [open, settings]);

  const handleSave = () => {
    // Convert hours to seconds and gwei to wei
    const newSettings: VaultMetaTxParams = {
      deadline: BigInt(deadline * 3600),
      maxGasPrice: BigInt(maxGasPrice * 1000000000)
    };

    // Update state
    setSettings(newSettings);
    
    // Save to local storage
    try {
      localStorage.setItem(META_TX_SETTINGS_KEY, JSON.stringify({
        deadline: deadline * 3600,
        maxGasPrice: maxGasPrice * 1000000000
      }));
    } catch (error) {
      console.error('Failed to save settings to local storage:', error);
    }

    // Close the dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Meta Transaction Settings</DialogTitle>
          <DialogDescription>
            Configure default parameters for meta-transactions
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="deadline" className="col-span-2">
              Deadline (hours)
            </Label>
            <Input
              id="deadline"
              type="number"
              value={deadline}
              onChange={(e) => setDeadline(Number(e.target.value))}
              min={1}
              max={24}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxGasPrice" className="col-span-2">
              Max Gas Price (gwei)
            </Label>
            <Input
              id="maxGasPrice"
              type="number"
              value={maxGasPrice}
              onChange={(e) => setMaxGasPrice(Number(e.target.value))}
              min={1}
              className="col-span-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Move WithdrawalFormWrapper outside of SimpleVaultUIContent
const WithdrawalFormWrapper = React.memo(({ 
  handleWithdrawal, 
  loadingState, 
  ethBalance, 
  fetchTokenBalance,
  tokenBalances,
  contractAddress
}: { 
  handleWithdrawal: (to: Address, amount: bigint, token?: Address) => Promise<void>;
  loadingState: LoadingState;
  ethBalance: bigint;
  fetchTokenBalance: (tokenAddress: Address) => Promise<void>;
  tokenBalances: TokenBalanceState;
  contractAddress: Address;
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

// Add a new atom for the active tab
const activeTabAtom = atom<'timelock' | 'metatx'>('timelock');

function SimpleVaultUIContent({ 
  contractAddress, 
  contractInfo, 
  onError,
  onDeployed,
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
  
  // Add null check for contractInfo
  const isCorrectChain = chain?.id === contractInfo?.chainId;
  
  const handleNotification = React.useCallback((message: NotificationMessage): void => {
    if (addMessage) {
      addMessage(message);
    } else {
      console.log('Notification:', message); // Fallback for when addMessage is not provided
    }
  }, [addMessage]);

  useEffect(() => {
    if (!isCorrectChain && chain?.id && contractInfo) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `This vault was deployed on ${contractInfo.chainName}. Please switch networks.`
      });
    }
  }, [chain?.id, contractInfo?.chainName, isCorrectChain, handleNotification]);

  const [ethBalance, setEthBalance] = useState<bigint>(_mock?.initialData?.ethBalance || BigInt(0));
  const [tokenBalances, setTokenBalances] = useAtom<TokenBalanceState>(tokenBalanceAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [backgroundFetching, setBackgroundFetching] = useAtom(backgroundFetchingAtom);
  const [vault, setVault] = useAtom(vaultInstanceAtom);
  const [error, setError] = useState<string | null>(null);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaTxSettings] = useAtom(metaTxSettingsAtom);
  const [activeTab, setActiveTab] = useState<'timelock' | 'metatx'>('timelock');

  // Add deployment hook
  const deployment = useContractDeployment({
    contractId: 'simple-vault',
    libraries: {
      MultiPhaseSecureOperation: "0x4D21415e9798573AE50242BDeD0cd4B583f31a19" as Address
    }
  })

  // Handle deployment
  const handleDeploy = async (params: {
    initialOwner: Address,
    broadcaster: Address,
    recovery: Address,
    timeLockPeriodInDays: number
  }) => {
    try {
      // Validate parameters
      if (!params.initialOwner || !params.broadcaster || !params.recovery) {
        throw new Error('All addresses must be provided')
      }

      if (params.timeLockPeriodInDays >= 90 || params.timeLockPeriodInDays <= 0) {
        throw new Error('Time lock period must be between 1 and 89 days')
      }

      // Deploy with constructor arguments
      await deployment.deploy([
        params.initialOwner,
        params.broadcaster,
        params.recovery,
        params.timeLockPeriodInDays
      ])

      if (deployment.address && onDeployed) {
        onDeployed(deployment.address)
      }

      handleNotification({
        type: 'success',
        title: 'Deployment Successful',
        description: `SimpleVault deployed to ${deployment.address}`
      })
    } catch (error: any) {
      console.error('Deployment failed:', error)
      handleNotification({
        type: 'error',
        title: 'Deployment Failed',
        description: error.message
      })
      throw error
    }
  }

  // If no contract address is provided, show deployment form
  if (!contractAddress) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <DeploymentForm
          onDeploy={handleDeploy}
          isLoading={deployment.isLoading}
        />
      </div>
    )
  }

  // Require contractInfo when contractAddress is provided
  if (!contractInfo) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Contract information is required but not provided</AlertDescription>
      </Alert>
    )
  }

  // Type assertion to help TypeScript understand contractInfo is defined
  const info = contractInfo as NonNullable<typeof contractInfo>
  const chainMatch = chain?.id === info.chainId

  useEffect(() => {
    if (!chainMatch && chain?.id) {
      handleNotification({
        type: 'warning',
        title: "Wrong Network",
        description: `This vault was deployed on ${info.chainName}. Please switch networks.`
      })
    }
  }, [chain?.id, info.chainName, chainMatch, handleNotification])

  // Move fetchTransactionsInBackground to be a memoized callback
  const fetchTransactionsInBackground = React.useCallback(async (vaultInstance: SimpleVault) => {
    // Skip if already fetching
    if (backgroundFetching.transactions) {
      console.log('Already fetching transactions, skipping');
      return;
    }

    try {
      setBackgroundFetching(prev => ({ ...prev, transactions: true }));
      setLoadingState(prev => ({ ...prev, transactions: true }));

      console.log('Starting background transaction fetch');
      const transactions = await vaultInstance.getPendingTransactions();
      console.log('Background fetch: pending transactions:', transactions);
      setPendingTxs(transactions);
    } catch (error) {
      console.error('Background fetch: Failed to fetch pending transactions:', error);
      // Don't set error state for background failures
    } finally {
      setBackgroundFetching(prev => ({ ...prev, transactions: false }));
      setLoadingState(prev => ({ ...prev, transactions: false }));
    }
  }, []); // Empty dependency array since we use function setters

  // Remove the polling effect and replace with a single fetch on mount
  useEffect(() => {
    if (!vault || _mock) {
      console.log('Skipping initial transaction fetch - no vault or using mock');
      return;
    }

    // Do a single fetch when the component mounts
    const fetchInitialTransactions = async () => {
      try {
        await fetchTransactionsInBackground(vault);
      } catch (error) {
        console.error('Error in initial transaction fetch:', error);
      }
    };

    fetchInitialTransactions();
  }, [vault, _mock, fetchTransactionsInBackground]); // Only run on mount and when vault changes

  // Restore the vault initialization effect
  useEffect(() => {
    const initializeVault = async () => {
      console.log('Initializing vault with params:', { 
        publicClient: !!publicClient, 
        chain: chain?.id, 
        contractAddress 
      });
      
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
        console.log('Creating new vault instance...');
        const vaultInstance = new SimpleVault(publicClient, walletClient, contractAddress, chain);
        console.log('Vault instance created successfully');
        setVault(vaultInstance);
        setError(null);

        // Fetch data once after successful initialization
        if (!_mock) {
          try {
            console.log('Fetching initial vault data...');
            // Fetch ETH balance first
            let balance: bigint;
            try {
              balance = await vaultInstance.getEthBalance();
              console.log('Initial ETH balance:', balance.toString());
              setEthBalance(balance);
            } catch (balanceError) {
              console.error('Failed to fetch initial ETH balance:', balanceError);
              balance = BigInt(0);
            }
          } catch (dataError: any) {
            console.error("Failed to fetch initial vault data:", dataError);
            setError(`Failed to fetch initial vault data: ${dataError.message || String(dataError)}`);
          }
        }
      } catch (initError: any) {
        console.error("Failed to initialize vault:", initError);
        setError(`Failed to initialize vault contract: ${initError.message || String(initError)}`);
        onError?.(new Error(`Failed to initialize vault contract: ${initError.message || String(initError)}`));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initializeVault();
  }, [publicClient, walletClient, contractAddress, chain, vault, setVault, setLoadingState, setError, setEthBalance, _mock, onError]);

  // Restore fetchTokenBalance as a memoized callback
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
  }, [vault, tokenBalances, setLoadingState, setTokenBalances, setError]);

  // Update fetchVaultData to use the memoized fetchTransactionsInBackground
  const fetchVaultData = React.useCallback(async () => {
    if (!vault || _mock) {
      console.log("Skipping fetchVaultData: vault not initialized or using mock data");
      return;
    }
    
    console.log("Starting to fetch vault data...");
    setLoadingState(prev => ({ ...prev, ethBalance: true }));
    
    try {
      // Fetch ETH balance first
      console.log("Fetching ETH balance...");
      const balance = await vault.getEthBalance();
      console.log("ETH balance fetched:", balance.toString());
      setEthBalance(balance);
      
      // Trigger background transaction fetch
      fetchTransactionsInBackground(vault);
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch vault data:", err);
      setError("Failed to fetch vault data: " + (err.message || String(err)));
      onError?.(new Error("Failed to fetch vault data: " + (err.message || String(err))));
    } finally {
      setLoadingState(prev => ({ ...prev, ethBalance: false }));
    }
  }, [vault, setLoadingState, setEthBalance, _mock, onError, fetchTransactionsInBackground]);

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
    
    setLoadingState((prev: LoadingState) => ({ ...prev, approval: { ...prev.approval, [txId]: true } }));
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
        title: "Approval Failed",
        description: error.message || "Failed to approve withdrawal"
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, approval: { ...prev.approval, [txId]: false } }));
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
    
    setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: { ...prev.cancellation, [txId]: true } }));
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
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel withdrawal"
      });
    } finally {
      setLoadingState((prev: LoadingState) => ({ ...prev, cancellation: { ...prev.cancellation, [txId]: false } }));
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

  // Set contract info and addMessage in atoms for global access
  const setContractInfoAtom = useSetAtom(contractInfoAtom);
  const setAddMessageAtom = useSetAtom(addMessageAtom);

  useEffect(() => {
    setContractInfoAtom(contractInfo);
  }, [contractInfo, setContractInfoAtom]);

  useEffect(() => {
    setAddMessageAtom(addMessage || null);
  }, [addMessage, setAddMessageAtom]);

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
            <div className="flex items-center gap-2">
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure meta-transaction settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>

          {/* Add settings dialog */}
          <MetaTxSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />

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
                          contractAddress={contractAddress as Address}
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
                        <Tabs defaultValue="timelock" className="w-full" onValueChange={(value) => setActiveTab(value as 'timelock' | 'metatx')}>
                          <TabsList className="grid w-full grid-cols-2 bg-background p-1 rounded-lg">
                            <TabsTrigger value="timelock" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">TimeLock</TabsTrigger>
                            <TabsTrigger value="metatx" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">MetaTx</TabsTrigger>
                          </TabsList>

                          <TabsContent value="timelock" className="mt-4">
                            <div className="space-y-4">
                              {loadingState.transactions ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                              ) : pendingTxs.length === 0 ? (
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
                                    isLoading={loadingState.approval[Number(tx.txId)] || loadingState.cancellation[Number(tx.txId)]}
                                    contractAddress={contractAddress as Address}
                                    mode="timelock"
                                  />
                                ))
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="metatx" className="mt-4">
                            <div className="space-y-4">
                              {loadingState.transactions ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                              ) : pendingTxs.length === 0 ? (
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
                                    isLoading={loadingState.cancellation[Number(tx.txId)]}
                                    contractAddress={contractAddress as Address}
                                    mode="metatx"
                                  />
                                ))
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
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
                          isLoading={loadingState.approval[Number(tx.txId)] || loadingState.cancellation[Number(tx.txId)]}
                          contractAddress={contractAddress as Address}
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
  return (
    <TransactionManagerProvider>
      <SimpleVaultUIContent {...props} />
    </TransactionManagerProvider>
  );
}
