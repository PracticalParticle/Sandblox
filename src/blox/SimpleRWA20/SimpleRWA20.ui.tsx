"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } from "react";
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
import { AlertCircle, Loader2, Coins, Settings2, Info } from "lucide-react";
import { ContractInfo as BaseContractInfo } from "@/lib/verification/index";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationMessage, TokenMetaTxParams } from './lib/types';
import { TransactionManagerProvider } from "@/contexts/MetaTransactionManager";
import { useOperations } from './hooks/useOperations';
import { SimpleRWA20Service } from "./lib/services";
import { useWorkflowManager } from "@/hooks/useWorkflowManager";

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
  transferring: boolean;
  approving: boolean;
}>({
  tokenInfo: false,
  balance: false,
  minting: false,
  burning: false,
  initialization: true,
  operations: false,
  transferring: false,
  approving: false,
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

// Create a context for the contract address
const ContractAddressContext = createContext<Address | undefined>(undefined);

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

const MintForm = React.memo(({ onSubmit, isLoading, decimals }: MintFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Debug logging to track re-renders
  useEffect(() => {
    console.log('MintForm re-rendered with decimals:', decimals);
  }, [decimals]);

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
});

MintForm.displayName = 'MintForm';

// Burn Form Component
interface BurnFormProps {
  onSubmit: (from: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
}

const BurnForm = React.memo(({ onSubmit, isLoading, decimals }: BurnFormProps) => {
  const [from, setFrom] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [loadingAllowance, setLoadingAllowance] = useState<boolean>(false);
  const [rwa20] = useAtom(rwa20InstanceAtom);
  
  // Get the contract address from context
  const contractAddress = useContext(ContractAddressContext);
  
  // Format allowance based on decimals
  const formattedAllowance = formatUnits(allowance, decimals);

  // Fetch allowance when the from address changes
  useEffect(() => {
    const fetchAllowance = async () => {
      if (!rwa20 || !from || !contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(from)) {
        setAllowance(BigInt(0));
        return;
      }

      try {
        setLoadingAllowance(true);
        // Check the allowance the "from" address has given to the token contract itself
        // The allowance function takes (owner, spender) where:
        // - owner is the address owning the tokens (from address)
        // - spender is the contract address that's allowed to burn tokens
        const allowanceAmount = await rwa20.allowance(from as Address, contractAddress);
        setAllowance(allowanceAmount);
      } catch (err) {
        console.error('Failed to fetch allowance:', err);
        setAllowance(BigInt(0));
      } finally {
        setLoadingAllowance(false);
      }
    };

    fetchAllowance();
  }, [from, rwa20, contractAddress]);

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
      
      if (parsedAmount > allowance) {
        throw new Error("Amount exceeds allowance");
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
          <div>
            {loadingAllowance ? (
              <span>Loading allowance...</span>
            ) : (
              <span>Address Allowance: {Number(formattedAllowance).toFixed(4)}</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-primary"
            onClick={() => setAmount(formattedAllowance)}
            disabled={loadingAllowance || allowance === BigInt(0)}
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
});

// Transfer Form Component
interface TransferFormProps {
  onSubmit: (to: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
  maxAmount: bigint;
}

const TransferForm = React.memo(({ onSubmit, isLoading, decimals, maxAmount }: TransferFormProps) => {
  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Format the max amount based on decimals
  const formattedMaxAmount = formatUnits(maxAmount, decimals);

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
      
      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds your balance");
      }
      
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
        <div className="flex justify-between text-sm text-muted-foreground">
          <div>Your balance: {Number(formattedMaxAmount).toFixed(4)}</div>
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
        {isLoading ? "Processing..." : "Transfer Tokens"}
      </Button>
    </form>
  );
});

// Allowance Form Component
interface AllowanceFormProps {
  onSubmit: (spender: Address, amount: bigint) => Promise<void>;
  isLoading: boolean;
  decimals: number;
  maxAmount: bigint;
}

const AllowanceForm = React.memo(({ onSubmit, isLoading, decimals, maxAmount }: AllowanceFormProps) => {
  const [spender, setSpender] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Format the max amount based on decimals
  const formattedMaxAmount = formatUnits(maxAmount, decimals);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    
    try {
      // Validate address
      if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
        throw new Error("Invalid spender address");
      }

      // Parse amount with appropriate decimals
      const parsedAmount = parseUnits(amount, decimals);
      
      if (parsedAmount > maxAmount) {
        throw new Error("Amount exceeds your balance");
      }
      
      await onSubmit(spender as Address, parsedAmount);
      setSpender("");
      setAmount("");
    } catch (error: any) {
      console.error('Form submission error:', error);
      setError(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="spender">Spender Address</Label>
        <Input
          id="spender"
          placeholder="0x..."
          value={spender}
          onChange={(e) => setSpender(e.target.value)}
          required
          pattern="^0x[a-fA-F0-9]{40}$"
          aria-label="Spender address input"
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
          <div>Your balance: {Number(formattedMaxAmount).toFixed(4)}</div>
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
        {isLoading ? "Processing..." : "Set Allowance"}
      </Button>
    </form>
  );
});

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
    loadingStates: operationsLoadingStates,
  } = useOperations({
    contractAddress: contractAddress as Address,
    onSuccess: addMessage,
    onError: addMessage,
    onRefresh: () => handleRefresh()
  });
  
  // Workflow manager for role validation
  const { isOwner } = useWorkflowManager(contractAddress as Address);
  
  // Memoized decimals value - use stable default to prevent unnecessary re-renders
  const decimals = useMemo(() => {
    const tokenDecimals = tokenMetadata?.decimals;
    // Return a stable value to prevent form re-renders
    return tokenDecimals !== undefined ? tokenDecimals : 18;
  }, [tokenMetadata?.decimals]);
  
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
  
  // Add new action handlers for transfer and approve
  const handleTransfer = useCallback(async (to: Address, amount: bigint) => {
    if (!rwa20Service || !address) {
      console.error("Cannot transfer: service not initialized or wallet not connected");
      return;
    }
    
    try {
      setLoadingState(prev => ({ ...prev, transferring: true }));
      
      const result = await rwa20Service.transfer(to, amount, { from: address });
      await result.wait();
      
      // Refresh token data after transfer
      await handleRefresh();
      
      addMessage?.({
        type: 'success',
        title: 'Transfer Successful',
        description: `Successfully transferred ${formatUnits(amount, decimals)} tokens to ${to}`
      });
    } catch (error: any) {
      console.error('Transfer error:', error);
      addMessage?.({
        type: 'error',
        title: 'Transfer Failed',
        description: error.message || 'Failed to transfer tokens'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, transferring: false }));
    }
  }, [rwa20Service, address, handleRefresh, addMessage, decimals]);

  const handleApprove = useCallback(async (spender: Address, amount: bigint) => {
    if (!rwa20Service || !address) {
      console.error("Cannot approve: service not initialized or wallet not connected");
      return;
    }
    
    try {
      setLoadingState(prev => ({ ...prev, approving: true }));
      
      const result = await rwa20Service.approve(spender, amount, { from: address });
      await result.wait();
      
      addMessage?.({
        type: 'success',
        title: 'Approval Successful',
        description: `Successfully approved ${formatUnits(amount, decimals)} tokens for ${spender}`
      });
    } catch (error: any) {
      console.error('Approval error:', error);
      addMessage?.({
        type: 'error',
        title: 'Approval Failed',
        description: error.message || 'Failed to approve tokens'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, approving: false }));
    }
  }, [rwa20Service, address, addMessage, decimals]);

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
    <ContractAddressContext.Provider value={contractAddress}>
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
              {!renderSidebar && (
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
              )}
            </CardHeader>

            {/* Token metadata and balance */}
            <CardContent className="pt-2 pb-4">
              <div className={`grid gap-4 mb-6 ${renderSidebar ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {/* Token Info Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">TOKEN INFO</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium text-muted-foreground">Symbol</p>
                      {loadingState.tokenInfo ? (
                        <Skeleton className="h-6 w-16 mt-1" />
                      ) : (
                        <p className="text-xl font-bold truncate" title={tokenMetadata?.symbol || "---"}>
                          {tokenMetadata?.symbol || "---"}
                        </p>
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
                
                {/* Balances Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">BALANCES</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium text-muted-foreground">Total Supply</p>
                      {loadingState.tokenInfo ? (
                        <Skeleton className="h-6 w-24 mt-1" />
                      ) : (
                        <p className="text-xl font-bold truncate" title={tokenMetadata?.totalSupply ? formatUnits(tokenMetadata.totalSupply, decimals) : "---"}>
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
                        <p className="text-xl font-bold truncate" title={formatUnits(tokenBalance, decimals)}>
                          {formatUnits(tokenBalance, decimals)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Transaction Settings Dialog */}
              {!renderSidebar && (
                <MetaTxSettingsDialog
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                />
              )}

              {/* Only show forms and transaction history in main content */}
              {!renderSidebar && (
                isOwner ? (
                  <Tabs defaultValue="mint" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-background p-1 rounded-lg">
                      <TabsTrigger value="mint" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Mint
                      </TabsTrigger>
                      <TabsTrigger value="burn" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Burn
                      </TabsTrigger>
                      <TabsTrigger value="transfer" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Transfer
                      </TabsTrigger>
                      <TabsTrigger value="approve" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Allowance
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
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="transfer">
                      <Card>
                        <CardHeader>
                          <CardTitle>Transfer Tokens</CardTitle>
                          <CardDescription>
                            Send tokens from your account to another address
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <TransferForm
                            onSubmit={handleTransfer}
                            isLoading={loadingState.transferring}
                            decimals={decimals}
                            maxAmount={tokenBalance}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="approve">
                      <Card>
                        <CardHeader>
                          <CardTitle>Set Token Allowance</CardTitle>
                          <CardDescription>
                            Allow another address to spend tokens on your behalf
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <AllowanceForm
                            onSubmit={handleApprove}
                            isLoading={loadingState.approving}
                            decimals={decimals}
                            maxAmount={tokenBalance}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                ) : (
                  // Non-owner view - regular token holder functions
                  <Tabs defaultValue="transfer" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-background p-1 rounded-lg">
                      <TabsTrigger value="transfer" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Transfer
                      </TabsTrigger>
                      <TabsTrigger value="approve" className="rounded-md data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:font-medium">
                        Allowance
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="transfer">
                      <Card>
                        <CardHeader>
                          <CardTitle>Transfer Tokens</CardTitle>
                          <CardDescription>
                            Send tokens from your account to another address
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <TransferForm
                            onSubmit={handleTransfer}
                            isLoading={loadingState.transferring}
                            decimals={decimals}
                            maxAmount={tokenBalance}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="approve">
                      <Card>
                        <CardHeader>
                          <CardTitle>Set Token Allowance</CardTitle>
                          <CardDescription>
                            Allow another address to spend tokens on your behalf
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <AllowanceForm
                            onSubmit={handleApprove}
                            isLoading={loadingState.approving}
                            decimals={decimals}
                            maxAmount={tokenBalance}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ContractAddressContext.Provider>
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
