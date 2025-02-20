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
  PackageX,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { ImportContractDialog } from '../components/ImportContractDialog'
import { DashboardWidget } from '../components/DashboardWidget'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { toast } from '../components/ui/use-toast'
import { useSecureContract } from '@/hooks/useSecureContract'
import { Address } from 'viem'

// Update the initial contracts data with the correct type
const DEPLOYED_CONTRACTS: Array<{
  id: string;
  name: string;
  address: string;
  type: string;
}> = [{
  id: 'simple-vault',
  name: 'Simple Vault',
  address: '0xe73F9B85b3a040F9AD6422C1Ea4864C2Db0c2cdD',
  type: 'simple-vault'
}];

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

const DeployedContract = ({ contract, onUnload }: DeployedContractProps & { onUnload?: (address: string) => void }) => {
  const [error, setError] = useState<Error | null>(null);
  const navigate = useNavigate();
  
  const handlePreviewClick = () => {
    navigate(`/preview/${contract.id}`);
  };

  // Dynamically import the UI component for this contract type
  const ContractUI = lazy(() => {
    // Map contract type to component path
    const componentPath = {
      'simple-vault': 'SimpleVault'
    }[contract.type] || 'SimpleVault';
    
    console.log(`Loading UI component for contract type: ${componentPath}`);
    
    return import(`../blox/${componentPath}/${componentPath}.ui.tsx`)
      .catch(err => {
        console.error(`Failed to load contract UI for type ${componentPath}:`, err);
        setError(new Error(`Failed to load contract UI: ${err.message}`));
        return { default: () => null };
      });
  });

  if (error) {
    return (
      <Card className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{contract.name}</h3>
          <p className="text-sm text-muted-foreground">{contract.address}</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{contract.name}</h3>
          <p className="text-sm text-muted-foreground">{contract.address}</p>
        </div>
        <div className="flex gap-2">
          {onUnload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnload(contract.address)}
              className="text-muted-foreground hover:text-muted-foreground/80 hover:bg-muted/50"
            >
              <PackageX className="h-4 w-4 mr-2" aria-hidden="true" />
              Unload
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePreviewClick}
          >
            Preview
          </Button>
        </div>
      </div>
      <ErrorBoundary>
        <div className="relative rounded-lg">
          <Suspense fallback={
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <ContractUI 
              contractAddress={contract.address as `0x${string}`}
              contractInfo={{
                address: contract.address as `0x${string}`,
                type: 'simple-vault',
                name: contract.name,
                category: 'Storage',
                description: 'A secure vault contract for storing and managing assets with basic access controls.',
                bloxId: 'simple-vault'
              }}
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
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { validateAndLoadContract } = useSecureContract()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleImportContract = async (address: string) => {
    setShowImportDialog(false)
    setLoadingContracts(true)
    setError(null)
    
    try {
      await validateAndLoadContract(address as Address)
      toast({
        title: "Contract validated",
        description: "The contract has been validated successfully.",
        variant: "default"
      })
    } catch (error) {
      console.error('Error validating contract:', error)
      setError(error instanceof Error ? error.message : 'Failed to validate contract')
      toast({
        title: "Validation failed",
        description: error instanceof Error ? error.message : 'Failed to validate contract',
        variant: "destructive"
      })
    } finally {
      setLoadingContracts(false)
    }
  }

  return (
    <div className="container py-8">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        <DashboardWidget />

        {error && (
          <motion.div variants={item} role="alert">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Contracts Section */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Contracts</h2>
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

        <ImportContractDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportContract}
        />
      </motion.div>
    </div>
  )
} 