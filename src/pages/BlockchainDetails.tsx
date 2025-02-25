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
import { Card, CardContent } from '@/components/ui/card'
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
    chainId: '1',
    isPublic: true
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function BlockchainDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [network, setNetwork] = useState<NetworkType | null>(null)

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

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${description} copied to clipboard`
    })
  }

  if (!network) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Network not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/blockchains')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold">{network.name}</h1>
            {network.isOfficial && (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            )}
          </div>
        </div>

        {/* Network Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Network Type</h3>
                  <Badge variant={network.isPublic ? "default" : "secondary"}>
                    {network.isPublic ? "Public" : "Private"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Chain ID</h3>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1">
                      {network.chainId}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(network.chainId || '', 'Chain ID')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {network.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Stats */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Network Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">Contracts</p>
                      <p className="text-2xl font-bold">{network.stats.contracts}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">TVL</p>
                      <p className="text-2xl font-bold">{network.stats.tvl}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tx/Day</p>
                      <p className="text-2xl font-bold">{network.stats.transactions}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  )
} 