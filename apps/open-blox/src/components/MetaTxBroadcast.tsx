import React, { useState } from 'react'
import { createConfig, WagmiProvider, useConnect, useAccount, useDisconnect } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { createWalletClient, http } from 'viem'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, Radio, X } from 'lucide-react'

// Create a separate Wagmi configuration for MetaTx Broadcast
const metaTxConfig = createConfig({
  chains: [mainnet],
  client: ({ chain }) => 
    createWalletClient({
      chain,
      transport: http()
    }),
})

const MetaTxBroadcast: React.FC = () => {
  const { connect, connectors } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [isMetaTxWalletConnected, setIsMetaTxWalletConnected] = useState(false)

  const handleConnect = async () => {
    const connector = connectors[0] // WalletConnect connector
    try {
      await connect({ connector })
      setIsMetaTxWalletConnected(true)
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setIsMetaTxWalletConnected(false)
  }

  const handleBroadcast = () => {
    // Implement meta-transaction broadcasting logic here
    console.log('Broadcasting meta-transaction...')
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          MetaTx Broadcast
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
            Connect MetaTx Wallet
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <Button
                onClick={handleDisconnect}
                variant="ghost"
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleBroadcast}
              className="w-full"
            >
              <Radio className="mr-2 h-4 w-4" />
              Broadcast MetaTx
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const MetaTxBroadcastWrapper: React.FC = () => {
  return (
    <WagmiProvider config={metaTxConfig}>
      <MetaTxBroadcast />
    </WagmiProvider>
  )
}

export default MetaTxBroadcastWrapper 