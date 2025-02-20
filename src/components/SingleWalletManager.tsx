import { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as React from "react";
import { WalletConnectModal } from '@walletconnect/modal';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "@/components/ui/use-toast";
import { ProviderPool } from '@/lib/provider-pool';
import { WalletConnectError, ErrorCodes, isUserRejectionError } from '@/lib/errors';
import { validateSession, validateWalletSession, type ValidWalletSession } from '@/lib/schemas';
import { encryptData, decryptData, generateSecretKey } from '@/lib/crypto';
import { CHAINS, type Chain } from '@/lib/utils';

// Constants
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'singleWalletSession';
const SECRET_KEY = generateSecretKey();

interface WalletManagerContextType {
  session: ValidWalletSession | undefined;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendRequest: <T>(method: string, params: unknown[]) => Promise<T>;
}

const WalletManagerContext = createContext<WalletManagerContextType>({
  session: undefined,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
  sendRequest: async () => { throw new Error('Not initialized'); }
});

interface SingleWalletManagerProviderProps {
  children: React.ReactNode;
  projectId: string;
  autoConnect?: boolean;
  allowedChainIds?: Chain[];
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

export function SingleWalletManagerProvider({
  children,
  projectId,
  autoConnect = true,
  allowedChainIds = [CHAINS.MAINNET],
  metadata = {
    name: 'Single Wallet Manager',
    description: 'Secure wallet connection',
    url: window.location.origin,
    icons: [`${window.location.origin}/logo.png`]
  }
}: SingleWalletManagerProviderProps) {
  const [modal, setModal] = useState<WalletConnectModal>();
  const [session, setSession] = useState<ValidWalletSession>();
  const [isConnecting, setIsConnecting] = useState(false);
  const modalCleanupRef = useRef<(() => void) | null>(null);

  // Initialize WalletConnect Modal
  useEffect(() => {
    const newModal = new WalletConnectModal({
      projectId,
      themeMode: 'dark',
      explorerRecommendedWalletIds: undefined,
      explorerExcludedWalletIds: undefined,
      chains: allowedChainIds.map(id => `eip155:${id}`),
      mobileWallets: [],
      desktopWallets: [],
      walletImages: {},
      themeVariables: {
        '--wcm-z-index': '9999',
        '--wcm-accent-color': '#3b82f6',
        '--wcm-accent-fill-color': '#3b82f6',
        '--wcm-background-color': '#1a1b1f',
        '--wcm-background-border-radius': '24px',
        '--wcm-container-border-radius': '24px',
        '--wcm-wallet-icon-border-radius': '12px',
        '--wcm-input-border-radius': '12px',
        '--wcm-button-border-radius': '12px',
        '--wcm-notification-border-radius': '12px',
        '--wcm-secondary-button-border-radius': '12px',
        '--wcm-font-family': '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu'
      }
    });

    setModal(newModal);

    return () => {
      if (modalCleanupRef.current) {
        modalCleanupRef.current();
      }
      newModal.closeModal();
    };
  }, [projectId, allowedChainIds]);

  // Session timeout checker
  useEffect(() => {
    if (!session) return;

    const checkTimeout = () => {
      const now = Date.now();
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        void disconnect();
        toast({
          title: "Session Expired",
          description: "Your wallet session has expired due to inactivity.",
          variant: "destructive"
        });
      }
    };

    const interval = setInterval(checkTimeout, 60000);
    return () => clearInterval(interval);
  }, [session]);

  const connect = async (): Promise<void> => {
    if (isConnecting || !modal) return;

    let handleVisibilityChange: (() => void) | undefined;
    let uriTimeout: ReturnType<typeof setTimeout> | undefined;
    const providerPool = ProviderPool.getInstance();

    try {
      setIsConnecting(true);
      
      // Clear any existing sessions and close modal
      localStorage.removeItem('walletconnect');
      if (modalCleanupRef.current) {
        modalCleanupRef.current();
      }
      modal.closeModal();
      
      // Get fresh provider instance
      const provider = await providerPool.getProvider(projectId, metadata);
      
      let uri: string | undefined;
      let isModalClosed = false;
      let hasDisplayedUri = false;
      
      // Set timeout for URI generation
      uriTimeout = setTimeout(() => {
        if (!hasDisplayedUri) {
          throw new WalletConnectError(
            'Connection timed out - please try again',
            ErrorCodes.CONNECTION_FAILED
          );
        }
      }, providerPool.getConnectionTimeout());
      
      provider.on('display_uri', (displayUri: string) => {
        console.log('Got URI:', displayUri);
        if (uriTimeout) {
          clearTimeout(uriTimeout);
        }
        
        hasDisplayedUri = true;
        uri = displayUri;
        
        // Ensure modal is closed and cleaned up before reopening
        if (modalCleanupRef.current) {
          modalCleanupRef.current();
        }
        modal.closeModal();

        // Small delay to ensure modal state is reset
        setTimeout(() => {
          const cleanup = (modal.openModal({ 
            uri,
            onClose: () => {
              isModalClosed = true;
              setIsConnecting(false);
              // Clean up on modal close
              void provider.disconnect().catch(console.error);
              localStorage.removeItem('walletconnect');
            }
          }) as unknown) as () => void;
          modalCleanupRef.current = cleanup;
        }, 100);
      });

      handleVisibilityChange = () => {
        if (document.hidden) {
          modal.closeModal();
          setIsConnecting(false);
          void provider.disconnect().catch(console.error);
          localStorage.removeItem('walletconnect');
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      const rawSession = await provider.connect({
        namespaces: {
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData'
            ],
            chains: allowedChainIds.map(id => `eip155:${id}`),
            events: ['chainChanged', 'accountsChanged']
          }
        }
      }).catch(error => {
        if (isModalClosed) {
          throw new WalletConnectError(
            'Connection cancelled by user',
            ErrorCodes.USER_REJECTED
          );
        }
        throw error;
      });

      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }

      if (isModalClosed) {
        return;
      }

      modal.closeModal();

      const validatedSession = validateSession(rawSession);
      const chainId = Number(validatedSession.namespaces.eip155.chains[0].split(':')[1]) as Chain;

      if (!allowedChainIds.includes(chainId)) {
        throw new WalletConnectError(
          'Invalid chain ID',
          ErrorCodes.INVALID_CHAIN
        );
      }

      const newSession: ValidWalletSession = {
        topic: validatedSession.topic,
        account: validatedSession.namespaces.eip155.accounts[0].split(':')[2],
        chainId,
        peerMetadata: validatedSession.peer.metadata,
        lastActivity: Date.now()
      };

      const encryptedSession = await encryptData(JSON.stringify(newSession), SECRET_KEY);
      localStorage.setItem(STORAGE_KEY, encryptedSession);
      setSession(newSession);

      toast({
        title: "Connected",
        description: "Wallet connected successfully!",
      });
    } catch (error) {
      console.error('Error during connection:', error);
      toast({
        title: "Connection Error",
        description: "An error occurred while trying to connect to the wallet.",
        variant: "destructive"
      });
      modal.closeModal();
      
      // Clean up on error
      localStorage.removeItem('walletconnect');
      
      const wcError = WalletConnectError.fromError(error);
      
      if (!isUserRejectionError(error)) {
        toast({
          title: "Connection Failed",
          description: wcError.message,
          variant: "destructive"
        });
      }
    } finally {
      setIsConnecting(false);
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (uriTimeout) {
        clearTimeout(uriTimeout);
      }
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!session) return;
    
    try {
      const providerPool = ProviderPool.getInstance();
      const provider = await providerPool.getProvider(projectId, metadata);
      
      // Disconnect and clean up
      await provider.disconnect().catch(console.error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('walletconnect');
      setSession(undefined);
      
      toast({
        title: "Disconnected",
        description: "Wallet disconnected successfully.",
      });
    } catch (error) {
      console.error('Disconnection failed:', error);
      const wcError = WalletConnectError.fromError(error);
      toast({
        title: "Disconnection Failed",
        description: wcError.message,
        variant: "destructive"
      });
    }
  };

  const sendRequest = async <T,>(method: string, params: unknown[]): Promise<T> => {
    if (!session) {
      throw new WalletConnectError('No active session', ErrorCodes.SESSION_INVALID);
    }

    const updatedSession = { ...session, lastActivity: Date.now() };
    setSession(updatedSession);
    
    // Encrypt and store updated session
    const encryptedSession = await encryptData(JSON.stringify(updatedSession), SECRET_KEY);
    localStorage.setItem(STORAGE_KEY, encryptedSession);

    try {
      const providerPool = ProviderPool.getInstance();
      const provider = await providerPool.getProvider(projectId, metadata);
      
      const result = await provider.request({
        method,
        params
      });
      return result as T;
    } catch (error) {
      console.error('Request failed:', error);
      const wcError = WalletConnectError.fromError(error);
      toast({
        title: "Transaction Failed",
        description: wcError.message,
        variant: "destructive"
      });
      throw wcError;
    }
  };

  // Only try to restore session if autoConnect is true
  useEffect(() => {
    if (!autoConnect) return;

    const restoreSession = async () => {
      const encryptedSession = localStorage.getItem(STORAGE_KEY);
      if (!encryptedSession) return;

      try {
        const decryptedSession = await decryptData(encryptedSession, SECRET_KEY);
        const parsed = JSON.parse(decryptedSession);
        
        // Validate session data
        const validatedSession = validateWalletSession(parsed);
        
        // Validate chain ID
        if (!allowedChainIds.includes(validatedSession.chainId)) {
          throw new WalletConnectError(
            'Invalid chain ID',
            ErrorCodes.INVALID_CHAIN
          );
        }

        // Check session age
        if (Date.now() - validatedSession.lastActivity > SESSION_TIMEOUT) {
          throw new WalletConnectError(
            'Session expired',
            ErrorCodes.SESSION_EXPIRED
          );
        }

        const providerPool = ProviderPool.getInstance();
        const provider = await providerPool.getProvider(projectId, metadata);

        await provider.connect({
          namespaces: {
            eip155: {
              methods: ['eth_sendTransaction', 'eth_sign'],
              chains: [`eip155:${validatedSession.chainId}`],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        });

        setSession(validatedSession);
      } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
        console.error('Failed to restore session:', error);
      }
    };

    void restoreSession();
  }, [autoConnect, allowedChainIds, projectId, metadata]);

  return (
    <WalletManagerContext.Provider
      value={{
        session,
        isConnecting,
        connect,
        disconnect,
        sendRequest
      }}
    >
      {children}
    </WalletManagerContext.Provider>
  );
}

export const useSingleWallet = () => useContext(WalletManagerContext);

export function WalletConnectButton() {
  const { session, isConnecting, connect, disconnect } = useSingleWallet();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Wallet Connection</CardTitle>
        <CardDescription>
          {session ? 'Manage your wallet connection' : 'Connect your wallet to continue'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session ? (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">Connected to: {session.peerMetadata?.name}</p>
              <p className="text-muted-foreground">
                {session.account.slice(0, 6)}...{session.account.slice(-4)}
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => void disconnect()}
              className="w-full"
              aria-label="Disconnect wallet"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="w-full"
            aria-label="Connect wallet"
            aria-busy={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 