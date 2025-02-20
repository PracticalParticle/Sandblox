import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { useAccount, useBalance, useChainId, usePublicClient } from 'wagmi'
import { formatEther } from 'viem'
import { BarChart3, Clock, Wallet, Shield, Wifi, WifiOff } from 'lucide-react'
import { localDevnet } from '../config/chains'
import { Alert, AlertDescription } from './ui/alert'

export function DashboardWidget() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: balance, isError: balanceError, error, isLoading: balanceLoading } = useBalance({
    address,
    chainId: localDevnet.id,
    unit: 'ether'
  })

  // Debug logging
  useEffect(() => {
    if (balanceError) {
      console.error('Balance loading error:', error)
    }
    console.log('Connection status:', {
      isConnected,
      chainId,
      address,
      publicClient: !!publicClient,
      balance: balance ? parseFloat(formatEther(balance.value)).toFixed(2) : '0.00',
    })
  }, [isConnected, chainId, address, balance, balanceError, error, publicClient])

  // Network connection status
  const isCorrectNetwork = chainId === localDevnet.id
  const networkStatus = isConnected && isCorrectNetwork
    ? 'connected'
    : isConnected
    ? 'wrong-network'
    : 'disconnected'

  // Format balance display
  const getBalanceDisplay = () => {
    if (balanceError) {
      console.error('Error fetching balance:', error)
      return <span className="text-red-500">Error loading balance</span>
    }
    if (!isConnected) {
      return <span className="text-muted-foreground">Not connected</span>
    }
    if (balanceLoading) {
      return <span className="text-muted-foreground">Loading...</span>
    }
    if (balance) {
      return `${parseFloat(formatEther(balance.value)).toFixed(2)} ${balance.symbol}`
    }
    return '0 ETH'
  }

  return (
    <div className="container py-8">
      {/* Network Status */}
      {networkStatus !== 'connected' && (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            {networkStatus === 'wrong-network' 
              ? `Please switch to ${localDevnet.name} network (Chain ID: ${localDevnet.id})`
              : 'Please connect your wallet to continue'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            {networkStatus === 'connected' && (
              <div className="flex items-center gap-1 text-sm text-green-500">
                <Wifi className="h-4 w-4" />
                <span>{localDevnet.name}</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            Manage your deployed contracts and monitor their performance.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/blox-contracts')} disabled={!isCorrectNetwork}>
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Deploy New Contract
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Wallet Balance */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Wallet Balance
            </div>
            <p className="text-2xl font-bold">
              {getBalanceDisplay()}
            </p>
            <p className="text-xs text-muted-foreground">
              Connected wallet balance
            </p>
          </div>
        </div>

        {/* Total Value Locked */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Total Value Locked
            </div>
            <p className="text-2xl font-bold">0 ETH</p>
            <p className="text-xs text-muted-foreground">
              Across all deployed contracts
            </p>
          </div>
        </div>

        {/* Active Contracts */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Active Contracts
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">
              Currently deployed and active
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Recent Transactions
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">
              In the last 24 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 