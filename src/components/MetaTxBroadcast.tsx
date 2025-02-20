import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, X } from 'lucide-react';
import { SingleWalletManagerProvider, useSingleWallet } from './SingleWalletManager';
import { formatAddress } from '@/lib/utils';

interface MetaTxBroadcastProps {
  onWalletConnect?: (address: string) => void;
  onWalletDisconnect?: () => void;
}

function BroadcasterWallet({ onWalletConnect, onWalletDisconnect }: MetaTxBroadcastProps) {
  const { session, isConnecting, connect, disconnect } = useSingleWallet();

  useEffect(() => {
    if (session?.account) {
      onWalletConnect?.(session.account);
    } else {
      onWalletDisconnect?.();
    }
  }, [session, onWalletConnect, onWalletDisconnect]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5" />
          Broadcaster Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!session ? (
          <Button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="w-full"
            variant="outline"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {isConnecting ? 'Connecting...' : 'Connect Broadcaster Wallet'}
          </Button>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

export default function MetaTxBroadcast(props: MetaTxBroadcastProps) {
  const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing VITE_WALLET_CONNECT_PROJECT_ID environment variable');
  }

  return (
    <SingleWalletManagerProvider
      projectId={projectId}
      autoConnect={false}
      metadata={{
        name: 'OpenBlox MetaTx',
        description: 'OpenBlox Meta Transaction Broadcaster',
        url: window.location.origin,
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      }}
    >
      <BroadcasterWallet {...props} />
    </SingleWalletManagerProvider>
  );
} 