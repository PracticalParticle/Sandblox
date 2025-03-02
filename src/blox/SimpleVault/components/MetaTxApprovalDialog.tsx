import * as React from "react";
import { useState, useEffect } from "react";
import { Address, Hex, Chain } from "viem";
import { createWalletClient } from "viem";
import { http } from "viem";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
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
import { MetaTransaction } from '../../../particle-core/sdk/typescript/interfaces/lib.index';
import SimpleVault from "../SimpleVault";

// Helper function to format addresses
const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
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

interface BroadcasterWalletContentProps {
  contractInfo: ContractInfo;
  onSuccess: (broadcasterAddress: string) => void;
  onClose: () => void;
}

function BroadcasterWalletContent({ 
  contractInfo, 
  onSuccess,
  onClose
}: BroadcasterWalletContentProps) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet();
  const [isBroadcasterWalletConnected, setIsBroadcasterWalletConnected] = useState(false);

  useEffect(() => {
    if (session && contractInfo) {
      setIsBroadcasterWalletConnected(
        session.account.toLowerCase() === contractInfo.broadcaster?.toLowerCase()
      );
    } else {
      setIsBroadcasterWalletConnected(false);
    }
  }, [session, contractInfo]);

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          {session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Connected Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    {formatAddress(session.account)}
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
              {!isBroadcasterWalletConnected && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connected wallet does not match the broadcaster address. Please connect the correct wallet.
                  </AlertDescription>
                </Alert>
              )}
              {isBroadcasterWalletConnected && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-500">
                      Broadcaster wallet connected successfully!
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={() => onSuccess(session.account)}
                    className="w-full"
                    variant="default"
                  >
                    Continue with Approval
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
              <Loader2 className={`mr-2 h-4 w-4 ${isConnecting ? 'animate-spin' : ''}`} />
              {isConnecting ? 'Connecting...' : 'Connect Broadcaster Wallet'}
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
}

export function MetaTxApprovalDialog({
  contractInfo,
  isOpen,
  onOpenChange,
  onSuccess
}: MetaTxApprovalDialogProps) {
  const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
  
  if (!projectId) {
    console.error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Broadcaster Wallet</DialogTitle>
          <DialogDescription>
            Connect the broadcaster wallet to approve the withdrawal request via meta-transaction.
          </DialogDescription>
          {contractInfo && (
            <div className="mt-2 p-2 bg-muted rounded-lg">
              <p className="text-sm font-medium">Broadcaster Address:</p>
              <code className="text-xs">{contractInfo.broadcaster}</code>
            </div>
          )}
        </DialogHeader>
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
          <BroadcasterWalletContent 
            contractInfo={contractInfo}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        </SingleWalletManagerProvider>
      </DialogContent>
    </Dialog>
  );
}

interface MetaTxApprovalHandlerProps {
  contractAddress: Address;
  txId: number;
  contractInfo: ContractInfo;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  addMessage?: (message: NotificationMessage) => void;
}

export function useMetaTxApproval({
  contractAddress,
  txId,
  contractInfo,
  onSuccess,
  onError,
  addMessage
}: MetaTxApprovalHandlerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handleNotification = (message: NotificationMessage) => {
    if (addMessage) {
      addMessage(message);
    } else {
      console.log('Notification:', message);
    }
  };

  const startApprovalProcess = () => {
    setIsDialogOpen(true);
  };

  const handleBroadcasterConnected = async (
    broadcasterAddress: string,
    publicClient: any,
    walletClient: any,
    chain: Chain
  ) => {
    if (!contractInfo || !chain) return;
    
    setIsDialogOpen(false);
    setIsApproving(true);
    
    try {
      // Create vault instance
      const vault = new SimpleVault(
        publicClient,
        walletClient,
        contractAddress,
        chain
      );
      
      // 1. Generate unsigned meta transaction
      const unsignedMetaTx = await vault.generateUnsignedWithdrawalMetaTxApproval(
        BigInt(txId)
      );
      
      // 2. Get the owner to sign the meta transaction
      const ownerAddress = walletClient.account.address;
      if (!ownerAddress) {
        throw new Error("Owner wallet not connected");
      }
      
      // Create a typed data signature
      const signature = await walletClient.signTypedData({
        domain: {
          name: 'SimpleVault',
          version: '1',
          chainId: chain.id,
          verifyingContract: contractAddress
        },
        types: {
          MetaTransaction: [
            { name: 'txId', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'signer', type: 'address' }
          ]
        },
        primaryType: 'MetaTransaction',
        message: {
          txId: unsignedMetaTx.txRecord.txId,
          deadline: unsignedMetaTx.params.deadline,
          signer: ownerAddress
        }
      });
      
      if (!signature) {
        throw new Error("Failed to sign meta transaction");
      }
      
      // 3. Add signature to meta transaction
      const metaTx: MetaTransaction = {
        ...unsignedMetaTx,
        signature: signature as Hex
      };
      
      // 4. Broadcast the meta transaction using the broadcaster wallet
      const broadcasterWalletClient = createWalletClient({
        account: broadcasterAddress as Address,
        chain: chain,
        transport: http()
      });
      
      const broadcastVault = new SimpleVault(
        publicClient,
        broadcasterWalletClient,
        contractAddress,
        chain
      );
      
      const result = await broadcastVault.approveWithdrawalWithMetaTx(
        metaTx,
        { from: broadcasterAddress as Address }
      );
      
      handleNotification({
        type: 'info',
        title: "Meta Transaction Submitted",
        description: `Transaction hash: ${result.hash}`
      });
      
      await result.wait();
      
      handleNotification({
        type: 'success',
        title: "Withdrawal Approved",
        description: "The withdrawal has been approved via meta transaction."
      });

      if (onSuccess) {
        onSuccess(result.hash);
      }
      
    } catch (error: any) {
      console.error("Meta transaction approval failed:", error);
      handleNotification({
        type: 'error',
        title: "Meta Transaction Failed",
        description: error.message || "Failed to approve withdrawal via meta transaction"
      });
      if (onError) {
        onError(error);
      }
    } finally {
      setIsApproving(false);
    }
  };

  return {
    isDialogOpen,
    setIsDialogOpen,
    isApproving,
    startApprovalProcess,
    handleBroadcasterConnected
  };
} 