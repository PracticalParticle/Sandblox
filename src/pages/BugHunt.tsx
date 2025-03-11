import { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Info, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Bug, DollarSign, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useSecureContract } from '@/hooks/useSecureContract';
import type { SecureContractInfo } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { getContractDetails, getAllContracts } from '@/lib/catalog';
import type { BloxContract } from '@/lib/catalog/types';
import { initializeUIComponents, getUIComponent } from '@/lib/catalog/bloxUIComponents';
import { useConfig, useChainId, useConnect } from 'wagmi';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import React from 'react';

interface BugBounty {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: 'active' | 'resolved' | 'expired';
  severity: 'critical' | 'high' | 'medium' | 'low';
  contractType: string;
  contractAddress: string;
  createdAt: Date;
  expiresAt: Date;
}

interface Message {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  timestamp: Date;
}

const BugHunt: React.FC = () => {
  const { type, address } = useParams<{ type: string; address: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractInfo, setContractInfo] = useState<SecureContractInfo>();
  const [bloxContract, setBloxContract] = useState<BloxContract>();
  const [uiInitialized, setUiInitialized] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const { validateAndLoadContract } = useSecureContract();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const config = useConfig();
  const chainId = useChainId();
  const { connectAsync, connectors } = useConnect();
  const navigate = useNavigate();

  // New state for bug bounty form
  const [newBounty, setNewBounty] = useState({
    title: '',
    description: '',
    reward: '',
    severity: 'medium' as BugBounty['severity'],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    contractAddress: '',
    contractType: ''
  });

  // Mock bug bounties data
  const [bugBounties, setBugBounties] = useState<BugBounty[]>([
    {
      id: '1',
      title: 'Simple Vault Hunt',
      description: 'Seeking vulnerabilities in deposit/withdraw mechanisms and access control of the vault contract',
      reward: '100 USDC',
      status: 'active',
      severity: 'critical',
      contractType: 'simple-vault',
      contractAddress: '0x1234...5678',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  ]);

  const [availableBloxTypes, setAvailableBloxTypes] = useState<BloxContract[]>([]);

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
    if (!address || !type || !uiInitialized || hasAttemptedLoad) return;
    loadContractInfo();
  }, [address, type, uiInitialized, hasAttemptedLoad]);

  const loadContractInfo = async () => {
    if (!address || !type || !uiInitialized) return;
    if (contractInfo?.address === address) return;

    setLoading(true);
    setError(null);

    try {
      const info = await validateAndLoadContract(address as `0x${string}`);
      setContractInfo(info);

      // Set the form defaults when contract is loaded
      setNewBounty(prev => ({
        ...prev,
        contractAddress: address || '',
        contractType: type || ''
      }));

      const targetChain = config.chains.find(c => c.id === info.chainId);
      const targetChainName = targetChain?.name || 'Unknown Network';

      if (chainId !== info.chainId) {
        addMessage({
          type: 'warning',
          title: 'Wrong Network',
          description: `This contract is deployed on ${targetChainName}. Please switch networks.`
        });
        
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
      setHasAttemptedLoad(true);
    }
  };

  // Load available Blox types
  useEffect(() => {
    const loadBloxTypes = async () => {
      try {
        const contracts = await getAllContracts();
        setAvailableBloxTypes(contracts);
      } catch (error) {
        console.error('Failed to load Blox types:', error);
        addMessage({
          type: 'error',
          title: 'Loading Failed',
          description: 'Failed to load available Blox types'
        });
      }
    };
    loadBloxTypes();
  }, []);

  const addMessage = React.useCallback((message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => {
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


  // Render the appropriate Blox UI based on type
  const renderBloxUI = () => {
    if (!bloxContract || !contractInfo || !address) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Loading contract information...</p>
        </div>
      );
    }

    const BloxUI = getUIComponent(bloxContract.id);
    if (!BloxUI) {
      return (
        <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">UI component not found for type: {bloxContract.id}</p>
        </div>
      );
    }

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
            addMessage({
              type: 'error',
              title: 'Operation Failed',
              description: error.message || 'Failed to perform operation'
            });
          }}
        />
      </Suspense>
    );
  };

  const handleSubmitBounty = () => {
    const bounty: BugBounty = {
      id: Math.random().toString(36).substr(2, 9),
      ...newBounty,
      status: 'active',
      contractType: newBounty.contractType || type || '',
      contractAddress: newBounty.contractAddress || address || '',
      createdAt: new Date(),
      expiresAt: new Date(newBounty.expiresAt)
    };

    setBugBounties(prev => [bounty, ...prev]);
    setNewBounty({
      title: '',
      description: '',
      reward: '',
      severity: 'medium',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      contractAddress: address || '', // Preserve the current contract address
      contractType: type || '' // Preserve the current contract type
    });

    addMessage({
      type: 'success',
      title: 'Bounty Created',
      description: 'New bug bounty has been created successfully'
    });
  };

  const [selectedBounty, setSelectedBounty] = useState<BugBounty | null>(null);

  // Add handleBountyClick function
  const handleBountyClick = (bounty: BugBounty) => {
    setSelectedBounty(bounty);
    setIsPropertiesOpen(true);
    navigate(`/bug-hunt/${bounty.contractType}/${bounty.contractAddress}`);
  };

  // Function to reset selected bounty
  const handleNewBounty = () => {
    setSelectedBounty(null);
    setNewBounty({
      title: '',
      description: '',
      reward: '',
      severity: 'medium',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      contractAddress: address || '',
      contractType: type || ''
    });
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto flex-1">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <h1 className="text-2xl font-bold">Bug Hunt</h1>
        {contractInfo && chainId !== contractInfo.chainId && (
          <Alert>
            <AlertDescription>
              This contract is deployed on {config.chains.find(c => c.id === contractInfo.chainId)?.name || 'Unknown Network'}. 
              Please switch networks to interact with it.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar - Active Bounties */}
        <Card className={`border-r m-4 rounded-lg shadow-lg transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 m-0'}`}>
          <div className="h-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active Bounties</h2>
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
              <div className="space-y-4">
                {bugBounties.map(bounty => (
                  <Card 
                    key={bounty.id} 
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleBountyClick(bounty)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{bounty.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{bounty.description}</p>
                      </div>
                      <Badge variant={
                        bounty.severity === 'critical' ? 'destructive' :
                        bounty.severity === 'high' ? 'destructive' :
                        bounty.severity === 'medium' ? 'default' :
                        'secondary'
                      }>
                        {bounty.severity}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span>{bounty.reward}</span>
                      </div>
                      <span className="text-muted-foreground">
                        Expires: {new Date(bounty.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </Card>

        {/* Main Workspace */}
        <div className="flex-1 p-4">
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
          <Card className="h-full rounded-lg shadow-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {type ? `${type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}` : 'Contract'}
                  {address && <span className="text-sm text-gray-500 ml-2">({address})</span>}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasAttemptedLoad(false);
                    loadContractInfo();
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin">⟳</div>
                  ) : (
                    <div>⟳</div>
                  )}
                </Button>
              </div>
              <Separator className="my-4" />
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-4">
                {renderBloxUI()}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar - Bug Bounty Details */}
        <Card className="w-72 border-l m-4 rounded-lg shadow-lg">
          <div className="flex flex-col h-full">
            {/* Bug Bounty Form */}
            <Collapsible open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {selectedBounty ? 'Bug Bounty Info' : 'New Bug Bounty'}
                    </h2>
                    {!selectedBounty && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={handleNewBounty}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Bug className="h-5 w-5" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium">Contract Address</label>
                    <Input
                      value={selectedBounty?.contractAddress || newBounty.contractAddress}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, contractAddress: e.target.value }))}
                      placeholder="Enter contract address"
                      disabled={!!selectedBounty || !!address}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Blox Type</label>
                    <div className="relative">
                      <select
                        className="w-full mt-1 appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={selectedBounty?.contractType || newBounty.contractType}
                        onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, contractType: e.target.value }))}
                        disabled={!!selectedBounty || !!type}
                      >
                        <option value="">Select Blox Type</option>
                        {availableBloxTypes.map((blox) => (
                          <option key={blox.id} value={blox.id}>
                            {blox.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={selectedBounty?.title || newBounty.title}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter bounty title"
                      disabled={!!selectedBounty}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={selectedBounty?.description || newBounty.description}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the bug bounty"
                      disabled={!!selectedBounty}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Reward</label>
                    <Input
                      value={selectedBounty?.reward || newBounty.reward}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, reward: e.target.value }))}
                      placeholder="e.g. 1000 USDC"
                      disabled={!!selectedBounty}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Severity</label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={selectedBounty?.severity || newBounty.severity}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ ...prev, severity: e.target.value as BugBounty['severity'] }))}
                      disabled={!!selectedBounty}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Expiry Date</label>
                    <Input
                      type="date"
                      value={(selectedBounty?.expiresAt || newBounty.expiresAt).toISOString().split('T')[0]}
                      onChange={e => !selectedBounty && setNewBounty(prev => ({ 
                        ...prev, 
                        expiresAt: new Date(e.target.value) 
                      }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full mt-1"
                      disabled={!!selectedBounty}
                    />
                  </div>
                  {!selectedBounty && (
                    <Button
                      className="w-full"
                      onClick={handleSubmitBounty}
                      disabled={!newBounty.title || !newBounty.description || !newBounty.reward || !newBounty.contractAddress || !newBounty.contractType}
                    >
                      Create Bounty
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Notifications Section */}
            <Collapsible open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="p-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  {messages.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{messages.length}</Badge>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-[calc(50vh-8rem)] p-4">
                  <div className="space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No notifications to display
                      </p>
                    ) : (
                      messages.map((message, index) => (
                        <Alert 
                          key={index} 
                          variant={message.type === 'error' ? 'destructive' : 'default'}
                        >
                          {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
                          {message.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                          {message.type === 'info' && <Info className="h-4 w-4" />}
                          {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
                          <AlertTitle>{message.title}</AlertTitle>
                          <AlertDescription>
                            {message.description}
                            <div className="text-xs mt-1 opacity-70">
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BugHunt; 