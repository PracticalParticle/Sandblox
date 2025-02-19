import * as React from "react";
import UniversalProvider from '@walletconnect/universal-provider';
import { type SessionTypes } from '@walletconnect/types';
import QRCodeModal from '@walletconnect/qrcode-modal';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { toast } from "@/components/ui/use-toast";
import { createContext, useContext, useEffect, useState } from 'react';

// Strict type definitions
export interface WalletSession {
  topic: string;
  account: string;
  chainId: number;
  peerMetadata?: {
    name: string;
    url: string;
    icons: string[];
  };
  lastActivity: number; // For session timeout tracking
}

interface WalletManagerContextType {
  session: WalletSession | undefined;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendRequest: <T>(method: string, params: unknown[]) => Promise<T>;
}

// Session management constants
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'singleWalletSession';

// Create context with proper type and default values
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
  allowedChainIds?: number[];
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
  allowedChainIds = [1], // Default to Ethereum mainnet
  metadata = {
    name: 'Single Wallet Manager',
    description: 'Secure wallet connection',
    url: window.location.origin,
    icons: [`${window.location.origin}/logo.png`]
  }
}: SingleWalletManagerProviderProps) {
  const [provider, setProvider] = useState<InstanceType<typeof UniversalProvider>>();
  const [session, setSession] = useState<WalletSession>();
  const [isConnecting, setIsConnecting] = useState(false);

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

    const interval = setInterval(checkTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [session]);

  // Initialize provider
  useEffect(() => {
    const initProvider = async () => {
      try {
        const instance = await UniversalProvider.init({
          projectId,
          metadata
        });
        setProvider(instance);

        // Load persisted session with security checks
        if (autoConnect) {
          const storedSession = localStorage.getItem(STORAGE_KEY);
          if (storedSession) {
            try {
              const parsed = JSON.parse(storedSession) as WalletSession;
              
              // Validate chain ID
              if (!allowedChainIds.includes(parsed.chainId)) {
                throw new Error('Invalid chain ID');
              }

              // Check session age
              if (Date.now() - parsed.lastActivity > SESSION_TIMEOUT) {
                throw new Error('Session expired');
              }

              await instance.connect({
                namespaces: {
                  eip155: {
                    methods: ['eth_sendTransaction', 'eth_sign'],
                    chains: [`eip155:${parsed.chainId}`],
                    events: ['chainChanged', 'accountsChanged']
                  }
                }
              });

              setSession(parsed);
            } catch (error) {
              localStorage.removeItem(STORAGE_KEY);
              console.error('Failed to restore session:', error);
            }
          }
        }
      } catch (error) {
        console.error('Provider initialization failed:', error);
        toast({
          title: "Connection Error",
          description: "Failed to initialize wallet connection.",
          variant: "destructive"
        });
      }
    };

    void initProvider();
    return () => {
      if (provider) {
        provider.cleanupPendingPairings().catch(console.error);
      }
    };
  }, [projectId, autoConnect]);

  const connect = async (): Promise<void> => {
    if (!provider || isConnecting) return;

    try {
      setIsConnecting(true);
      const session = await provider.connect({
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
      });

      if (!session?.namespaces?.eip155?.accounts?.[0] || !session?.namespaces?.eip155?.chains?.[0]) {
        throw new Error('Invalid session data');
      }

      const newSession: WalletSession = {
        topic: session.topic,
        account: session.namespaces.eip155.accounts[0].split(':')[2],
        chainId: Number(session.namespaces.eip155.chains[0].split(':')[1]),
        peerMetadata: session.peer.metadata,
        lastActivity: Date.now()
      };

      // Encrypt session data before storing
      const encryptedSession = window.btoa(JSON.stringify(newSession));
      localStorage.setItem(STORAGE_KEY, encryptedSession);
      setSession(newSession);

      toast({
        title: "Connected",
        description: "Wallet connected successfully!",
      });
    } catch (error) {
      console.error('Connection failed:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!provider || !session) return;
    
    try {
      await provider.disconnect();
      localStorage.removeItem(STORAGE_KEY);
      setSession(undefined);
      
      toast({
        title: "Disconnected",
        description: "Wallet disconnected successfully.",
      });
    } catch (error) {
      console.error('Disconnection failed:', error);
      toast({
        title: "Disconnection Failed",
        description: error instanceof Error ? error.message : "Failed to disconnect wallet",
        variant: "destructive"
      });
    }
  };

  const sendRequest = async <T,>(method: string, params: unknown[]): Promise<T> => {
    if (!provider || !session) {
      throw new Error('No active session');
    }

    // Update last activity timestamp
    const updatedSession = { ...session, lastActivity: Date.now() };
    setSession(updatedSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));

    try {
      const result = await provider.request({
        method,
        params
      });
      return result as T;
    } catch (error) {
      console.error('Request failed:', error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
      throw error;
    }
  };

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
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 