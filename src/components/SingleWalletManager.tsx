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
import { type Chain, COMMON_CHAINS } from '@/lib/utils';
import { useConfig } from 'wagmi';

// Utility function to normalize chain ID to number
function normalizeChainId(chainId: string | number): number {
  if (typeof chainId === 'number') return chainId;
  
  // Handle hexadecimal strings (both with and without '0x' prefix)
  if (typeof chainId === 'string') {
    // If it's a valid decimal string, convert directly
    if (/^\d+$/.test(chainId)) {
      return parseInt(chainId, 10);
    }
    
    // Handle hex string (with or without 0x prefix)
    const hexString = chainId.toLowerCase().startsWith('0x') ? chainId : `0x${chainId}`;
    if (/^0x[0-9a-f]+$/i.test(hexString)) {
      return parseInt(hexString, 16);
    }
  }
  
  throw new WalletConnectError(
    'Invalid chain ID format',
    ErrorCodes.INVALID_CHAIN
  );
}

// Define minimal provider interface for what we actually use
interface MinimalProvider {
  connect(args: any): Promise<any>;
  disconnect(): Promise<void>;
  on(event: string, callback: (data: any) => void): void;
  request(args: any): Promise<any>;
}

interface WalletConnectModalInterface {
  openModal: (args: { uri: string; onClose: () => void }) => Promise<void>;
  closeModal: () => void;
}

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
  allowedChainIds = [1], // We'll ignore this parameter and allow all chains
  metadata = {
    name: 'Single Wallet Manager',
    description: 'Secure wallet connection',
    url: window.location.origin,
    icons: [`${window.location.origin}/logo.png`]
  }
}: SingleWalletManagerProviderProps) {
  const [session, setSession] = useState<ValidWalletSession>();
  const [isConnecting, setIsConnecting] = useState(false);
  const modalCleanupRef = useRef<(() => void) | undefined>(undefined);
  const providerRef = useRef<MinimalProvider | null>(null);

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

    return () => {
      if (typeof modalCleanupRef.current === 'function') {
        try {
          modalCleanupRef.current();
        } catch (error) {
          console.error('Error during modal cleanup:', error);
        }
      }
      try {
        newModal.closeModal();
      } catch (error) {
        console.error('Error closing modal:', error);
      }
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
    if (isConnecting) return;

    const abortController = new AbortController();
    let handleVisibilityChange: (() => void) | undefined;
    const providerPool = ProviderPool.getInstance();

    try {
      setIsConnecting(true);
      
      // Clear any existing sessions
      localStorage.removeItem('walletconnect');
      if (modalCleanupRef.current) {
        modalCleanupRef.current();
      }
      
      // Get fresh provider and modal instances
      const { provider: wcProvider, modal } = await providerPool.getProvider(projectId, metadata, allowedChainIds);
      const provider = wcProvider as unknown as MinimalProvider;
      providerRef.current = provider;
      
      let isModalClosed = false;
      
      // Set up provider event listeners
      provider.on('display_uri', (uri: string) => {
        console.log('Got URI:', uri);
        
        // Ensure any existing modal is closed and cleaned up
        if (modalCleanupRef.current) {
          modalCleanupRef.current();
        }

        // Small delay to ensure modal state is reset
        setTimeout(async () => {
          try {
            await (modal as WalletConnectModalInterface).openModal({ 
              uri,
              onClose: () => {
                isModalClosed = true;
                setIsConnecting(false);
                abortController.abort('Modal closed by user');
                // Clean up on modal close
                if (providerRef.current) {
                  void providerRef.current.disconnect().catch(console.error);
                }
                localStorage.removeItem('walletconnect');
              }
            });

            // Add abort signal listener to close modal if aborted externally
            abortController.signal.addEventListener('abort', () => {
              (modal as WalletConnectModalInterface).closeModal();
            });
          } catch (error) {
            console.error('Error opening modal:', error);
            setIsConnecting(false);
          }
        }, 100);
      });

      handleVisibilityChange = () => {
        if (document.hidden) {
          abortController.abort('Page hidden');
          (modal as WalletConnectModalInterface).closeModal();
          setIsConnecting(false);
          void provider.disconnect().catch(console.error);
          localStorage.removeItem('walletconnect');
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Connect using the provider directly with timeout
      const connectionPromise = (provider as any).connect({
        namespaces: {
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData'
            ],
            // Allow connection to any chain
            chains: ['eip155:1'], // We'll specify mainnet but accept any chain
            events: ['chainChanged', 'accountsChanged']
          }
        }
      });

      // Race between connection, abort signal, and timeout
      const rawSession = await Promise.race([
        connectionPromise,
        new Promise((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new WalletConnectError(
              'Connection cancelled by user',
              ErrorCodes.USER_REJECTED
            ));
          });
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new WalletConnectError(
              'Connection timeout',
              ErrorCodes.TIMEOUT
            ));
          }, 180000); // 3 minute timeout
        })
      ]);

      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }

      if (isModalClosed || abortController.signal.aborted) {
        return;
      }

      (modal as WalletConnectModalInterface).closeModal();

      const validatedSession = validateSession(rawSession);
      // Extract chain ID from the first chain in the namespace
      const rawChainId = validatedSession.namespaces.eip155.chains[0].split(':')[1];
      
      try {
        const chainId = normalizeChainId(rawChainId) as Chain;
        
        // Create new session with the connected chain ID
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
          description: `Wallet connected successfully on chain ${chainId}!`,
        });
      } catch (error) {
        if (error instanceof WalletConnectError) {
          throw error;
        }
        throw new WalletConnectError(
          'Invalid chain ID format',
          ErrorCodes.INVALID_CHAIN
        );
      }
    } catch (error) {
      console.error('Error during connection:', error);
      
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
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!session) return;
    
    try {
      if (providerRef.current) {
        await providerRef.current.disconnect().catch(console.error);
      }
      
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

    if (!providerRef.current) {
      throw new WalletConnectError('No active provider', ErrorCodes.PROVIDER_ERROR);
    }

    // Update session activity
    const updatedSession = { ...session, lastActivity: Date.now() };
    setSession(updatedSession);
    
    // Encrypt and store updated session
    const encryptedSession = await encryptData(JSON.stringify(updatedSession), SECRET_KEY);
    localStorage.setItem(STORAGE_KEY, encryptedSession);

    // Verify connection is still active
    try {
      console.log('Verifying connection status...');
      const chainIdResult = await Promise.race([
        providerRef.current.request({ method: 'eth_chainId', params: [] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection check timed out')), 5000))
      ]);
      console.log('Connection verified, chain ID:', chainIdResult);
    } catch (error) {
      console.error('Connection verification failed:', error);
      
      // Clear stale sessions
      localStorage.removeItem('walletconnect');
      const providerPool = ProviderPool.getInstance();
      const { provider: wcProvider } = await providerPool.getProvider(projectId, metadata);
      providerRef.current = wcProvider as unknown as MinimalProvider;
      
      // Attempt to reconnect
      try {
        await providerRef.current.connect({
          namespaces: {
            eip155: {
              methods: ['eth_sendTransaction', 'eth_sign', 'personal_sign', 'eth_signTypedData'],
              chains: [`eip155:${session.chainId}`],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        });
      } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError);
        throw new WalletConnectError('Failed to re-establish connection', ErrorCodes.PROVIDER_ERROR);
      }
    }

    try {
      console.log('Sending request to provider:', {
        method,
        params,
        provider: providerRef.current
      });

      // Ensure the provider is properly connected
      if (!providerRef.current || typeof providerRef.current.request !== 'function') {
        console.error('Invalid provider state:', providerRef.current);
        throw new WalletConnectError('Provider not properly initialized', ErrorCodes.PROVIDER_ERROR);
      }

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000);
      });

      // Add a small delay to ensure the wallet is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send the request with timeout
      const result = await Promise.race([
        providerRef.current.request({
          method,
          params
        }),
        timeoutPromise
      ]);

      console.log('Provider request result:', result);
      return result as T;
    } catch (error: any) {
      console.error('Request failed:', error);
      
      // Check for specific error conditions
      if (error.message?.includes('timeout')) {
        toast({
          title: "Transaction Failed",
          description: "Wallet confirmation dialog did not appear. Please try reconnecting your wallet.",
          variant: "destructive"
        });
        throw new WalletConnectError('Transaction request timed out', ErrorCodes.TIMEOUT);
      }
      
      if (typeof error === 'object' && error?.message?.includes('not connected')) {
        console.log('Provider disconnected, attempting to reconnect...');
        const providerPool = ProviderPool.getInstance();
        const { provider: wcProvider } = await providerPool.getProvider(projectId, metadata);
        providerRef.current = wcProvider as unknown as MinimalProvider;
        
        // Retry the request once
        try {
          const retryResult = await Promise.race([
            providerRef.current.request({
              method,
              params
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Retry timed out')), 30000))
          ]);
          return retryResult as T;
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          throw WalletConnectError.fromError(retryError);
        }
      }
      
      // Handle response errors that might indicate the transaction was sent
      if (error.message?.includes('Missing or invalid respond() response') || 
          error.message?.includes('Not initialized. subscription')) {
        toast({
          title: "Transaction Status Unknown",
          description: "We couldn't confirm if your transaction was sent. Please check your wallet for details.",
          variant: "default"
        });
        throw new WalletConnectError('Transaction status unknown', ErrorCodes.UNKNOWN_ERROR);
      }
      
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
        const { provider: wcProvider } = await providerPool.getProvider(projectId, metadata);
        const provider = wcProvider as unknown as MinimalProvider;

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
                {session.account ? `${session.account.slice(0, 6)}...${session.account.slice(-4)}` : 'No account'}
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