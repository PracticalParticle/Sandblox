"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { PendingTransaction, PendingTransactions } from "./components/PendingTransaction";
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
import { useOperationTypes } from "@/hooks/useOperationTypes";
import { VAULT_OPERATIONS } from "./hooks/useSimpleVaultOperations";
import { useWalletBalances, TokenBalance } from '@/hooks/useWalletBalances';
import { useTimeLockActions } from './hooks/useTimeLockActions';
import { useMetaTxActions } from './hooks/useMetaTxActions';

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
  approval: Record<number, boolean>;
  cancellation: Record<number, boolean>;
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
  onNotification: (message: NotificationMessage) => void;
}

interface DepositFormProps {
  onSubmit: (amount: bigint, token?: Address) => Promise<void>;
  isLoading: boolean;
  walletBalances: {
    eth: bigint;
    tokens: Record<Address, TokenBalance>;
    isLoading: boolean;
    error: Error | null;
  };
}

const DepositForm = React.memo(({ onSubmit, isLoading, walletBalances }: DepositFormProps) => {
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>("ETH");
  const [tokenBalances] = useAtom(tokenBalanceAtom);

  const selectedToken = selectedTokenAddress === "ETH" ? undefined : tokenBalances[selectedTokenAddress as Address];
  const tokenDecimals = selectedToken?.metadata?.decimals ?? 18;

  // Get the maximum amount from wallet balance
  const maxAmount = selectedTokenAddress === "ETH"
    ? walletBalances.eth
    : walletBalances.tokens[selectedTokenAddress as Address]?.balance || BigInt(0);

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
            {Object.entries(tokenBalances).map(([address, token]) => {
              const tokenAddress = address as Address;
              const walletToken = walletBalances.tokens[tokenAddress];
              return (
                <SelectItem key={tokenAddress} value={tokenAddress}>
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
                        `${formatUnits(walletToken?.balance || BigInt(0), token.metadata?.decimals || 18)} available`
                      )}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
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
  const deadlineTimestamp = currentTimestamp + BigInt(settings.deadline);
  
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

  // Memoize the token selection handler
  const handleTokenSelect = useCallback((token: Address | undefined) => {
    console.log('Token selected in wrapper:', token);
  }, []); // Empty dependency array as it doesn't depend on any props or state

  // Memoize the current balance calculation
  const currentBalance = useMemo(() => 
    selectedTokenAddress === "ETH"
      ? ethBalance
      : (tokenBalances[selectedTokenAddress]?.balance || BigInt(0)),
    [selectedTokenAddress, tokenBalances, ethBalance]
  );

  // Only fetch token balance when necessary
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

  const handleSelectedTokenChange = useCallback((value: string) => {
    console.log('Token selection changing to:', value);
    setSelectedTokenAddress(value);
  }, []); // Empty dependency array as it only updates local state

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
  
  // State declarations - moved up before use
  const [ethBalance, setEthBalance] = useState<bigint>(_mock?.initialData?.ethBalance || BigInt(0));
  const [tokenBalances, setTokenBalances] = useAtom<TokenBalanceState>(tokenBalanceAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [backgroundFetching, setBackgroundFetching] = useAtom(backgroundFetchingAtom);
  const [vault, setVault] = useAtom(vaultInstanceAtom);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaTxSettings] = useAtom(metaTxSettingsAtom);
  const [activeTab, setActiveTab] = useState<'timelock' | 'metatx'>('timelock');

  // Add wallet balances hook after state declarations
  const trackedTokenAddresses = Object.keys(tokenBalances) as Address[];
  const walletBalances = useWalletBalances(trackedTokenAddresses);

  // Add this near other refs/state
  const hasFetchedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Add operation types hook
  const { getOperationName, loading: loadingOperationTypes } = useOperationTypes(contractAddress as Address);

  // Filter transactions for withdrawals
  const filteredPendingTxs = React.useMemo(() => {
    return pendingTxs.filter(tx => {
      const operationTypeHex = tx.params.operationType as Hex;
      const operationName = getOperationName(operationTypeHex);
      return operationName === VAULT_OPERATIONS.WITHDRAW_ETH || 
             operationName === VAULT_OPERATIONS.WITHDRAW_TOKEN;
    });
  }, [pendingTxs, getOperationName]);

  // Modify the initialization effect to only run once
  useEffect(() => {
    if (!publicClient || !chain || !contractInfo || !contractAddress || !walletClient || initialLoadDoneRef.current) {
      return;
    }

    const initialize = async () => {
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        
        // Ensure contractAddress is valid before creating vault instance
        if (typeof contractAddress !== 'string' || !contractAddress.startsWith('0x')) {
          throw new Error('Invalid contract address');
        }

        // Create vault instance with validated address
        const validatedAddress = contractAddress as `0x${string}`;
        const vaultInstance = new SimpleVault(
          publicClient, 
          walletClient, 
          validatedAddress, 
          chain
        );
        setVault(vaultInstance);

        // Fetch initial data only once
        const balance = await vaultInstance.getEthBalance();
        setEthBalance(balance);

        // Fetch initial transactions
        const transactions = await vaultInstance.getPendingTransactions();
        setPendingTxs(transactions);
        
        initialLoadDoneRef.current = true;
        setError(null);
      } catch (initError: any) {
        console.error("Failed to initialize vault:", initError);
        setError(`Failed to initialize vault contract: ${initError.message || String(initError)}`);
        onError?.(new Error(`Failed to initialize vault contract: ${initError.message || String(initError)}`));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initialize();
  }, [publicClient, walletClient, contractAddress, chain, contractInfo]); // Remove backgroundFetching and other unnecessary dependencies

  // Modify the fetchVaultData function to be simpler and only run when explicitly called
  const fetchVaultData = React.useCallback(async () => {
    if (!vault || _mock) {
      console.log("Cannot fetch: vault not initialized or using mock data");
      return;
    }
    
    setLoadingState(prev => ({ ...prev, ethBalance: true }));
    
    try {
      const balance = await vault.getEthBalance();
      setEthBalance(balance);
      
      const transactions = await vault.getPendingTransactions();
      setPendingTxs(transactions);
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch vault data:", err);
      setError("Failed to fetch vault data: " + (err.message || String(err)));
      onError?.(new Error("Failed to fetch vault data: " + (err.message || String(err))));
    } finally {
      setLoadingState(prev => ({ ...prev, ethBalance: false }));
    }
  }, [vault, setEthBalance, setPendingTxs, onError, _mock]);

  // Modify the refresh handler to be explicit
  const handleRefresh = useCallback(() => {
    fetchVaultData();
  }, [fetchVaultData]);

  // Notification handler
  const handleNotification = React.useCallback((message: NotificationMessage): void => {
    if (addMessage) {
      addMessage(message);
    } else {
      console.log('Notification:', message);
    }
  }, [addMessage]);

  // Add these functions before the return statement
  const handleDeposit = async (amount: bigint, token?: Address) => {
    if (!vault || !address) {
      throw new Error("Vault not initialized or wallet not connected");
    }

    setLoadingState(prev => ({ ...prev, deposit: true }));
    try {
      let tx;
      if (token) {
        // For ERC20 tokens, first check and handle allowance
        const allowance = await vault.getTokenAllowance(token, address);
        if (allowance < amount) {
          // Request approval first
          tx = await vault.approveTokenAllowance(token, amount, { from: address });
          await tx.wait();
        }
        // Now deposit the tokens
        tx = await vault.depositToken(token, amount, { from: address });
      } else {
        // For ETH deposits
        tx = await vault.depositEth(amount, { from: address });
      }

      // Wait for transaction confirmation
      await tx.wait();

      // Show success message
      addMessage?.({
        type: 'success',
        title: 'Deposit Successful',
        description: `Successfully deposited ${token ? 'tokens' : 'ETH'} to vault`
      });

      // Refresh balances
      await fetchVaultData();
    } catch (error: any) {
      console.error('Deposit error:', error);
      addMessage?.({
        type: 'error',
        title: 'Deposit Failed',
        description: error.message || 'Failed to deposit to vault'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, deposit: false }));
    }
  };

  const handleWithdrawal = async (to: Address, amount: bigint, token?: Address) => {
    if (!vault || !address) {
      throw new Error("Vault not initialized or wallet not connected");
    }

    setLoadingState(prev => ({ ...prev, withdrawal: true }));
    try {
      let tx;
      if (token) {
        // Request token withdrawal
        tx = await vault.withdrawTokenRequest(token, to, amount, { from: address });
      } else {
        // Request ETH withdrawal
        tx = await vault.withdrawEthRequest(to, amount, { from: address });
      }

      // Wait for transaction confirmation
      await tx.wait();

      // Show success message
      addMessage?.({
        type: 'success',
        title: 'Withdrawal Request Submitted',
        description: `Successfully submitted withdrawal request for ${token ? 'tokens' : 'ETH'}`
      });

      // Refresh transactions
      await fetchVaultData();
    } catch (error: any) {
      console.error('Withdrawal request error:', error);
      addMessage?.({
        type: 'error',
        title: 'Withdrawal Request Failed',
        description: error.message || 'Failed to submit withdrawal request'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, withdrawal: false }));
    }
  };

  // Add hooks
  const {
    handleApproveWithdrawal,
    handleCancelWithdrawal,
    loadingStates: timeLockLoadingStates
  } = useTimeLockActions(
    contractAddress as Address,
    addMessage,
    addMessage,
    handleRefresh
  );

  const {
    handleMetaTxSign,
    handleBroadcastMetaTx,
    signedMetaTxStates,
    isLoading: isMetaTxLoading
  } = useMetaTxActions(
    contractAddress as Address,
    addMessage,
    addMessage,
    handleRefresh
  );

  // Update loadingState to include timeLockLoadingStates
  useEffect(() => {
    setLoadingState(prev => ({
      ...prev,
      approval: timeLockLoadingStates.approval,
      cancellation: timeLockLoadingStates.cancellation
    }));
  }, [timeLockLoadingStates]);

  const fetchTokenBalance = async (tokenAddress: Address): Promise<void> => {
    if (!vault) return;
    
    setLoadingState(prev => ({
      ...prev,
      tokenBalance: true
    }));

    try {
      const balance = await vault.getTokenBalance(tokenAddress);
      const metadata = await vault.getTokenMetadata(tokenAddress);
      
      setTokenBalances(prev => ({
        ...prev,
        [tokenAddress]: {
          balance,
          metadata,
          loading: false,
          error: undefined
        } as TokenState
      }));
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setTokenBalances(prev => ({
        ...prev,
        [tokenAddress]: {
          ...prev[tokenAddress],
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        } as TokenState
      }));
    } finally {
      setLoadingState(prev => ({
        ...prev,
        tokenBalance: false
      }));
    }
  };

  const handleRemoveToken = (tokenAddress: string): void => {
    setTokenBalances(prev => {
      const newBalances = { ...prev };
      delete newBalances[tokenAddress];
      
      // Update local storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newBalances));
      } catch (error) {
        console.error('Failed to update local storage:', error);
      }
      
      return newBalances;
    });
  };

  // Ensure contractAddress is properly typed at the start
  const typedContractAddress = contractAddress as Address;
  const typedOwnerAddress = (contractInfo?.owner || "0x") as Address;
  const typedBroadcasterAddress = (contractInfo?.broadcaster || "0x") as Address;

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
                const vaultInstance = new SimpleVault(publicClient, walletClient, contractAddress as `0x${string}`, chain);
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

  // Update the dashboard mode view
  if (dashboardMode && pendingTxs.length > 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Pending Transactions</h3>
        <div className="space-y-2">
          {filteredPendingTxs.slice(0, 2).map((tx) => (
            <PendingTransaction
              key={tx.txId}
              tx={tx}
              onApprove={handleApproveWithdrawal}
              onCancel={handleCancelWithdrawal}
              isLoading={loadingState.approval[Number(tx.txId)] || loadingState.cancellation[Number(tx.txId)]}
              contractAddress={typedContractAddress}
              onNotification={handleNotification}
              onRefresh={handleRefresh}
              mode="timelock"
            />
          ))}
          {filteredPendingTxs.length > 2 && (
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
    );
  }

  // Fix the network warning JSX
  return (
    <div className="h-full overflow-auto">
      {chain?.id && contractInfo?.chainId && chain.id !== contractInfo.chainId && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            This vault was deployed on {contractInfo?.chainName || 'unknown network'}. Please switch to the correct network to perform operations.
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
                onClick={handleRefresh}
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
                          walletBalances={walletBalances}
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
                              <PendingTransactions
                                transactions={filteredPendingTxs}
                                isLoadingTx={loadingState.transactions}
                                onRefresh={handleRefresh}
                                onApprove={handleApproveWithdrawal}
                                onCancel={handleCancelWithdrawal}
                                isLoading={false}
                                contractAddress={typedContractAddress}
                                mode="timelock"
                                onNotification={addMessage}
                                ownerAddress={contractInfo?.owner ? typedOwnerAddress : undefined}
                                broadcasterAddress={contractInfo?.broadcaster ? typedBroadcasterAddress : undefined}
                                connectedAddress={address}
                              />
                            </div>
                          </TabsContent>

                          <TabsContent value="metatx" className="mt-4">
                            <div className="space-y-4">
                              <PendingTransactions
                                transactions={filteredPendingTxs}
                                isLoadingTx={loadingState.transactions}
                                onRefresh={handleRefresh}
                                onMetaTxSign={handleMetaTxSign}
                                onBroadcastMetaTx={handleBroadcastMetaTx}
                                signedMetaTxStates={signedMetaTxStates}
                                isLoading={isMetaTxLoading}
                                contractAddress={typedContractAddress}
                                mode="metatx"
                                onNotification={addMessage}
                                ownerAddress={contractInfo?.owner ? typedOwnerAddress : undefined}
                                broadcasterAddress={contractInfo?.broadcaster ? typedBroadcasterAddress : undefined}
                                connectedAddress={address}
                              />
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
                      {filteredPendingTxs.slice(0, 2).map((tx) => (
                        <PendingTransaction
                          key={tx.txId}
                          tx={tx}
                          onApprove={handleApproveWithdrawal}
                          onCancel={handleCancelWithdrawal}
                          isLoading={loadingState.approval[Number(tx.txId)] || loadingState.cancellation[Number(tx.txId)]}
                          contractAddress={typedContractAddress}
                          onNotification={handleNotification}
                          onRefresh={handleRefresh}
                          mode="timelock"
                        />
                      ))}
                      {filteredPendingTxs.length > 2 && (
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

// Create a new QueryClient instance with proper type
const queryClient = new QueryClient();

// Main export with proper providers
export default function SimpleVaultUI(props: SimpleVaultUIProps) {
  return (
    <TransactionManagerProvider>
      <SimpleVaultUIContent {...props} />
    </TransactionManagerProvider>
  );
}
