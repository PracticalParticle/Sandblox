import * as React from "react";
import { useState, useEffect, ReactNode } from "react";
import { Address } from "viem";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
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

// Helper function to format addresses
const formatAddress = (address: string | undefined | null): string => {
  if (!address || typeof address !== 'string' || address.length < 10) {
    return address || 'Invalid address';
  }
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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
}

function WalletConnectionContent({ 
  contractInfo, 
  walletType,
  onSuccess,
  onClose,
  txId,
  actionLabel = "Continue with Approval",
  children
}: WalletConnectionContentProps) {
  const walletManager = useSingleWallet();
  const { session, isConnecting, connect, disconnect } = walletManager || { 
    session: undefined, 
    isConnecting: false, 
    connect: async () => {}, 
    disconnect: async () => {} 
  };
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Get the appropriate address based on wallet type
  const getRequiredAddress = (): string => {
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
        address = contractInfo.broadcaster || '';
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

  useEffect(() => {
    console.log("Session:", session);
    console.log("ContractInfo:", contractInfo);
    console.log("WalletType:", walletType);
    
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
        
        const requiredAddress = getRequiredAddress();
        console.log("Required address:", requiredAddress);
        
        if (session.account) {
          console.log("Session account:", session.account);
          
          if (typeof session.account !== 'string') {
            console.error("Session account is not a string:", session.account);
            setIsWalletConnected(false);
            return;
          }
          
          const sessionAccount = session.account.toLowerCase();
          
          if (requiredAddress) {
            if (typeof requiredAddress !== 'string') {
              console.error("Required address is not a string:", requiredAddress);
              setIsWalletConnected(false);
              return;
            }
            
            setIsWalletConnected(
              sessionAccount === requiredAddress.toLowerCase()
            );
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
  }, [session, contractInfo, walletType]);

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
                  <AlertDescription>
                    Connected wallet does not match the {getWalletTypeLabel().toLowerCase()} address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isWalletConnected && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-500">
                      {getWalletTypeLabel()} wallet connected successfully!
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
                    onClick={() => {
                      if (session && session.account && typeof session.account === 'string') {
                        onSuccess(session.account);
                      } else {
                        console.error("Cannot call onSuccess: session.account is invalid", session);
                      }
                    }}
                    className="w-full"
                    variant="default"
                  >
                    {actionLabel}
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
      <DialogFooter className="sm:justify-between">
        <Button
          variant="ghost"
          onClick={onClose}
        >
          Cancel
        </Button>
      </DialogFooter>
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
}

export function MetaTxApprovalDialog({
  contractInfo,
  isOpen,
  onOpenChange,
  onSuccess,
  txId,
  title = "Connect Broadcaster Wallet",
  description = "Connect the broadcaster wallet to approve the withdrawal request via meta-transaction.",
  actionLabel = "Continue with Approval",
  walletType = 'broadcaster',
  children
}: MetaTxApprovalDialogProps) {
  const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
  
  if (!projectId) {
    console.error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
    return null;
  }

  // Ensure we have valid contractInfo
  if (!contractInfo || typeof contractInfo !== 'object') {
    console.error('Invalid contractInfo:', contractInfo);
    return null;
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
        address = contractInfo.broadcaster || '';
        break;
      case 'recovery':
        address = contractInfo.recoveryAddress || '';
        break;
      default:
        address = '';
    }
    
    return address;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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