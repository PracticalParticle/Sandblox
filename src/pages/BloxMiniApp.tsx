import { useState, useEffect, Suspense, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Shield, ChevronUp, ChevronDown } from 'lucide-react';
import { useSecureContract } from '@/hooks/useSecureContract';
import type { SecureContractInfo } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { getContractDetails } from '@/lib/catalog';
import type { BloxContract } from '@/lib/catalog/types';
import { getUIComponent, initializeUIComponents } from '@/lib/catalog/bloxUIComponents';
import type { BloxUIProps } from '@/lib/catalog/bloxUIComponents';
import { useConfig, useChainId, useConnect, useAccount, useDisconnect, usePublicClient, useWalletClient } from 'wagmi'
import React from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { ContractInfo } from '@/components/ContractInfo';
import { WalletStatusBadge } from '@/components/WalletStatusBadge';
import { SignedMetaTxTable, ExtendedSignedTransaction } from '@/components/SignedMetaTxTable';
import { OpHistory } from '@/components/OpHistory';
import { useTransactionManager } from '@/hooks/useTransactionManager';
import { useOperationTypes } from '@/hooks/useOperationTypes';
import { Hex } from 'viem';
import { TxRecord } from '@/particle-core/sdk/typescript/interfaces/lib.index';
import { useChain } from '@/hooks/useChain';
import SimpleVault from '@/blox/SimpleVault/SimpleVault';
import { useMetaTxActions } from '@/blox/SimpleVault/hooks/useMetaTxActions';
import { PendingTransactionDialog } from '@/components/PendingTransactionDialog';
import { VaultTxRecord } from '@/blox/SimpleVault/components/PendingTransaction';
import { TransactionManager } from '@/services/TransactionManager';

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// Helper function to format time values

interface Message {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  timestamp: Date;
}

