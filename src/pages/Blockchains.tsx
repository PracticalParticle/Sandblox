import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Network,
  Blocks,
  Activity,
  Shield,
  Wallet,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

const blockchains = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    description: 'The leading smart contract platform',
    icon: <Network className="h-6 w-6" />,
    stats: {
      contracts: '250M+',
      tvl: '$50B+',
      transactions: '1.5M daily'
    }
  },
  {
    id: 'polygon',
    name: 'Polygon',
    description: 'Ethereum scaling solution with fast and low-cost transactions',
    icon: <Shield className="h-6 w-6" />,
    stats: {
      contracts: '100M+',
      tvl: '$5B+',
      transactions: '3M daily'
    }
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    description: 'Layer 2 scaling solution with Ethereum-level security',
    icon: <Blocks className="h-6 w-6" />,
    stats: {
      contracts: '50M+',
      tvl: '$2B+',
      transactions: '500K daily'
    }
  }
]

export default function Blockchains() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8" role="main" aria-label="Blockchains">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-left" tabIndex={0}>Blockchains</h1>
            <p className="mt-2 text-muted-foreground" tabIndex={0}>
              Explore and interact with different blockchain networks
            </p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Blockchain Statistics">
          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Network className="h-4 w-4" aria-hidden="true" />
                Active Networks
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>3</p>
              <p className="text-xs text-muted-foreground">
                Supported blockchains
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Total TVL
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>$57B+</p>
              <p className="text-xs text-muted-foreground">
                Value locked across chains
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Blocks className="h-4 w-4" aria-hidden="true" />
                Daily Transactions
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>5M+</p>
              <p className="text-xs text-muted-foreground">
                Across all networks
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Active Wallets
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>2M+</p>
              <p className="text-xs text-muted-foreground">
                Unique daily users
              </p>
            </div>
          </div>
        </motion.div>

        {/* Blockchain Cards */}
        <motion.div variants={item}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blockchains.map((chain) => (
              <Card key={chain.id} className="p-6 hover:bg-card/80 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        {chain.icon}
                      </div>
                      <h3 className="text-xl font-semibold">{chain.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{chain.description}</p>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm font-medium">Contracts</p>
                        <p className="text-sm text-muted-foreground">{chain.stats.contracts}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">TVL</p>
                        <p className="text-sm text-muted-foreground">{chain.stats.tvl}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tx/Day</p>
                        <p className="text-sm text-muted-foreground">{chain.stats.transactions}</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
} 