"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Address, formatUnits, parseUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import SimpleRWA20 from "./SimpleRWA20";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom } from "jotai";
import { AlertCircle, Loader2, Coins, Settings2, ShieldCheck, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ContractInfo as BaseContractInfo } from "@/lib/verification/index";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationMessage, TokenMetaTxParams, RWA20TxRecord } from './lib/types';
import { TransactionManagerProvider } from "@/contexts/MetaTransactionManager";
import { useOperations, RWA20_OPERATIONS } from './hooks/useOperations';
import { SimpleRWA20Service } from "./lib/services";
import { useWorkflowManager } from "@/hooks/useWorkflowManager";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Define TxStatus constants directly to avoid import issues
const TX_STATUS = {
  UNDEFINED: 0,
  PENDING: 1,
  CANCELLED: 2,
  COMPLETED: 3,
  FAILED: 4,
  REJECTED: 5
} as const;

// Extend the base ContractInfo interface to include broadcaster and other properties
interface ContractInfo extends BaseContractInfo {
  owner: string;
  broadcaster: string;
  recoveryAddress: string;
}

// State atoms for our component
const rwa20InstanceAtom = atom<SimpleRWA20 | null>(null);
const rwa20ServiceAtom = atom<SimpleRWA20Service | null>(null);
const tokenMetadataAtom = atom<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
} | null>(null);

// Loading state atom
const loadingStateAtom = atom<{
  tokenInfo: boolean;
  balance: boolean;
  minting: boolean;
  burning: boolean;
  initialization: boolean;
  operations: boolean;
}>({
  tokenInfo: false,
  balance: false,
  minting: false,
  burning: false,
  initialization: true,
  operations: false,
});

// Add storage key for meta tx settings
const META_TX_SETTINGS_KEY = 'simpleRWA20.metaTxSettings';

// Default meta-transaction settings
const defaultMetaTxSettings: TokenMetaTxParams = {
  deadline: BigInt(3600), // 1 hour in seconds
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

// Settings atom
const metaTxSettingsAtom = atom<TokenMetaTxParams>(defaultMetaTxSettings);

// Component for Meta Transaction Settings Dialog
function MetaTxSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [rwa20Service] = useAtom(rwa20ServiceAtom);
  const [settings, setSettings] = useAtom(metaTxSettingsAtom);
  const [deadline, setDeadline] = useState(() => Number(settings.deadline / BigInt(3600)));
  const [maxGasPrice, setMaxGasPrice] = useState(() => Number(settings.maxGasPrice / BigInt(1000000000)));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      // Try to get stored settings from service if available
      if (rwa20Service) {
        const storedSettings = rwa20Service.getStoredMetaTxSettings();
        setDeadline(Number(storedSettings.deadline / BigInt(3600)));
        setMaxGasPrice(Number(storedSettings.maxGasPrice / BigInt(1000000000)));
      } else {
        setDeadline(Number(settings.deadline / BigInt(3600)));
        setMaxGasPrice(Number(settings.maxGasPrice / BigInt(1000000000)));
      }
    }
  }, [open, settings, rwa20Service]);

  const handleSave = () => {
    // Convert hours to seconds and gwei to wei
    const newSettings: TokenMetaTxParams = {
      deadline: BigInt(deadline * 3600),
      maxGasPrice: BigInt(maxGasPrice * 1000000000)
    };

    // Update state
    setSettings(newSettings);
    
    // Save to local storage via service if available
    if (rwa20Service) {
      rwa20Service.storeMetaTxSettings(newSettings);
    } else {
      // Fallback to direct localStorage if service not available
      try {
        localStorage.setItem(META_TX_SETTINGS_KEY, JSON.stringify({
          deadline: deadline * 3600,
          maxGasPrice: maxGasPrice * 1000000000
        }));
      } catch (error) {
        console.error('Failed to save settings to local storage:', error);
      }
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

// Mint Form Component
interface MintFormProps {
  onSubmit: (to: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
}

const MintForm = ({ onSubmit, isLoading, decimals }: MintFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      // Validate address
      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
        throw new Error("Invalid recipient address");
      }

      // Parse amount with appropriate decimals
      const parsedAmount = parseUnits(amount, decimals);
      
      await onSubmit(to as Address, parsedAmount);
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
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          aria-label="Token amount input"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Processing..." : "Mint Tokens"}
      </Button>
    </form>
  );
};

// Burn Form Component
interface BurnFormProps {
  onSubmit: (from: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
  maxAmount: bigint;
}

const BurnForm = ({ onSubmit, isLoading, decimals, maxAmount }: BurnFormProps) => {
  const [from, setFrom] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Format the max amount based on decimals
  const formattedMaxAmount = formatUnits(maxAmount, decimals);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      // Validate address
      if (!/^0x[a-fA-F0-9]{40}$/.test(from)) {
        throw new Error("Invalid address to burn from");
      }

      // Parse amount with appropriate decimals
      const parsedAmount = parseUnits(amount, decimals);
      
      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds total supply");
      }
      
      await onSubmit(from as Address, parsedAmount);
      setFrom("");
      setAmount("");
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="from">Address to Burn From</Label>
        <Input
          id="from"
          placeholder="0x..."
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
          pattern="^0x[a-fA-F0-9]{40}$"
          aria-label="Address to burn from input"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          step="any"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          aria-label="Token amount input"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <div>Total supply: {Number(formattedMaxAmount).toFixed(4)}</div>
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
        {isLoading ? "Processing..." : "Burn Tokens"}
      </Button>
    </form>
  );
};

