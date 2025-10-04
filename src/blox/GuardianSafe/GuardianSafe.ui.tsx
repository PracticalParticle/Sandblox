"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Address } from "viem";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import GuardianSafe from "./GuardianSafe";
import { useChain } from "@/hooks/useChain";
import { atom, useAtom } from "jotai";
import { AlertCircle, Loader2, Shield, Info, Settings2, Radio } from "lucide-react";
import { ContractInfo as BaseContractInfo } from "@/lib/verification/index";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PendingTransactions } from "./components/PendingTransaction";
import { NotificationMessage, SafeMetaTxParams, SafeTxRecord } from "./lib/types";
import { TransactionManagerProvider } from "@/contexts/MetaTransactionManager";
import { useOperations } from "./hooks/useOperations";
import { GuardianSafeService } from "./lib/services";
import { useWorkflowManager } from "@/hooks/useWorkflowManager";
import { TxStatus } from "../../Guardian/sdk/typescript/types/lib.index";
import { useSafeOwners, useSafeCoreInterface } from "../../blox/GuardianSafe/hooks/useSafeCoreInterface";
import { useSafeTx } from "./hooks/useSafeTx";
import { SafePendingTransactions } from "./components/SafePendingTransactions";
import { GuardInfo } from "./lib/safe/SafeCoreInterface";

// Extend the base ContractInfo interface to include broadcaster and other properties
interface ContractInfo extends BaseContractInfo {
  owner: string;
  broadcaster: string;
  recoveryAddress: string;
  safeAddress: string;
  delegatedCallEnabled: boolean;
  timeLockPeriodInDays: number;
}

// State atoms following cursorrules state management guidelines
const safeInstanceAtom = atom<GuardianSafe | null>(null);
const safeServiceAtom = atom<GuardianSafeService | null>(null);
const pendingTxsAtom = atom<SafeTxRecord[]>([]);

// Loading state atom
const loadingStateAtom = atom<{
  initialization: boolean;
  transactions: boolean;
  delegatedCallToggle: boolean;
  requestTx: boolean;
}>({
  initialization: true,
  transactions: false,
  delegatedCallToggle: false,
  requestTx: false,
});

// Delegated call state atom
const delegatedCallEnabledAtom = atom<boolean>(false);

// Add storage key for meta tx settings
const META_TX_SETTINGS_KEY = 'guardianSafe.metaTxSettings';

// Default meta-transaction settings
const defaultMetaTxSettings: SafeMetaTxParams = {
  deadline: BigInt(3600), // 1 hour in seconds
  maxGasPrice: BigInt(50000000000) // 50 gwei
};

// Settings atom
const metaTxSettingsAtom = atom<SafeMetaTxParams>(defaultMetaTxSettings);

