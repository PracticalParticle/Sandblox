import { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowLeft, Shield } from 'lucide-react';
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
  const [, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractInfo, setContractInfo] = useState<SecureContractInfo | undefined>(undefined);
  const [bloxContract, setBloxContract] = useState<BloxContract>();
  const [uiInitialized, setUiInitialized] = useState(false);
  const { validateAndLoadContract } = useSecureContract();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const config = useConfig()
  const chainId = useChainId()
  const { connectAsync, connectors } = useConnect()
  const navigate = useNavigate()
  const { toast } = useToast()

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
        const bloxDetails = await getContractDetails(type);
        if (!bloxDetails) {
          throw new Error(`Unknown Blox type: ${type}`);
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
        <div className="flex-1 flex mt-6">
          {/* Left Sidebar */}
          <Card className={`border-r m-4 rounded-lg shadow-lg transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 m-0'}`}>
            <div className="h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Blox Info</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
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
          <div className="flex-1">
            {!isSidebarOpen && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                className="mb-4"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            
            <div className="grid grid-cols-1 gap-4">
              {renderBloxUI()}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BloxMiniApp; 