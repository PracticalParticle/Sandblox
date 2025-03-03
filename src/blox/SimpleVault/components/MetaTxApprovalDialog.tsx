import * as React from "react";
import { useState, useEffect, ReactNode } from "react";
import { Address, Chain } from "viem";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, AlertCircle, Wallet, Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SingleWalletManagerProvider, useSingleWallet } from '@/components/SingleWalletManager';
import SimpleVault from "../SimpleVault";
import { usePublicClient, useWalletClient, useChainId } from "wagmi";

// Helper function to format addresses
const formatAddress = (address: string | undefined | null): string => {
  if (!address || typeof address !== 'string' || address.length < 10) {
    return address || 'Invalid address';
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Helper function to normalize Ethereum addresses for comparison
const normalizeAddress = (address: string | undefined | null): string => {
  if (!address || typeof address !== 'string') {
    return '';
  }
  
  // Remove '0x' prefix if present and convert to lowercase
  return address.toLowerCase().replace(/^0x/, '');
};

// Helper function to compare Ethereum addresses
const compareAddresses = (address1: string | undefined | null, address2: string | undefined | null): boolean => {
  if (!address1 || !address2) {
    return false;
  }
  
  const normalized1 = normalizeAddress(address1);
  const normalized2 = normalizeAddress(address2);
  
  return normalized1 === normalized2;
};

// Extend the base ContractInfo interface to include broadcaster and other properties
interface ContractInfo {
  owner: string;
  broadcaster: string;
  recoveryAddress: string;
  timeLockPeriod: number;
  chainId: number;
  chainName: string;
}

// Notification message type
type NotificationMessage = {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
};

// Wallet type for the dialog
type WalletType = 'owner' | 'broadcaster' | 'recovery';

interface WalletConnectionContentProps {
  contractInfo: ContractInfo;
  walletType: WalletType;
  onSuccess: (walletAddress: string) => void;
  onClose: () => void;
  txId?: number;
  actionLabel?: string;
  children?: ReactNode;
  contractAddress?: Address;
}

function WalletConnectionContent({ 
  contractInfo, 
  walletType,
  onSuccess,
  onClose,
  txId,
  actionLabel = "Continue with Approval",
  children,
  contractAddress
}: WalletConnectionContentProps) {
  const walletManager = useSingleWallet();
  const { session, isConnecting, connect, disconnect } = walletManager || { 
    session: undefined, 
    isConnecting: false, 
    connect: async () => {}, 
    disconnect: async () => {} 
  };
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [broadcasterAddress, setBroadcasterAddress] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  
  // Create a simple chain object with the chainId
  const chain: Chain = {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [''],
      },
    }
  };

  // Get the appropriate address based on wallet type
  const getRequiredAddress = async (): Promise<string> => {
    if (!contractInfo) {
      console.log("contractInfo is undefined in getRequiredAddress");
      return '';
    }
    
    let address = '';
    
    switch (walletType) {
      case 'owner':
        address = contractInfo.owner || '';
        break;
      case 'broadcaster':
        // Try to get broadcaster address directly from the contract if possible
        if (contractAddress && publicClient && chain) {
          try {
            console.log("Attempting to get broadcaster address from contract...");
            const vault = new SimpleVault(
              publicClient,
              walletClient || undefined,
              contractAddress as Address,
              chain
            );
            
            const contractBroadcaster = await vault.getBroadcaster();
            console.log("Retrieved broadcaster from contract:", contractBroadcaster);
            
            if (contractBroadcaster) {
              setBroadcasterAddress(contractBroadcaster);
              return contractBroadcaster;
            }
          } catch (error) {
            console.error("Error getting broadcaster from contract:", error);
          }
        }
        
        // Fallback to contractInfo if direct contract call fails
        if (!contractInfo.broadcaster) {
          console.warn("Broadcaster address is undefined or empty in contractInfo");
          // Try to get it from other properties if available
          if (contractInfo.hasOwnProperty('broadcasterAddress')) {
            address = (contractInfo as any).broadcasterAddress || '';
            console.log("Using broadcasterAddress property instead:", address);
          } else if (broadcasterAddress) {
            address = broadcasterAddress;
            console.log("Using cached broadcaster address:", address);
          } else {
            address = '';
          }
        } else {
          address = contractInfo.broadcaster;
        }
        break;
      case 'recovery':
        address = contractInfo.recoveryAddress || '';
        break;
      default:
        address = '';
    }
    
    if (!address) {
      console.warn(`No address found for wallet type: ${walletType}`);
    }
    
    // Ensure the address has the 0x prefix
    if (address && !address.startsWith('0x')) {
      address = `0x${address}`;
    }
    
    console.log(`Required address for ${walletType}:`, address);
    return address;
  };

  // Get the appropriate wallet type label
  const getWalletTypeLabel = (): string => {
    if (!walletType) {
      console.warn("walletType is undefined in getWalletTypeLabel");
      return 'Required';
    }
    
    switch (walletType) {
      case 'owner':
        return 'Owner';
      case 'broadcaster':
        return 'Broadcaster';
      case 'recovery':
        return 'Recovery';
      default:
        console.warn(`Unknown wallet type: ${walletType}`);
        return 'Required';
    }
  };

  // Fetch broadcaster address on component mount
  useEffect(() => {
    if (walletType === 'broadcaster' && contractAddress && publicClient && chain) {
      const fetchBroadcasterAddress = async () => {
        try {
          const vault = new SimpleVault(
            publicClient,
            walletClient || undefined,
            contractAddress as Address,
            chain
          );
          
          const broadcaster = await vault.getBroadcaster();
          console.log("Fetched broadcaster address:", broadcaster);
          setBroadcasterAddress(broadcaster);
        } catch (error) {
          console.error("Error fetching broadcaster address:", error);
        }
      };
      
      fetchBroadcasterAddress();
    }
  }, [contractAddress, publicClient, chain, walletClient, walletType]);

  useEffect(() => {
    console.log("Session:", session);
    console.log("ContractInfo:", contractInfo);
    console.log("WalletType:", walletType);
    console.log("BroadcasterAddress state:", broadcasterAddress);
    
    const checkWalletConnection = async () => {
      try {
        // Check if session has the expected structure
        if (session) {
          if (typeof session !== 'object') {
            console.error("Session is not an object:", session);
            setIsWalletConnected(false);
            return;
          }
          
          // Log all properties of session for debugging
          console.log("Session properties:", Object.keys(session));
        }
        
        // Check if walletType is valid
        if (!walletType || !['owner', 'broadcaster', 'recovery'].includes(walletType)) {
          console.error("Invalid walletType:", walletType);
          setIsWalletConnected(false);
          return;
        }
        
        if (session && contractInfo) {
          // Check if contractInfo has the expected structure
          if (typeof contractInfo !== 'object') {
            console.error("ContractInfo is not an object:", contractInfo);
            setIsWalletConnected(false);
            return;
          }
          
          // Log all properties of contractInfo for debugging
          console.log("ContractInfo properties:", Object.keys(contractInfo));
          
          const requiredAddress = await getRequiredAddress();
          console.log("Required address:", requiredAddress);
          
          if (session.account) {
            console.log("Session account:", session.account);
            
            if (typeof session.account !== 'string') {
              console.error("Session account is not a string:", session.account);
              setIsWalletConnected(false);
              return;
            }
            
            // Normalize the session account address
            const sessionAccount = session.account.toLowerCase();
            console.log("Normalized session account:", sessionAccount);
            
            if (requiredAddress) {
              if (typeof requiredAddress !== 'string') {
                console.error("Required address is not a string:", requiredAddress);
                setIsWalletConnected(false);
                return;
              }
              
              // Use our new address comparison function
              const addressesMatch = compareAddresses(session.account, requiredAddress);
              console.log("Comparing addresses:", session.account, requiredAddress);
              console.log("Address comparison result:", addressesMatch);
              
              setIsWalletConnected(addressesMatch);
            } else {
              console.log("Required address is empty");
              setIsWalletConnected(false);
            }
          } else {
            console.log("Session account is undefined");
            setIsWalletConnected(false);
          }
        } else {
          console.log("Session or contractInfo is undefined");
          setIsWalletConnected(false);
        }
      } catch (error) {
        console.error("Error in useEffect:", error);
        setIsWalletConnected(false);
      }
    };
    
    checkWalletConnection();
  }, [session, contractInfo, walletType, broadcasterAddress]);

  // Effect to trigger transaction when wallet is connected and validated
  useEffect(() => {
    const handleWalletValidation = async () => {
      if (isWalletConnected && session?.account) {
        try {
          // Only trigger onSuccess if we haven't already
          if (!isApproving) {
            setIsApproving(true);
            await onSuccess(session.account);
          }
        } catch (error) {
          console.error("Error in wallet validation:", error);
          setIsApproving(false);
        }
      }
    };

    handleWalletValidation();
  }, [isWalletConnected, session?.account]);

  const [isApproving, setIsApproving] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session && typeof session === 'object' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {session && session.account ? formatAddress(session.account) : 'No account'}
                  </span>
                </div>
                <Button
                  onClick={() => void disconnect()}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!isWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>Connected wallet does not match the {getWalletTypeLabel().toLowerCase()} address. Please connect the correct wallet.</p>
                    <div className="text-xs mt-1">
                      <p><strong>Connected:</strong> {formatAddress(session?.account)}</p>
                      <p><strong>Required:</strong> {formatAddress(broadcasterAddress || '')}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {isWalletConnected && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-500">
                      {getWalletTypeLabel()} wallet connected successfully! Please approve the transaction in your wallet.
                    </AlertDescription>
                  </Alert>
                  {txId && (
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Transaction ID:</p>
                      <code className="text-xs">#{txId.toString()}</code>
                    </div>
                  )}
                  {children}
                  <Button 
                    disabled={true}
                    className="w-full"
                    variant="outline"
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting for Wallet Approval
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? 'Connecting...' : `Connect ${getWalletTypeLabel()} Wallet`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetaTxApprovalDialogProps {
  contractInfo: ContractInfo;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (broadcasterAddress: string) => void;
  txId?: number;
  title?: string;
  description?: string;
  actionLabel?: string;
  walletType?: WalletType;
  children?: ReactNode;
  contractAddress?: Address;
}

export function MetaTxApprovalDialog({
  contractInfo,
  isOpen,
  onOpenChange,
  onSuccess,
  txId,
  title = "Connect Broadcaster Wallet",
  description = "Connect your broadcaster wallet to submit this transaction. The transaction will be presented for your approval once connected.",
  actionLabel = "Continue with Approval",
  walletType = 'broadcaster',
  children,
  contractAddress
}: MetaTxApprovalDialogProps) {
  const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
  const { disconnect } = useSingleWallet();
  
  // Log the contractInfo object for debugging
  console.log("MetaTxApprovalDialog contractInfo:", contractInfo);
  console.log("MetaTxApprovalDialog walletType:", walletType);
  console.log("MetaTxApprovalDialog contractAddress:", contractAddress);
  
  if (!projectId) {
    console.error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
    return null;
  }

  // Ensure we have valid contractInfo
  if (!contractInfo || typeof contractInfo !== 'object') {
    console.error('Invalid contractInfo:', contractInfo);
    return null;
  }
  
  // Check if contractInfo has the required properties
  if (!contractInfo.hasOwnProperty('broadcaster') && !contractInfo.hasOwnProperty('broadcasterAddress')) {
    console.error('contractInfo is missing broadcaster property:', contractInfo);
    // Continue anyway, but log the error
  }
  
  // Get the appropriate wallet type label
  const getWalletTypeLabel = (): string => {
    if (!walletType) {
      console.warn("walletType is undefined in getWalletTypeLabel");
      return 'Required';
    }
    
    switch (walletType) {
      case 'owner':
        return 'Owner';
      case 'broadcaster':
        return 'Broadcaster';
      case 'recovery':
        return 'Recovery';
      default:
        console.warn(`Unknown wallet type: ${walletType}`);
        return 'Required';
    }
  };

  // Get the appropriate address based on wallet type
  const getWalletAddress = (): string => {
    if (!contractInfo) {
      console.log("contractInfo is undefined in getWalletAddress");
      return '';
    }
    
    let address = '';
    
    switch (walletType) {
      case 'owner':
        address = contractInfo.owner || '';
        break;
      case 'broadcaster':
        // Check if broadcaster is defined and not empty
        if (!contractInfo.broadcaster) {
          console.warn("Broadcaster address is undefined or empty in contractInfo");
          // Try to get it from other properties if available
          if (contractInfo.hasOwnProperty('broadcasterAddress')) {
            address = (contractInfo as any).broadcasterAddress || '';
            console.log("Using broadcasterAddress property instead:", address);
          } else {
            address = '';
          }
        } else {
          address = contractInfo.broadcaster;
        }
        break;
      case 'recovery':
        address = contractInfo.recoveryAddress || '';
        break;
      default:
        address = '';
    }
    
    // Ensure the address has the 0x prefix
    if (address && !address.startsWith('0x')) {
      address = `0x${address}`;
    }
    
    return address;
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Only allow closing via the X button
        if (!open) {
          // Disconnect wallet when dialog is closed via X button
          if (disconnect) {
            void disconnect();
          }
          onOpenChange(open);
        }
      }}
    >
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape key
          e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
          {contractInfo && (
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-sm font-medium">{getWalletTypeLabel()} Address:</p>
              <code className="text-xs">{getWalletAddress()}</code>
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          {children}
          
          {/* Wrap in try-catch to handle any errors */}
          {(() => {
            try {
              return (
                <SingleWalletManagerProvider
                  projectId={projectId}
                  autoConnect={false}
                  metadata={{
                    name: 'SandBlox Broadcaster',
                    description: 'SandBlox Broadcaster Wallet Connection',
                    url: window.location.origin,
                    icons: ['https://avatars.githubusercontent.com/u/37784886']
                  }}
                >
                  <WalletConnectionContent 
                    contractInfo={contractInfo}
                    walletType={walletType}
                    onSuccess={onSuccess}
                    onClose={() => onOpenChange(false)}
                    txId={txId}
                    actionLabel={actionLabel}
                    contractAddress={contractAddress}
                  >
                    {children}
                  </WalletConnectionContent>
                </SingleWalletManagerProvider>
              );
            } catch (error) {
              console.error("Error rendering SingleWalletManagerProvider:", error);
              return (
                <div className="p-4 border border-red-500 rounded-md">
                  <p className="text-red-500">Error initializing wallet connection. Please try again.</p>
                </div>
              );
            }
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
} 