import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Network,
  Shield,
  ArrowLeft,
  Link as LinkIcon,
  Globe,
  Hash,
  Server,
  CheckCircle2,
  XCircle,
  Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'

interface NetworkType {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  stats: {
    contracts: string;
    tvl: string;
    transactions: string;
  };
  isOfficial?: boolean;
  rpcUrls: string[];
  chainId?: string;
  isPublic?: boolean;
}

const defaultNetworks = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    description: 'The leading smart contract platform',
    icon: <Network className="h-6 w-6" />,
    stats: {
      contracts: '250M+',
      tvl: '$50B+',
      transactions: '1.5M daily'
    },
    isOfficial: true,
    rpcUrls: ['https://eth-mainnet.g.alchemy.com'],
    chainId: '1',
    isPublic: true
  }
}

export default function BlockchainDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [network, setNetwork] = useState<NetworkType | null>(null)
  const [rpcHealthStatus, setRpcHealthStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Load network data
    if (!id) return

    // Check if it's a default network
    if (id in defaultNetworks) {
      setNetwork(defaultNetworks[id as keyof typeof defaultNetworks])
      return
    }

    // Load from localStorage for custom networks
    const saved = localStorage.getItem('customNetworks')
    if (saved) {
      try {
        const networks = JSON.parse(saved)
        const foundNetwork = networks.find((n: NetworkType) => n.id === id)
        if (foundNetwork) {
          // Restore the icon
          setNetwork({
            ...foundNetwork,
            icon: <Shield className="h-6 w-6" />
          })
        }
      } catch (e) {
        console.error('Failed to load network details:', e)
      }
    }
  }, [id])

  useEffect(() => {
    // Check RPC endpoints health
    if (!network) return

    const checkRpcHealth = async (url: string) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        })
        const data = await response.json()
        return !!data.result
      } catch (e) {
        return false
      }
    }

    network.rpcUrls.forEach(async (url) => {
      const isHealthy = await checkRpcHealth(url)
      setRpcHealthStatus(prev => ({
        ...prev,
        [url]: isHealthy
      }))
    })
  }, [network])

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: `${description} copied to clipboard`
    })
  }

  if (!network) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Network not found</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/blockchains')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{network.name}</h1>
            <p className="text-muted-foreground">{network.description}</p>
          </div>
          {network.isOfficial && (
            <Badge variant="secondary" className="ml-auto gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Official Support
            </Badge>
          )}
        </div>

        {/* Network Information */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Network Details</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Network Type</span>
                </div>
                <span className="text-sm">
                  {network.isPublic ? 'Public Network' : 'Private Network'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Chain ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{network.chainId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(network.chainId || '', 'Chain ID')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">RPC Endpoints</span>
                </div>
                <div className="space-y-3">
                  {network.rpcUrls.map((url, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        {rpcHealthStatus[url] !== undefined && (
                          rpcHealthStatus[url] ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )
                        )}
                        <span className="text-sm truncate">{url}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToClipboard(url, 'RPC URL')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Network Statistics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Contracts</span>
                <span className="text-sm">{network.stats.contracts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Value Locked</span>
                <span className="text-sm">{network.stats.tvl}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Daily Transactions</span>
                <span className="text-sm">{network.stats.transactions}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Connect Wallet
            </Button>
            <Button variant="outline" className="gap-2">
              <Globe className="h-4 w-4" />
              View Explorer
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
} 