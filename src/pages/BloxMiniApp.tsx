import { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Shield, ChevronUp, ChevronDown } from 'lucide-react';
import { useSecureContract } from '@/hooks/useSecureContract';
import type { SecureContractInfo } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { getContractDetails } from '@/lib/catalog';
import type { BloxContract } from '@/lib/catalog/types';
import { initializeUIComponents, getUIComponent } from '@/lib/catalog/bloxUIComponents';
import { useConfig, useChainId, useConnect, useAccount, useDisconnect } from 'wagmi'
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

const BloxMiniApp: React.FC = () => {
  const { type, address } = useParams<{ type: string; address: string }>();
  const { address: connectedAddress } = useAccount();
  const { disconnect } = useDisconnect();
  const [messages, setMessages] = useState<Message[]>([]);

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
  useEffect(() => {
    if (!address || !type || !uiInitialized) return;

    const loadContractInfo = async () => {
      // Skip if we already have the contract info for this address
      if (contractInfo?.contractAddress === address) return;

      setLoading(true);
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
        // If type is not provided in URL, try to get it from contract info
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
      }
    };

    loadContractInfo();
  }, [address, type, uiInitialized, chainId, validateAndLoadContract]);

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

  // Refresh signed transactions
  const refreshSignedTransactions = () => {
    // No-op - the useEffect above will handle the refresh based on transactions changes
  };

  // Create a comprehensive refresh function
  const refreshAllData = async () => {
    if (!address) return;
    
    try {
      // Refresh contract info
      const updatedContractInfo = await validateAndLoadContract(address as `0x${string}`);
      if (updatedContractInfo) {
        setContractInfo(updatedContractInfo);
      }
      
      // Force a refresh of the transactions state
      setTransactionCounter(prev => prev + 1);
      
      // Signal completed refresh
      console.log('Data refreshed at:', new Date().toISOString());
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

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

      await approveOperation(address as `0x${string}`, txId, 'ownership');
      
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

      await cancelOperation(address as `0x${string}`, txId, 'ownership');
      
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

  // Add periodic refresh effect
  useEffect(() => {
    // Only set up refresh if we have an address and contract info
    if (!address || !contractInfo) return;
    
    // Initial refresh when component mounts with contract info
    refreshAllData();
    
    // Set up interval for periodic refreshes (every 15 seconds)
    const intervalId = setInterval(() => {
      refreshAllData();
    }, 15000); // 15 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [address, contractInfo?.contractAddress, transactionCounter]);

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

  // Render the appropriate Blox UI based on type
  const renderBloxUI = () => {
    if (!bloxContract || !contractInfo || !address) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading contract information...</p>
        </div>
      );
    }

    // Get the dynamic UI component
    const BloxUI = getUIComponent(bloxContract.id);
    if (!BloxUI) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">UI component not found for type: {bloxContract.id}</p>
        </div>
      );
    }

    // Render the dynamic component
    return (
      <Suspense fallback={
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading UI component...</p>
        </div>
      }>
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
        />
      </Suspense>
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

  // Function to add messages that can be called from child components
  const addMessage = React.useCallback((message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => {
      // Check if this exact message already exists in the last 5 seconds
      const now = new Date();
      const recentDuplicate = prev.find(m => 
        m.type === message.type &&
        m.title === message.title &&
        m.description === message.description &&
        (now.getTime() - m.timestamp.getTime()) < 5000
      );
      
      if (recentDuplicate) return prev;
      return [{
        ...message,
        timestamp: now
      }, ...prev];
    });
  }, []);

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
                onDisconnect={disconnect}
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
                      refreshAllData(); // Refresh after clearing
                    }}
                    onRemoveTransaction={(txId) => {
                      removeTransaction(txId);
                      refreshAllData(); // Refresh after removing
                    }}
                    contractAddress={address as `0x${string}`}
                    onTxClick={(tx) => {
                      // Navigate to the blox page for withdrawal actions
                      navigate(`/blox/simple-vault/${address}`);
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
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BloxMiniApp; 