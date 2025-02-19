import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Clock,
  Wallet,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

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

export function Dashboard() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  return (
    <div className="container py-8 ">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-left">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your deployed contracts and monitor their performance.
            </p>
          </div>
          <button
            onClick={() => navigate('/blox-contracts')}
            className="btn ml-auto"
          >
            Deploy New Contract
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
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

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Active Contracts
              </div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-muted-foreground">
                Currently deployed and active
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
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

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Security Score
              </div>
              <p className="text-2xl font-bold">100%</p>
              <p className="text-xs text-muted-foreground">
                All contracts are secure
              </p>
            </div>
          </div>
        </motion.div>

        {/* Contracts Section */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Deployed Contracts</h2>
          </div>
          <div className="p-4">
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">No Contracts Deployed</h3>
                <p className="text-sm text-muted-foreground">
                  Get started by deploying your first smart contract.
                </p>
              </div>
              <button
                onClick={() => navigate('/blox-contracts')}
                className="btn"
              >
                Browse Contracts
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Activity Section */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Recent Activity</h2>
          </div>
          <div className="divide-y">
            <div className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-left">Contract Deployment Initiated</p>
                <p className="text-sm text-muted-foreground text-left">
                  SimpleVault contract deployment started
                </p>
              </div>
              <p className="text-sm text-muted-foreground">2 mins ago</p>
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-500/10 p-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-left">Transaction Confirmed</p>
                <p className="text-sm text-muted-foreground text-left">
                  0.1 ETH transferred successfully
                </p>
              </div>
              <p className="text-sm text-muted-foreground">5 mins ago</p>
              
            </div>
            <div className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-red-500/10 p-2">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-left">Transaction Failed</p>
                <p className="text-sm text-muted-foreground text-left">
                  Insufficient gas for contract deployment
                </p>
              </div>
              <p className="text-sm text-muted-foreground">10 mins ago</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
} 