// Transaction History Component
interface TransactionHistoryProps {
  transactions: RWA20TxRecord[];
  isLoading: boolean;
  decimals: number;
  onBroadcast: (tx: RWA20TxRecord, type: 'mint' | 'burn') => Promise<void>;
  isBroadcasting: boolean;
}

const TransactionHistory = ({ 
  transactions, 
  isLoading, 
  decimals,
  onBroadcast,
  isBroadcasting
}: TransactionHistoryProps) => {
  // Define status badge variants for numeric status
  const getStatusVariant = (status: number): "default" | "secondary" | "destructive" | "outline" => {
    // Map numeric status values to appropriate variants
    switch (status) {
      case TX_STATUS.PENDING:
        return "outline";
      case TX_STATUS.COMPLETED:
        return "default";
      case TX_STATUS.FAILED:
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Define mapping function for status to display text
  const getStatusText = (status: number): string => {
    switch (status) {
      case TX_STATUS.UNDEFINED: return "UNDEFINED";
      case TX_STATUS.PENDING: return "PENDING";
      case TX_STATUS.CANCELLED: return "CANCELLED";
      case TX_STATUS.COMPLETED: return "COMPLETED";
      case TX_STATUS.FAILED: return "FAILED";
      case TX_STATUS.REJECTED: return "REJECTED";
      default: return "UNKNOWN";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.txId.toString()}>
                <TableCell>
                  <Badge variant="outline">{tx.type}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {tx.type === "MINT" 
                    ? `${tx.to.substring(0, 6)}...${tx.to.substring(tx.to.length - 4)}`
                    : `${tx.from?.substring(0, 6)}...${tx.from?.substring(tx.from.length - 4)}`
                  }
                </TableCell>
                <TableCell>{formatUnits(tx.amount, decimals)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(tx.status)}>
                    {getStatusText(tx.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tx.status === TX_STATUS.PENDING && (
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => onBroadcast(tx, tx.type.toLowerCase() as 'mint' | 'burn')}
                      disabled={isBroadcasting}
                    >
                      {isBroadcasting ? "Broadcasting..." : "Broadcast"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Main Component Interface
interface SimpleRWA20UIProps {
  contractAddress?: Address;
  contractInfo?: ContractInfo;
  onError?: (error: Error) => void;
  dashboardMode?: boolean;
  renderSidebar?: boolean;
  addMessage?: (message: NotificationMessage) => void;
}

// Main Component Content
function SimpleRWA20UIContent({
  contractAddress,
  contractInfo,
  onError,
  dashboardMode = false,
  renderSidebar = false,
  addMessage
}: SimpleRWA20UIProps): JSX.Element {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  const navigate = useNavigate();
  
  // State declarations
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  const [rwa20, setRWA20] = useAtom(rwa20InstanceAtom);
  const [rwa20Service, setRWA20Service] = useAtom(rwa20ServiceAtom);
  const [tokenMetadata, setTokenMetadata] = useAtom(tokenMetadataAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Operations hook
  const {
    handleMetaTxMint,
    handleMetaTxBurn,
    handleBroadcastMetaTx,
    loadingStates: operationsLoadingStates,
    rwa20Operations,
    isLoading: isLoadingOperations,
    rwa20Service: operationsService,
    statusFilter,
    operationTypeFilter,
    setStatusFilter: setStatusFilterOriginal,
    setOperationTypeFilter: setOperationTypeFilterOriginal
  } = useOperations({
    contractAddress: contractAddress as Address,
    onSuccess: addMessage,
    onError: addMessage,
    onRefresh: () => handleRefresh()
  });
  
  // Status filter functions - Simply pass the filter values through without trying to convert types
  const setStatusFilter = useCallback((filter: string | null) => {
    setStatusFilterOriginal(filter || "all");
  }, [setStatusFilterOriginal]);
  
  const setOperationTypeFilter = useCallback((filter: string | null) => {
    setOperationTypeFilterOriginal(filter || "all");
  }, [setOperationTypeFilterOriginal]);
  
  // Workflow manager for role validation
  const { isOwner } = useWorkflowManager(contractAddress as Address);
  
  // Memoized decimals value
  const decimals = useMemo(() => tokenMetadata?.decimals || 18, [tokenMetadata]);
  
  // Initialization flag
  const initialLoadDoneRef = useRef(false);

  // Load settings from service when available
  useEffect(() => {
    if (rwa20Service) {
      const storedSettings = rwa20Service.getStoredMetaTxSettings();
      console.log('Loaded meta tx settings:', storedSettings);
    }
  }, [rwa20Service]);

  // Refresh function to update token data
  const handleRefresh = useCallback(async () => {
    if (!rwa20 || !rwa20Service || !address) {
      console.log("Cannot fetch: token not initialized or wallet not connected");
      return;
    }
    
    setLoadingState(prev => ({ ...prev, tokenInfo: true, balance: true }));
    
    try {
      // Fetch token metadata
      const metadata = await rwa20Service.getTokenMetadata();
      setTokenMetadata(metadata);
      
      // Fetch user balance
      const balance = await rwa20.balanceOf(address);
      setTokenBalance(balance);
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch token data:", err);
      setError("Failed to fetch token data: " + (err.message || String(err)));
      onError?.(new Error("Failed to fetch token data: " + (err.message || String(err))));
    } finally {
      setLoadingState(prev => ({ ...prev, tokenInfo: false, balance: false }));
    }
  }, [rwa20, rwa20Service, address, setTokenMetadata, onError]);

  // Initialize the component
  useEffect(() => {
    if (!publicClient || !chain || !contractAddress || initialLoadDoneRef.current) {
      return;
    }

    const initialize = async () => {
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        
        // Create token instance
        const tokenInstance = new SimpleRWA20(
          publicClient, 
          walletClient || undefined, 
          contractAddress, 
          chain
        );
        setRWA20(tokenInstance);
        
        // Create service instance
        const serviceInstance = new SimpleRWA20Service(
          publicClient,
          walletClient || undefined,
          contractAddress,
          chain
        );
        setRWA20Service(serviceInstance);

        // Fetch initial token metadata
        const metadata = await serviceInstance.getTokenMetadata();
        setTokenMetadata(metadata);
        
        // Fetch initial balance if wallet connected
        if (address) {
          const balance = await tokenInstance.balanceOf(address);
          setTokenBalance(balance);
        }
        
        initialLoadDoneRef.current = true;
        setError(null);
      } catch (initError: any) {
        console.error("Failed to initialize token:", initError);
        setError(`Failed to initialize token contract: ${initError.message || String(initError)}`);
        onError?.(new Error(`Failed to initialize token contract: ${initError.message || String(initError)}`));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initialize();
  }, [publicClient, walletClient, contractAddress, chain, address]);

  // Action handlers
  const handleMint = useCallback(async (to: Address, amount: bigint) => {
    try {
      setLoadingState(prev => ({ ...prev, minting: true }));
      await handleMetaTxMint(to, amount);
      addMessage?.({
        type: 'success',
        title: 'Mint Transaction Signed',
        description: `Successfully signed mint transaction for ${formatUnits(amount, decimals)} tokens to ${to}`
      });
    } catch (error: any) {
      console.error('Mint error:', error);
      addMessage?.({
        type: 'error',
        title: 'Mint Transaction Failed',
        description: error.message || 'Failed to sign mint transaction'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, minting: false }));
    }
  }, [handleMetaTxMint, addMessage, decimals]);

  const handleBurn = useCallback(async (from: Address, amount: bigint) => {
    try {
      setLoadingState(prev => ({ ...prev, burning: true }));
      await handleMetaTxBurn(from, amount);
      addMessage?.({
        type: 'success',
        title: 'Burn Transaction Signed',
        description: `Successfully signed burn transaction for ${formatUnits(amount, decimals)} tokens from ${from}`
      });
    } catch (error: any) {
      console.error('Burn error:', error);
      addMessage?.({
        type: 'error',
        title: 'Burn Transaction Failed',
        description: error.message || 'Failed to sign burn transaction'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, burning: false }));
    }
  }, [handleMetaTxBurn, addMessage, decimals]);

  const handleBroadcast = useCallback(async (tx: RWA20TxRecord, type: 'mint' | 'burn') => {
    try {
      await handleBroadcastMetaTx(tx, type);
      addMessage?.({
        type: 'success',
        title: 'Transaction Broadcast',
        description: `Successfully broadcasted ${type} transaction`
      });
    } catch (error: any) {
      console.error('Broadcast error:', error);
      addMessage?.({
        type: 'error',
        title: 'Broadcast Failed',
        description: error.message || 'Failed to broadcast transaction'
      });
    }
  }, [handleBroadcastMetaTx, addMessage]);

  // Loading state
  if (loadingState.initialization) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Initializing token...</p>
        </div>
      </div>
    );
  }

  // Error state
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
            // Reinitialize the token
            const initializeToken = async () => {
              if (!publicClient || !chain) return;
              try {
                const tokenInstance = new SimpleRWA20(publicClient, walletClient || undefined, contractAddress as Address, chain);
                setRWA20(tokenInstance);
                setError(null);
              } catch (err: any) {
                console.error("Failed to initialize token:", err);
                setError("Failed to initialize token contract");
                onError?.(new Error("Failed to initialize token contract"));
              } finally {
                setLoadingState(prev => ({ ...prev, initialization: false }));
              }
            };
            initializeToken();
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

  // Render main content
  return (
    <div className="h-full overflow-auto">
      {chain?.id && contractInfo?.chainId && chain.id !== contractInfo.chainId && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            This token was deployed on {contractInfo?.chainName || 'unknown network'}. Please switch to the correct network to perform operations.
          </AlertDescription>
        </Alert>
      )}
      
      <div className={dashboardMode ? "p-0" : "container mx-auto p-4"}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {loadingState.tokenInfo ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    tokenMetadata?.name || "RWA20 Token"
                  )}
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Real-World Asset Token with meta-transaction capabilities</p>
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
                disabled={loadingState.tokenInfo || !rwa20}
              >
                {loadingState.tokenInfo ? (
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

          {/* Token metadata and balance */}
          <CardContent className="pt-2 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">TOKEN INFO</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Symbol</p>
                    {loadingState.tokenInfo ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <p className="text-xl font-bold">{tokenMetadata?.symbol || "---"}</p>
                    )}
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Decimals</p>
                    {loadingState.tokenInfo ? (
                      <Skeleton className="h-6 w-16 mt-1" />
                    ) : (
                      <p className="text-xl font-bold">{tokenMetadata?.decimals || "---"}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">BALANCES</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Total Supply</p>
                    {loadingState.tokenInfo ? (
                      <Skeleton className="h-6 w-24 mt-1" />
                    ) : (
                      <p className="text-xl font-bold">
                        {tokenMetadata?.totalSupply 
                          ? formatUnits(tokenMetadata.totalSupply, decimals)
                          : "---"
                        }
                      </p>
                    )}
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Your Balance</p>
                    {!address ? (
                      <p className="text-xs text-muted-foreground mt-1">Connect wallet to view</p>
                    ) : loadingState.balance ? (
                      <Skeleton className="h-6 w-24 mt-1" />
                    ) : (
                      <p className="text-xl font-bold">{formatUnits(tokenBalance, decimals)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Transaction Settings Dialog */}
            <MetaTxSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
            />

            {/* Tabs for Mint, Burn, and Transactions */}
            {isOwner ? (
              <Tabs defaultValue="mint" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-background p-1 rounded-lg">
                  <TabsTrigger value="mint" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                    Mint
                  </TabsTrigger>
                  <TabsTrigger value="burn" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                    Burn
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                    Transactions
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="mint">
                  <Card>
                    <CardHeader>
                      <CardTitle>Mint Tokens</CardTitle>
                      <CardDescription>
                        Creates and signs a meta-transaction to mint new tokens
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MintForm
                        onSubmit={handleMint}
                        isLoading={loadingState.minting || operationsLoadingStates.minting}
                        decimals={decimals}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="burn">
                  <Card>
                    <CardHeader>
                      <CardTitle>Burn Tokens</CardTitle>
                      <CardDescription>
                        Creates and signs a meta-transaction to burn existing tokens
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BurnForm
                        onSubmit={handleBurn}
                        isLoading={loadingState.burning || operationsLoadingStates.burning}
                        decimals={decimals}
                        maxAmount={tokenMetadata?.totalSupply || BigInt(0)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transactions">
                  <Card>
                    <CardHeader>
                      <CardTitle>Transaction History</CardTitle>
                      <CardDescription>
                        View and manage token operations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TransactionHistory
                        transactions={rwa20Operations}
                        isLoading={isLoadingOperations}
                        decimals={decimals}
                        onBroadcast={handleBroadcast}
                        isBroadcasting={operationsLoadingStates.broadcasting}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              // Non-owner view
              <div className="space-y-6">
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Token Information</AlertTitle>
                  <AlertDescription>
                    This is an RWA20 token. Only the owner can mint and burn tokens.
                  </AlertDescription>
                </Alert>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                      View token operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TransactionHistory
                      transactions={rwa20Operations}
                      isLoading={isLoadingOperations}
                      decimals={decimals}
                      onBroadcast={handleBroadcast}
                      isBroadcasting={operationsLoadingStates.broadcasting}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main export with TransactionManagerProvider
export default function SimpleRWA20UI(props: SimpleRWA20UIProps) {
  return (
    <TransactionManagerProvider>
      <SimpleRWA20UIContent {...props} />
    </TransactionManagerProvider>
  );
}
