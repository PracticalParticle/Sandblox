import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import React from 'react'
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
  Plus,
  Download,
  Loader2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { ImportContractDialog } from '../components/ImportContractDialog'
import { ContractInfoDialog } from '../components/ContractInfoDialog'
import type { ContractInfo } from '../lib/verification'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'

// We'll replace this with real data from your contract management system later
const DEPLOYED_CONTRACTS: Array<{
  id: string;
  name: string;
  address: string;
  type: string;
}> = [];

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

interface DeployedContractProps {
  contract: {
    id: string;
    name: string;
    address: string;
    type: string;
  }
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load contract UI. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

const DeployedContract = ({ contract }: DeployedContractProps) => {
  const [error, setError] = useState<Error | null>(null);
  
  // Dynamically import the UI component for this contract type
  const ContractUI = lazy(() => 
    import(`../blox/${contract.type}/${contract.type}.ui`)
      .catch(err => {
        setError(err);
        return { default: () => null };
      })
  );

  if (error) {
    return (
      <Card className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{contract.name}</h3>
          <p className="text-sm text-muted-foreground">{contract.address}</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load contract UI: {error.message}
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <ErrorBoundary>
        <div className="relative rounded-lg">
          <Suspense fallback={
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <ContractUI 
              contractAddress={contract.address as `0x${string}`}
              dashboardMode={true}
            />
          </Suspense>
        </div>
      </ErrorBoundary>
    </Card>
  );
};

export function Dashboard() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showContractInfoDialog, setShowContractInfoDialog] = useState(false)
  const [importedAddress, setImportedAddress] = useState('')

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleImportContract = (address: string) => {
    setImportedAddress(address)
    setShowImportDialog(false)
    setShowContractInfoDialog(true)
  }

  const handleContractInfoContinue = (contractInfo: ContractInfo) => {
    setShowContractInfoDialog(false)
    // TODO: Handle the imported contract (e.g., add to list, navigate to details, etc.)
    console.log('Contract imported:', contractInfo)
  }

  return (
    <div className="container py-8">
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
          <div className="ml-auto flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
            >
              <Download className="mr-2 h-4 w-4" />
              Import Contract
            </Button>
            <Button
              onClick={() => navigate('/blox-contracts')}
            >
              <Plus className="mr-2 h-4 w-4" />
              Deploy New Contract
            </Button>
          </div>
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
            {DEPLOYED_CONTRACTS.length === 0 ? (
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
            ) : (
              <div className="grid gap-6">
                {DEPLOYED_CONTRACTS.map((contract) => (
                  <DeployedContract key={contract.id} contract={contract} />
                ))}
              </div>
            )}
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

        <ImportContractDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportContract}
        />

        <ContractInfoDialog
          address={importedAddress}
          open={showContractInfoDialog}
          onOpenChange={setShowContractInfoDialog}
          onContinue={handleContractInfoContinue}
        />
      </motion.div>
    </div>
  )
} 