// Component for Meta Transaction Settings Dialog
function MetaTxSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [safeService] = useAtom(safeServiceAtom);
  const [settings, setSettings] = useAtom(metaTxSettingsAtom);
  const [deadline, setDeadline] = useState(() => Number(settings.deadline / BigInt(3600)));
  const [maxGasPrice, setMaxGasPrice] = useState(() => Number(settings.maxGasPrice / BigInt(1000000000)));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      // Try to get stored settings from service if available
      if (safeService) {
        const storedSettings = safeService.getStoredMetaTxSettings();
        setDeadline(Number(storedSettings.deadline / BigInt(3600)));
        setMaxGasPrice(Number(storedSettings.maxGasPrice / BigInt(1000000000)));
      } else {
        setDeadline(Number(settings.deadline / BigInt(3600)));
        setMaxGasPrice(Number(settings.maxGasPrice / BigInt(1000000000)));
      }
    }
  }, [open, settings, safeService]);

  const handleSave = () => {
    // Convert hours to seconds and gwei to wei
    const newSettings: SafeMetaTxParams = {
      deadline: BigInt(deadline * 3600),
      maxGasPrice: BigInt(maxGasPrice * 1000000000)
    };

    // Update state
    setSettings(newSettings);
    
    // Save to local storage via service if available
    if (safeService) {
      safeService.storeMetaTxSettings(newSettings);
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



// Main Component Interface
interface GuardianSafeUIProps {
  contractAddress?: Address;
  contractInfo?: ContractInfo;
  onError?: (error: Error) => void;
  dashboardMode?: boolean;
  renderSidebar?: boolean;
  addMessage?: (message: NotificationMessage) => void;
}

// Main Component Content
function GuardianSafeUIContent({
  contractAddress,
  contractInfo,
  onError,
  dashboardMode = false,
  renderSidebar = false,
  addMessage
}: GuardianSafeUIProps): JSX.Element {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();
  
  // State declarations
  const [safe, setSafe] = useAtom(safeInstanceAtom);
  const [safeService, setSafeService] = useAtom(safeServiceAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [loadingState, setLoadingState] = useAtom(loadingStateAtom);
  const [delegatedCallEnabled, setDelegatedCallEnabled] = useAtom(delegatedCallEnabledAtom);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Workflow manager for role validation
  const { 
    isOwner,
    isBroadcaster,
    isRecovery
  } = useWorkflowManager(contractAddress as Address);
  
  // Safe address ref for display
  const [safeAddress, setSafeAddress] = useState<Address | null>(null);
  
  // Safe owners hook
  const { 
    owners: safeOwners, 
    isLoading: isLoadingOwners, 
    error: ownersError,
    refetch: refetchOwners 
  } = useSafeOwners(safeAddress || undefined);
  
  // Safe pending transactions hook
  const {
    pendingTransactions: safePendingTxs,
    isLoading: isLoadingSafeTxs,
    error: safeTxsError,
    refreshPendingTransactions: refreshSafeTxs
  } = useSafeTx({
    safeAddress: safeAddress || undefined,
    chainId: chain?.id,
    autoRefresh: true,
    refreshInterval: 60000 // 60 seconds
  });
  
  // Safe guard hook for guard management
  const {
    getGuardInfo,
    setGuard,
    removeGuard,
    isOwner: isSafeOwner,
    isLoading: isLoadingGuard,
    error: guardError,
    isInitialized: isSafeInitialized
  } = useSafeCoreInterface(safeAddress || undefined);
  
  // Guard state
  const [guardInfo, setGuardInfo] = useState<GuardInfo | null>(null);
  const [isConnectedWalletSafeOwner, setIsConnectedWalletSafeOwner] = useState<boolean>(false);
  
  // Initialization flag
  const initialLoadDoneRef = useRef(false);

  // Load settings from service when available
  useEffect(() => {
    if (safeService) {
      const storedSettings = safeService.getStoredMetaTxSettings();
      console.log('Loaded meta tx settings:', storedSettings);
    }
  }, [safeService]);

  // Load guard info when Safe address is available
  useEffect(() => {
    if (safeAddress && getGuardInfo && isSafeInitialized) {
      getGuardInfo()
        .then(setGuardInfo)
        .catch(error => {
          console.error('Failed to load guard info:', error);
          addMessage?.({
            type: 'error',
            title: 'Failed to Load Guard Info',
            description: error instanceof Error ? error.message : 'Unknown error occurred'
          });
        });
    }
  }, [safeAddress, getGuardInfo, isSafeInitialized, addMessage]);

  // Check if connected wallet is a Safe owner
  useEffect(() => {
    if (safeAddress && address && isSafeOwner && isSafeInitialized) {
      isSafeOwner(address)
        .then(setIsConnectedWalletSafeOwner)
        .catch(error => {
          console.error('Failed to check if connected wallet is Safe owner:', error);
          setIsConnectedWalletSafeOwner(false);
        });
    } else {
      setIsConnectedWalletSafeOwner(false);
    }
  }, [safeAddress, address, isSafeOwner, isSafeInitialized]);

  // Refresh function to update data
  const refreshData = useCallback(async () => {
    if (!safe || !safeService) {
      console.log("Cannot fetch: safe not initialized");
      return;
    }
    
    setLoadingState(prev => ({ ...prev, transactions: true }));
    
    try {
      // Get delegated call status
      const isDelegatedEnabled = await safeService.isDelegatedCallEnabled();
      setDelegatedCallEnabled(isDelegatedEnabled);
      
      // Get Safe address
      const safeAddr = await safeService.getSafeAddress();
      setSafeAddress(safeAddr);
      
      // Get pending transactions
      const transactions = await safeService.getPendingTransactions();
      setPendingTxs(transactions);
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch safe data:", err);
      setError("Failed to fetch safe data: " + (err.message || String(err)));
      onError?.(new Error("Failed to fetch safe data: " + (err.message || String(err))));
    } finally {
      setLoadingState(prev => ({ ...prev, transactions: false }));
    }
  }, [safe, safeService, setPendingTxs, onError]);

  // Operations hook - moved after refreshData definition
  const {
    handleApproveTransaction,
    handleCancelTransaction,
    handleMetaTxSign,
    handleBroadcastMetaTx,
    loadingStates: operationsLoadingStates,
    handleDelegatedCallToggle,
    formatSafeTxForDisplay,
    signedMetaTxStates,
  } = useOperations({
    contractAddress: contractAddress as Address,
    onSuccess: addMessage,
    onError: addMessage,
    onRefresh: () => refreshData()
  });

  // Initialize the component
  useEffect(() => {
    if (!publicClient || !chain || !contractAddress || initialLoadDoneRef.current) {
      return;
    }

    const initialize = async () => {
      try {
        setLoadingState(prev => ({ ...prev, initialization: true }));
        
        // Create safe instance
        const safeInstance = new GuardianSafe(
          publicClient, 
          walletClient || undefined, 
          contractAddress, 
          chain
        );
        setSafe(safeInstance);
        
        // Create service instance
        const serviceInstance = new GuardianSafeService(
          publicClient,
          walletClient || undefined,
          contractAddress,
          chain
        );
        setSafeService(serviceInstance);

        // Fetch initial data
        // Get delegated call status
        const isDelegatedEnabled = await serviceInstance.isDelegatedCallEnabled();
        setDelegatedCallEnabled(isDelegatedEnabled);
        
        // Get Safe address
        const safeAddr = await serviceInstance.getSafeAddress();
        setSafeAddress(safeAddr);
        
        // Get pending transactions
        const transactions = await serviceInstance.getPendingTransactions();
        setPendingTxs(transactions);
        
        initialLoadDoneRef.current = true;
        setError(null);
      } catch (initError: any) {
        console.error("Failed to initialize safe:", initError);
        setError(`Failed to initialize safe contract: ${initError.message || String(initError)}`);
        onError?.(new Error(`Failed to initialize safe contract: ${initError.message || String(initError)}`));
      } finally {
        setLoadingState(prev => ({ ...prev, initialization: false }));
      }
    };

    initialize();
  }, [publicClient, walletClient, contractAddress, chain, address]);

  // Handle delegated call toggle
  const handleToggleDelegatedCall = useCallback(async (enabled: boolean) => {
    try {
      setLoadingState(prev => ({ ...prev, delegatedCallToggle: true }));
      await handleDelegatedCallToggle(enabled);
    } catch (error: any) {
      console.error('Delegated call toggle error:', error);
      addMessage?.({
        type: 'error',
        title: 'Setting Update Failed',
        description: error.message || 'Failed to update delegated call setting'
      });
    } finally {
      setLoadingState(prev => ({ ...prev, delegatedCallToggle: false }));
    }
  }, [handleDelegatedCallToggle, addMessage]);



  // Filter pending transactions
  const pendingTransactions = useMemo(() => {
    return pendingTxs.filter(tx => tx.status === TxStatus.PENDING);
  }, [pendingTxs]);

  // Calculate time lock period in minutes from days
  const timeLockPeriodInMinutes = useMemo(() => {
    return (contractInfo?.timeLockPeriodInDays || 0) * 24 * 60;
  }, [contractInfo]);

  // Notification handler
  const handleNotification = useCallback((message: NotificationMessage): void => {
    if (addMessage) {
      addMessage(message);
    } else {
      console.log('Notification:', message);
    }
  }, [addMessage]);

  // Loading state
  if (loadingState.initialization) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Initializing safe...</p>
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
            // Reinitialize the safe
            const initializeSafe = async () => {
              if (!publicClient || !chain || !contractAddress) return;
              try {
                const safeInstance = new GuardianSafe(
                  publicClient, 
                  walletClient || undefined, 
                  contractAddress, 
                  chain
                );
                setSafe(safeInstance);
                
                const serviceInstance = new GuardianSafeService(
                  publicClient,
                  walletClient || undefined,
                  contractAddress,
                  chain
                );
                setSafeService(serviceInstance);
                
                setError(null);
              } catch (err: any) {
                console.error("Failed to initialize safe:", err);
                setError("Failed to initialize safe contract");
                onError?.(new Error("Failed to initialize safe contract"));
              } finally {
                setLoadingState(prev => ({ ...prev, initialization: false }));
              }
            };
            initializeSafe();
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

  // Render sidebar content
  if (renderSidebar) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">SAFE INFO</h3>
          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Safe Address:</span>
                <span className="text-sm font-mono truncate max-w-[200px]">{safeAddress || 'Loading...'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delegated Call:</span>
                <span className="text-sm">{delegatedCallEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Time Lock:</span>
                <span className="text-sm">{contractInfo?.timeLockPeriodInDays || 0} days</span>
              </div>
            </div>
          </Card>
        </div>

        {pendingTransactions.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">PENDING TRANSACTIONS</h3>
            <div className="text-sm text-muted-foreground">
              {pendingTransactions.length} transaction{pendingTransactions.length !== 1 ? 's' : ''} pending
            </div>
          </div>
        )}

        {safePendingTxs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">SAFE PENDING TRANSACTIONS</h3>
            <div className="text-sm text-muted-foreground">
              {safePendingTxs.length} transaction{safePendingTxs.length !== 1 ? 's' : ''} pending
            </div>
          </div>
        )}

        {safeOwners.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">SAFE OWNERS</h3>
            <Card className="p-3">
              <div className="space-y-2">
                {safeOwners.map((owner: Address, index: number) => (
                  <div key={owner} className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Owner {index + 1}:</span>
                      {address && owner.toLowerCase() === address.toLowerCase() && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Connected wallet"></div>
                      )}
                    </div>
                    <span className="text-xs font-mono truncate max-w-[120px]" title={owner}>
                      {owner.slice(0, 6)}...{owner.slice(-4)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Fix the network warning JSX
  return (
    <TooltipProvider>
      <div className="h-full overflow-auto">
      {chain?.id && contractInfo?.chainId && chain.id !== contractInfo.chainId && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            This safe was deployed on {contractInfo?.chainName || 'unknown network'}. Please switch to the correct network to perform operations.
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
                <h2 className="text-lg font-semibold">Guardian Safe</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Secure transaction management with time-locked operations</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loadingState.transactions || !safe}
              >
                {loadingState.transactions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
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
            </div>
          </CardHeader>

          {/* Meta Transaction Settings Dialog */}
          <MetaTxSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />

          <CardContent>
            <div className="space-y-6">
              {/* Safe address */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">SAFE ADDRESS</h3>
                <div className="rounded-md border p-3">
                  <p className="font-mono text-sm truncate" title={safeAddress || "Not available"}>
                    {safeAddress || "Not available"}
                  </p>
                </div>
              </div>

              {/* Delegated Call Toggle (Only for owner) */}
              {isOwner && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">SETTINGS</h3>
                  <div className="rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="delegated-call">Delegated Call</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable delegate call operations
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id="delegated-call"
                          type="checkbox"
                          checked={delegatedCallEnabled}
                          onChange={(e) => handleToggleDelegatedCall(e.target.checked)}
                          disabled={loadingState.delegatedCallToggle}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">
                          {delegatedCallEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                             {/* Safe Pending Transactions */}
               {safeAddress && (
                 <div className="space-y-2">
                   <SafePendingTransactions
                     pendingTransactions={safePendingTxs}
                     isLoading={isLoadingSafeTxs}
                     error={safeTxsError}
                     onRefresh={refreshSafeTxs}
                     safeAddress={safeAddress}
                     chainId={chain?.id}
                     connectedAddress={address}
                     contractAddress={contractAddress}
                     onNotification={addMessage}
                   />
                 </div>
               )}

              {/* Pending Transactions */}
              <div className="space-y-2">
                <PendingTransactions
                  transactions={pendingTransactions}
                  isLoadingTx={loadingState.transactions}
                  onRefresh={refreshData}
                  onApprove={handleApproveTransaction}
                  onCancel={handleCancelTransaction}
                  onMetaTxSign={handleMetaTxSign}
                  onBroadcastMetaTx={handleBroadcastMetaTx}
                  signedMetaTxStates={signedMetaTxStates}
                  isLoading={operationsLoadingStates.approval[0] || operationsLoadingStates.cancellation[0]}
                  contractAddress={contractAddress as Address}
                  onNotification={handleNotification}
                  connectedAddress={address}
                  timeLockPeriodInMinutes={timeLockPeriodInMinutes}
                  formatSafeTxForDisplay={formatSafeTxForDisplay}
                />
              </div>

              {/* Safe Owners Information */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">SAFE OWNERS</h3>
                  {isLoadingOwners && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {ownersError && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Error loading owners: {ownersError?.message || 'Unknown error'}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="rounded-md border p-4">
                  {safeOwners.length > 0 ? (
                    <div className="space-y-3">
                                             {safeOwners.map((owner: Address, index: number) => (
                         <div key={owner} className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                               {index + 1}
                             </div>
                             <span className="text-sm font-medium">Owner {index + 1}</span>
                             {address && owner.toLowerCase() === address.toLowerCase() && (
                               <div className="w-2 h-2 rounded-full bg-green-500" title="Connected wallet"></div>
                             )}
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="font-mono text-sm" title={owner}>
                               {owner.slice(0, 6)}...{owner.slice(-4)}
                             </span>
                             <Button
                               variant="ghost"
                               size="sm"
                               className="h-6 w-6 p-0"
                               onClick={() => navigator.clipboard.writeText(owner)}
                               title="Copy address"
                             >
                               📋
                             </Button>
                           </div>
                         </div>
                       ))}
                    </div>
                  ) : isLoadingOwners ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Loading Safe owners...</p>
                    </div>
                  ) : ownersError ? (
                    <div className="text-center py-4">
                      <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Failed to load Safe owners</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => refetchOwners()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No owners found
                    </p>
                  )}
                </div>
              </div>

              {/* Guard Management Section */}
              {isOwner && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">TRANSACTION GUARD</h3>
                    {isLoadingGuard && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {guardError && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Error loading guard info: {guardError?.message || 'Unknown error'}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="space-y-4">
                      {/* Current Guard Status */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Current Guard</p>
                          <p className="text-xs text-muted-foreground">
                            {guardInfo ? (
                              guardInfo.guardAddress && guardInfo.guardAddress !== '0x0000000000000000000000000000000000000000' ? (
                                <>
                                  {guardInfo.guardAddress.slice(0, 6)}...{guardInfo.guardAddress.slice(-4)}
                                  {guardInfo.guardAddress === contractAddress && (
                                    <span className="ml-2 text-green-600">(GuardianSafe)</span>
                                  )}
                                </>
                              ) : (
                                'No guard set'
                              )
                            ) : isLoadingGuard ? (
                              'Loading...'
                            ) : (
                              'Unknown'
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {guardInfo?.guardAddress && guardInfo.guardAddress === contractAddress ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await removeGuard();
                                  addMessage?.({
                                    type: 'success',
                                    title: 'Guard Removed',
                                    description: 'GuardianSafe has been removed as the transaction guard.'
                                  });
                                  // Refresh guard info
                                  const newGuardInfo = await getGuardInfo();
                                  setGuardInfo(newGuardInfo);
                                } catch (error) {
                                  addMessage?.({
                                    type: 'error',
                                    title: 'Failed to Remove Guard',
                                    description: error instanceof Error ? error.message : 'Unknown error occurred'
                                  });
                                }
                              }}
                              disabled={isLoadingGuard || !isConnectedWalletSafeOwner}
                            >
                              Remove Guard
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={async () => {
                                if (!contractAddress) {
                                  addMessage?.({
                                    type: 'error',
                                    title: 'Error',
                                    description: 'Contract address not available'
                                  });
                                  return;
                                }
                                try {
                                  // contractAddress is the GuardianSafe contract address
                                  // We want to set this GuardianSafe as a guard on the underlying Safe
                                  // The safeAddress should already be set to the underlying Safe from the contract
                                  const safeTxHash = await setGuard(contractAddress);
                                  addMessage?.({
                                    type: 'success',
                                    title: 'Guard Transaction Executed',
                                    description: `Guard set successfully! Transaction Hash: ${safeTxHash}. The GuardianSafe contract (${contractAddress}) is now protecting the underlying Safe.`
                                  });
                                  // Refresh guard info after a short delay to check if it was executed immediately
                                  setTimeout(async () => {
                                    try {
                                      const newGuardInfo = await getGuardInfo();
                                      setGuardInfo(newGuardInfo);
                                    } catch (refreshError) {
                                      console.warn('Failed to refresh guard info:', refreshError);
                                    }
                                  }, 3000);
                                } catch (error) {
                                  addMessage?.({
                                    type: 'error',
                                    title: 'Failed to Propose Guard Transaction',
                                    description: error instanceof Error ? error.message : 'Unknown error occurred'
                                  });
                                }
                              }}
                              disabled={isLoadingGuard || !contractAddress || !isConnectedWalletSafeOwner}
                            >
                              Set GuardianSafe as Guard
                            </Button>
                          )}
                        </div>
                      </div>
                      
                                             {/* Guard Information */}
                       {guardInfo?.guardAddress && (
                         <div className="pt-4 border-t">
                           <p className="text-xs text-muted-foreground">
                             <strong>Note:</strong> When GuardianSafe is set as a transaction guard, 
                             all Safe transactions will be validated by the GuardianSafe contract 
                             before execution. This provides an additional layer of security 
                             and enables time-locked operations.
                           </p>
                         </div>
                       )}
                       
                       {/* Permission Information */}
                       {!isConnectedWalletSafeOwner && (
                         <div className="pt-4 border-t">
                           <p className="text-xs text-muted-foreground">
                             <strong>Permission Required:</strong> Only Safe owners can set or remove transaction guards. 
                             Please connect with a wallet that is an owner of this Safe.
                           </p>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}

              {/* Role Information */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">YOUR ROLES</h3>
                <div className="rounded-md border p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOwner ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        <Shield className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-sm font-medium">Owner</p>
                      <p className="text-xs text-muted-foreground">{isOwner ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBroadcaster ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                        <Radio className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-sm font-medium">Broadcaster</p>
                      <p className="text-xs text-muted-foreground">{isBroadcaster ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecovery ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                        <Shield className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-sm font-medium">Recovery</p>
                      <p className="text-xs text-muted-foreground">{isRecovery ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  );
}

// Main export with TransactionManagerProvider
export default function GuardianSafeUI(props: GuardianSafeUIProps) {
  return (
    <TransactionManagerProvider>
      <GuardianSafeUIContent {...props} />
    </TransactionManagerProvider>
  );
}
