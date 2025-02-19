import React, { useState, useEffect } from 'react'
import { createConfig, WagmiProvider, useConnect, useAccount, useDisconnect } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, X } from 'lucide-react'
import { walletConnect } from 'wagmi/connectors'
import { localDevnet } from '@/config/chains'

// Create a dedicated query client for meta transactions
const metaTxQueryClient = new QueryClient()

// Create a separate Wagmi configuration for meta transactions
const metaTxConfig = createConfig({
  chains: [mainnet, sepolia, localDevnet],
  connectors: [
    walletConnect({
      projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || '',
      metadata: {
        name: 'OpenBlox MetaTx',
        description: 'OpenBlox Meta Transaction Broadcaster',
        url: window.location.origin,
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
    })
  ],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`),
    [localDevnet.id]: http(localDevnet.rpcUrls.default.http[0]),
  },
})

interface MetaTxBroadcastProps {
  onWalletConnect?: (address: string) => void
  onWalletDisconnect?: () => void
}

function MetaTxBroadcastInner({ onWalletConnect, onWalletDisconnect }: MetaTxBroadcastProps) {
  const { connect, connectors } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [isMetaTxWalletConnected, setIsMetaTxWalletConnected] = useState(false)

  useEffect(() => {
    if (isConnected && address && !isMetaTxWalletConnected) {
      setIsMetaTxWalletConnected(true)
      onWalletConnect?.(address)
    } else if (!isConnected && isMetaTxWalletConnected) {
      setIsMetaTxWalletConnected(false)
      onWalletDisconnect?.()
    }
  }, [isConnected, address, isMetaTxWalletConnected, onWalletConnect, onWalletDisconnect])

  const handleConnect = async () => {
    const connector = connectors[0] // WalletConnect connector
    try {
      await connect({ connector })
    } catch (error) {
      console.error('Failed to connect meta tx wallet:', error)
    }
  }

  const handleDisconnect = () => {
    disconnect()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5" />
          Broadcaster Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isMetaTxWalletConnected ? (
          <Button
            onClick={handleConnect}
            className="w-full"
            variant="outline"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Broadcaster Wallet
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Connected Wallet</span>
              <span className="text-xs text-muted-foreground">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="ghost"
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function MetaTxBroadcast(props: MetaTxBroadcastProps) {
  return (
    <WagmiProvider config={metaTxConfig}>
      <QueryClientProvider client={metaTxQueryClient}>
        <MetaTxBroadcastInner {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  )
} 