// Add this interface near your other interfaces (before the component)
interface StoredTransaction {
  signedData: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const BloxMiniApp: React.FC = () => {
  const { type, address } = useParams<{ type: string; address: string }>();
  const { address: connectedAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const [, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | undefined>(undefined);
  const [bloxContract, setBloxContract] = useState<BloxContract>();
  const [uiInitialized, setUiInitialized] = useState(false);
  const { validateAndLoadContract, approveOperation, cancelOperation } = useSecureContract();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const config = useConfig()
  const chainId = useChainId()
  const { connectAsync, connectors } = useConnect()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { transactions = {}, clearTransactions, removeTransaction } = useTransactionManager(address || '');
  const [signedTransactions, setSignedTransactions] = useState<ExtendedSignedTransaction[]>([]);
  const { getOperationName } = useOperationTypes(address as `0x${string}`);
  
  // Add new state for mobile view
  const [isMobileView, setIsMobileView] = useState(false);
  const [bloxUiLoading, setBloxUiLoading] = useState(true);

  // Add a new state for tracking transaction changes
  const [transactionCounter, setTransactionCounter] = useState(0);

  // Add the required hooks for SimpleVault operations
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chain = useChain();

  // Add useEffect to handle screen size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      // Set default sidebar state based on screen size
      setIsSidebarOpen(window.innerWidth >= 768);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize UI components on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeUIComponents();
        setUiInitialized(true);
      } catch (error) {
        console.error('Failed to initialize UI components:', error);
        setError('Failed to initialize UI components');
        addMessage({
          type: 'error',
          title: 'Initialization Failed',
          description: 'Failed to initialize UI components'
        });
      }
    };
    init();
  }, []);

  // Load contract info and blox details
  const loadContractInfo = async () => {
    if (!address || !uiInitialized) return;

    // Skip if we already have the contract info for this address
    if (contractInfo?.contractAddress === address) {
      setBloxUiLoading(false); // Make sure to set loading to false if we already have the contract
      return;
    }

    setLoading(true);
    setBloxUiLoading(true);
    setError(null);

    try {
      // Load secure contract info
      const info = await validateAndLoadContract(address as `0x${string}`);
      if (!info) {
        throw new Error('Contract info not found');
      }
      
      // Ensure all required fields are present
      if (!info.owner || !info.broadcaster || !info.recoveryAddress) {
        throw new Error('Invalid contract info - missing required fields');
      }

      setContractInfo(info);

      // Get chain name for error messages
      const targetChain = config.chains.find(c => c.id === info.chainId);
      const targetChainName = targetChain?.name || 'Unknown Network';

      // Only show network warning if chain is wrong
      if (chainId !== info.chainId) {
        addMessage({
          type: 'warning',
          title: 'Wrong Network',
          description: `This contract is deployed on ${targetChainName}. Please switch networks.`
        });
        
        // Find a connector that supports network switching
        const connector = connectors.find(c => c.id === 'injected')
        if (connector) {
          try {
            await connectAsync({ 
              connector,
              chainId: info.chainId 
            });
          } catch (error) {
            console.error('Failed to switch network:', error);
          }
        }
      }

      // Load blox contract details from catalog
      const contractType = type || info.type;
      if (!contractType) {
        throw new Error('Contract type not found');
      }

      const bloxDetails = await getContractDetails(contractType);
      if (!bloxDetails) {
        throw new Error(`Unknown Blox type: ${contractType}`);
      }
      setBloxContract(bloxDetails);
    } catch (error) {
      console.error('Error loading contract:', error);
      setError(error instanceof Error ? error.message : 'Failed to load contract details');
      addMessage({
        type: 'error',
        title: 'Loading Failed',
        description: error instanceof Error ? error.message : 'Failed to load contract details'
      });
    } finally {
      setLoading(false);
      setBloxUiLoading(false);
    }
  };

  // Update the useEffect to call the standalone function
  useEffect(() => {
    if (!address || !uiInitialized) return;
    
    // Load contract info when component mounts or when address/uiInitialized changes
    loadContractInfo();
    
    // Add a fallback timeout to ensure loading state is reset even if something goes wrong
    const timeoutId = setTimeout(() => {
      if (bloxUiLoading) {
        console.warn('Forced reset of loading state after timeout');
        setBloxUiLoading(false);
      }
    }, 10000); // 10 second fallback
    
    return () => clearTimeout(timeoutId);
  }, [address, uiInitialized]);

  // Add a separate effect for type changes
  useEffect(() => {
    if (!address || !type || !uiInitialized) return;
    if (bloxContract?.id !== type) {
      loadContractInfo();
    }
  }, [type]);

  // Transform raw transactions to ExtendedSignedTransaction format
  useEffect(() => {
    if (!transactions) return;
    
    const txArray: ExtendedSignedTransaction[] = Object.entries(transactions).map(([txId, txData]) => ({
      txId,
      signedData: txData.signedData,
      timestamp: txData.timestamp,
      metadata: txData.metadata as ExtendedSignedTransaction['metadata']
    }));
    
    setSignedTransactions(txArray);
  }, [transactions]);

  // Create a comprehensive refresh function
  const refreshAllData = useCallback(async () => {
    if (!address) return;
    
    try {
      // Refresh contract info
      const updatedContractInfo = await validateAndLoadContract(address as `0x${string}`);
      if (updatedContractInfo) {
        setContractInfo(updatedContractInfo);
      }
      
      // Signal completed refresh
      console.log('Data refreshed at:', new Date().toISOString());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [address]);

  // Add periodic refresh effect
  useEffect(() => {
    // Only set up refresh if we have an address and contract info
    if (!address || !contractInfo) return;
    
    // Initial refresh when component mounts with contract info
    refreshAllData();
    
    // Set up interval for periodic refreshes (every 15 seconds)
    const intervalId = setInterval(refreshAllData, 15000); // 15 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [address, contractInfo?.contractAddress]); // Remove transactionCounter dependency

  // Add effect for transaction counter changes
  useEffect(() => {
    if (transactionCounter > 0) {
      // Add a small delay to prevent immediate refresh
      const timeoutId = setTimeout(refreshAllData, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [transactionCounter, refreshAllData]);

  // Update the handleApproveOperation function
  const handleApproveOperation = async (txId: number) => {
    try {
      if (!contractInfo || !connectedAddress || !address) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      // Find the transaction to determine the operation type
      const transaction = contractInfo.operationHistory.find((op: TxRecord) => Number(op.txId) === txId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      const operationName = getOperationName(transaction.params.operationType as Hex);
      
      // Check if this is a withdrawal operation
      const isWithdrawal = 
        operationName === 'WITHDRAW_ETH' || operationName === 'WITHDRAW_TOKEN';
      
      if (isWithdrawal) {
        // For withdrawals, use SimpleVault contract directly
        if (!publicClient || !walletClient || !chain) {
          throw new Error("Wallet not connected or chain not found");
        }
        
        // Initialize SimpleVault contract
        const vault = new SimpleVault(publicClient, walletClient, address as `0x${string}`, chain);
        
        // Call the approveWithdrawalAfterDelay method
        const tx = await vault.approveWithdrawalAfterDelay(Number(txId), { from: connectedAddress });
        await tx.wait();
      } else {
        // For other operations, use the standard approveOperation
        const operationType = 'ownership'; // Default to ownership for non-withdrawal operations
        await approveOperation(address as `0x${string}`, txId, operationType);
      }
      
      toast({
        title: "Success",
        description: "Operation approved successfully",
      });

      // Refresh all data after operation completes
      await refreshAllData();
    } catch (error) {
      console.error('Failed to approve operation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to approve operation',
        variant: "destructive"
      });
    }
  };

  // Update the handleCancelOperation function
  const handleCancelOperation = async (txId: number) => {
    try {
      if (!contractInfo || !connectedAddress || !address) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive"
        });
        return;
      }

      // Find the transaction to determine the operation type
      const transaction = contractInfo.operationHistory.find((op: TxRecord) => Number(op.txId) === txId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      const operationName = getOperationName(transaction.params.operationType as Hex);
      
      // Check if this is a withdrawal operation
      const isWithdrawal = 
        operationName === 'WITHDRAW_ETH' || operationName === 'WITHDRAW_TOKEN';
      
      if (isWithdrawal) {
        // For withdrawals, use SimpleVault contract directly
        if (!publicClient || !walletClient || !chain) {
          throw new Error("Wallet not connected or chain not found");
        }
        
        // Initialize SimpleVault contract
        const vault = new SimpleVault(publicClient, walletClient, address as `0x${string}`, chain);
        
        // Call the cancelWithdrawal method
        const tx = await vault.cancelWithdrawal(Number(txId), { from: connectedAddress });
        await tx.wait();
      } else {
        // For other operations, use the standard cancelOperation
        const operationType = 'ownership'; // Default to ownership for non-withdrawal operations
        await cancelOperation(address as `0x${string}`, txId, operationType);
      }
      
      toast({
        title: "Success",
        description: "Operation cancelled successfully",
      });

      // Refresh all data after operation completes
      await refreshAllData();
    } catch (error) {
      console.error('Failed to cancel operation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to cancel operation',
        variant: "destructive"
      });
    }
  };

  // Filter transactions and operations for withdrawals only
  const withdrawalTransactions = signedTransactions.filter(tx => {
    // Check explicit WITHDRAWAL_APPROVAL type
    if (tx.metadata?.type === 'WITHDRAWAL_APPROVAL') {
      return true;
    }
    
    // Check using operation type if available
    if (tx.metadata?.operationType) {
      const operationName = getOperationName(tx.metadata.operationType);
      return operationName === 'WITHDRAW_ETH' || 
             operationName === 'WITHDRAW_TOKEN' || 
             operationName === 'WITHDRAWAL_APPROVAL';
    }
    
    return false;
  });

  // Function to check if an operation is a withdrawal
  const isWithdrawalOperation = (operationType: Hex): boolean => {
    const operationName = getOperationName(operationType);
    return operationName === 'WITHDRAW_ETH' || operationName === 'WITHDRAW_TOKEN';
  };

  // Function to add messages that can be called from child components
  const addMessage = React.useCallback((message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => {
      const now = new Date();
      const recentDuplicate = prev.find(m => 
        m.type === message.type &&
        m.title === message.title &&
        m.description === message.description &&
        (now.getTime() - m.timestamp.getTime()) < 5000
      );

      if (recentDuplicate) return prev; // Return previous state if duplicate found
      return [{
        ...message,
        timestamp: now
      }, ...prev]; // Return new state array
    });
  }, []);

  // Update the handleDisconnect function
  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: "Disconnected",
        description: "Wallet disconnected successfully",
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect wallet",
        variant: "destructive"
      });
    }
  };

  // Render the appropriate Blox UI based on type
  const renderBloxUI = () => {
    if (bloxUiLoading) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading BloxUI component...</p>
        </div>
      );
    }

    const secureContractInfo = contractInfo as SecureContractInfo;
    if (!secureContractInfo || !bloxContract || !address) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">No contract information available</p>
        </div>
      );
    }

    // Get the UI component based on the contract type
    const BloxUIComponent = getUIComponent(bloxContract.id);
    if (!BloxUIComponent) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">No UI component found for this contract type</p>
        </div>
      );
    }

    // We've already checked that contractInfo is not null above
    const contractUIInfo = {
      address: address as `0x${string}`,
      type: bloxContract.id,
      name: bloxContract.name,
      category: bloxContract.category,
      description: bloxContract.description,
      bloxId: bloxContract.id,
      chainId: secureContractInfo.chainId,
      chainName: secureContractInfo.chainName
    } satisfies BloxUIProps['contractInfo'];

    return (
      <BloxUIComponent
        contractAddress={address as `0x${string}`}
        contractInfo={contractUIInfo}
        onError={(error: Error) => {
          addMessage({
            type: 'error',
            title: 'Error',
            description: error.message
          });
        }}
      />
    );
  };

  // Optimize loading by separating UI component loading from data loading
  useEffect(() => {
    // Set loading to false once we have contract info, even if BloxUI is still loading
    if (contractInfo && loading) {
      // Use a short timeout to ensure tables render quickly
      setTimeout(() => setLoading(false), 100);
    }
  }, [contractInfo, loading]);

  // Modify the chain ID warning effect to prevent repeated warnings
  useEffect(() => {
    if (!contractInfo || !chainId) return;
    
    // Only show warning if chain changes after initial load
    if (chainId !== contractInfo.chainId) {
      const targetChain = config.chains.find(c => c.id === contractInfo.chainId);
      addMessage({
        type: 'warning',
        title: 'Wrong Network',
        description: `This contract is deployed on ${targetChain?.name || 'Unknown Network'}. Please switch networks.`
      });
    }
  }, [chainId, contractInfo?.chainId]);

  // Add meta transaction handlers using the useMetaTxActions hook
  const {
    handleMetaTxSign: handleMetaTxSignBase,
    handleBroadcastMetaTx,
    signedMetaTxStates: metaTxStates,
    isLoading: isMetaTxLoading
  } = useMetaTxActions(
    address as `0x${string}`,
    addMessage,  // onSuccess
    addMessage,  // onError
    refreshAllData // onRefresh
  );

  // Wrap the base function to include any additional logic if needed
  const handleMetaTxSign = async (tx: VaultTxRecord, type: 'approve' | 'cancel') => {
    await handleMetaTxSignBase(tx, type);
    
    // After signing, immediately refresh the local transactions
    refreshLocalTransactions();
  };

  // Transform contractInfo to match expected type
  const dialogContractInfo = React.useMemo(() => {
    if (!contractInfo) return null;
    return {
      contractAddress: contractInfo.contractAddress as `0x${string}`,
      timeLockPeriodInMinutes: contractInfo.timeLockPeriodInMinutes,
      chainId: contractInfo.chainId,
      chainName: contractInfo.chainName,
      broadcaster: contractInfo.broadcaster as `0x${string}`,
      owner: contractInfo.owner as `0x${string}`,
      recoveryAddress: contractInfo.recoveryAddress as `0x${string}`
    };
  }, [contractInfo]);

  // Update the PendingTransactionDialog usage
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedSignedTransaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Add a manual refresh function

  // Add a useEffect to listen for local storage changes
  useEffect(() => {
    // Define a handler for storage events
    const handleStorageChange = (event: StorageEvent) => {
      // Check if the change is related to our transactions
      if (event.key && event.key.includes('transactions')) {
        console.log('Storage changed for transactions, refreshing transaction data');
        
        if (address) {
          // Only update the specific transactions for this contract
          const txManager = new TransactionManager();
          const latestTxs = txManager.getSignedTransactionsByContract(address);
          
          // Convert to array format with proper typing
          const txArray = Object.entries(latestTxs).map(([txId, txData]) => ({
            txId,
            signedData: (txData as StoredTransaction).signedData,
            timestamp: (txData as StoredTransaction).timestamp,
            metadata: (txData as StoredTransaction).metadata as ExtendedSignedTransaction['metadata']
          }));
          
          // Update the state with the latest transactions
          setSignedTransactions(txArray);
        }
      }
    };

    // Add event listener for storage events
    window.addEventListener('storage', handleStorageChange);
    
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [address]);

  // Add a function to force refresh transaction data from local storage
  const refreshLocalTransactions = () => {
    if (!address) return;
    
    const txManager = new TransactionManager();
    const latestTxs = txManager.getSignedTransactionsByContract(address);
    
    // Convert to array format with proper typing
    const txArray = Object.entries(latestTxs).map(([txId, txData]) => ({
      txId,
      signedData: (txData as StoredTransaction).signedData,
      timestamp: (txData as StoredTransaction).timestamp,
      metadata: (txData as StoredTransaction).metadata as ExtendedSignedTransaction['metadata']
    }));
    
    setSignedTransactions(txArray);
  };

  return (
    <div className="container py-8">
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-[64px] z-40 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start lg:items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="mr-4 hidden lg:flex"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-3 lg:space-y-2">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/dashboard')}
                    className="lg:hidden h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Blox Mini App</h1>
                </div>
              </div>
            </div>
            {connectedAddress && (
              <WalletStatusBadge
                connectedAddress={connectedAddress}
                contractInfo={contractInfo as SecureContractInfo}
                onDisconnect={handleDisconnect}
              />
            )}
          </div>
        </motion.div>
      
        {/* Contract Info & Security Settings */}
        <motion.div variants={item} className="mt-6">
          <ContractInfo 
            address={address} 
            contractInfo={contractInfo as SecureContractInfo} 
            connectedAddress={connectedAddress}
            navigationIcon={<Shield className="h-4 w-4" />}
            navigationTooltip="Security Settings"
            navigateTo={`/blox-security/${address}`}
          />
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row mt-6">
          {/* Collapse/Expand Button for Mobile */}
          {isMobileView && (
            <Button
              variant="outline"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mb-4 w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Blox Info
              </span>
              {isSidebarOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Sidebar */}
          <Card 
            className={`
              transition-all duration-300
              ${isMobileView 
                ? `w-full ${isSidebarOpen 
                    ? 'max-h-[500px] mb-4' 
                    : 'max-h-0 overflow-hidden opacity-0 m-0 p-0'}`
                : `border-r rounded-lg shadow-lg ${isSidebarOpen 
                    ? 'w-80 m-4' 
                    : 'w-0 opacity-0 m-0 p-0'}`
              }
            `}
          >
            <div className={`h-full ${!isSidebarOpen ? 'hidden' : ''}`}>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Blox Info</h2>
                {!isMobileView && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(false)}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[calc(100%-3rem)] p-4">
                {!loading && !error && bloxContract && (
                  <Suspense fallback={
                    <div className="flex items-center justify-center py-4">
                      <p className="text-sm text-muted-foreground">Loading sidebar...</p>
                    </div>
                  }>
                    {(() => {
                      const BloxUI = getUIComponent(bloxContract.id);
                      if (!BloxUI) return null;
                      return (
                        <BloxUI 
                          contractAddress={address as `0x${string}`}
                          contractInfo={{
                            address: address as `0x${string}`,
                            type: bloxContract.id,
                            name: bloxContract.name,
                            category: bloxContract.category,
                            description: bloxContract.description,
                            bloxId: bloxContract.id,
                            chainId: (contractInfo as SecureContractInfo).chainId,
                            chainName: (contractInfo as SecureContractInfo).chainName
                          }}
                          onError={(error: Error) => {
                            toast({
                              title: "Operation Failed",
                              description: error.message || 'Failed to perform operation',
                              variant: "destructive"
                            });
                          }}
                          renderSidebar
                        />
                      );
                    })()}
                  </Suspense>
                )}
              </ScrollArea>
            </div>
          </Card>

          {/* Main Workspace */}
          <div className="flex-1 pl-0">
            {!isMobileView && !isSidebarOpen && (
              <Button
                variant="outline"
                onClick={() => setIsSidebarOpen(true)}
                className="mb-4 ml-4 flex items-center gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                <span>Show Blox Info</span>
              </Button>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              {/* Render BloxUI separately with its own loading state */}
              <div className="relative">
                {renderBloxUI()}
              </div>
              
              {/* Pending Meta Transactions for Withdrawals - render immediately when data is available */}
              {contractInfo && withdrawalTransactions.length > 0 && (
                <motion.div variants={item} className="mt-6">
                  <SignedMetaTxTable
                    transactions={withdrawalTransactions}
                    onClearAll={() => {
                      clearTransactions();
                      refreshAllData();
                    }}
                    onRemoveTransaction={(txId) => {
                      removeTransaction(txId);
                      refreshAllData();
                    }}
                    contractAddress={address as `0x${string}`}
                    onTxClick={(tx) => {
                      setSelectedTransaction(tx);
                      setIsDialogOpen(true);
                    }}
                  />
                </motion.div>
              )}

              {/* Withdrawal Operations History - render immediately when data is available */}
              {contractInfo && (
                <motion.div variants={item} className="mt-6">
                  <OpHistory
                    contractAddress={address as `0x${string}`}
                    operations={contractInfo.operationHistory.filter((op: TxRecord) => 
                      isWithdrawalOperation(op.params.operationType as Hex)
                    )}
                    isLoading={false} // Set to false since we're controlling visibility with the conditional rendering
                    contractInfo={contractInfo}
                    signedTransactions={withdrawalTransactions}
                    onApprove={handleApproveOperation}
                    onCancel={handleCancelOperation}
                    refreshData={refreshAllData} // Use the comprehensive refresh function
                    refreshSignedTransactions={refreshAllData} // Use the same function for consistency
                  />
                </motion.div>
              )}

              {/* Update the PendingTransactionDialog usage */}
              {selectedTransaction && dialogContractInfo && (
                <PendingTransactionDialog
                  isOpen={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  title={`Pending Transaction #${selectedTransaction.txId}`}
                  description="Review and manage this withdrawal transaction"
                  contractInfo={dialogContractInfo}
                  transaction={selectedTransaction as unknown as VaultTxRecord}
                  onApprove={handleApproveOperation}
                  onCancel={handleCancelOperation}
                  onMetaTxSign={handleMetaTxSign}
                  onBroadcastMetaTx={handleBroadcastMetaTx}
                  onNotification={addMessage}
                  isLoading={isMetaTxLoading}
                  connectedAddress={connectedAddress}
                  signedMetaTxStates={metaTxStates}
                  showMetaTxOption={true}
                  refreshData={refreshAllData}
                  mode="timelock"
                />
              )}

              
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BloxMiniApp; 