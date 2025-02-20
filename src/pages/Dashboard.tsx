import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import React from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Loader2,
  PackageX
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { ImportContract } from '../components/ImportContract'
import { identifyContract } from '../lib/verification'

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
    const componentPath = contract.type || 'unknown';
    
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
                type: contract.type,
                name: contract.name,
                category: 'Storage',
                description: 'Contract imported from address',
                bloxId: contract.type
              }}
              dashboardMode={true}
            />
          </Suspense>
        </div>
      </ErrorBoundary>
    </Card>
  );
};

export function Dashboard(): JSX.Element {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [contracts, setContracts] = useState<Array<{
    id: string;
    name: string;
    address: string;
    type: string;
  }>>(() => {
    const storedContracts = localStorage.getItem('dashboardContracts')
    return storedContracts ? JSON.parse(storedContracts) : []
  })

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  useEffect(() => {
    localStorage.setItem('dashboardContracts', JSON.stringify(contracts))
  }, [contracts])

  const handleUnloadContract = (address: string) => {
    setContracts(prev => {
      const filtered = prev.filter(c => c.address !== address)
      toast({
        title: "Contract unloaded",
        description: "The contract has been removed from the dashboard.",
        variant: "default"
      })
      return filtered
    })
  }

  const handleImportSuccess = async (contractInfo: any) => {
    try {
      // First validate it's a SecureOwnable contract
      if (!contractInfo.owner || !contractInfo.broadcaster || !contractInfo.recoveryAddress) {
        throw new Error('Invalid contract type')
      }

      // Then identify the specific contract type
      const identifiedContract = await identifyContract(contractInfo.address)
      
      setContracts(prev => {
        // Check if contract already exists
        if (prev.some(c => c.address === contractInfo.address)) {
          toast({
            title: "Contract already imported",
            description: "This contract has already been imported to the dashboard.",
            variant: "default"
          })
          return prev
        }

        // Create new contract entry with identified type
        const newContract = {
          id: contractInfo.address,
          name: identifiedContract.name || 'Imported Contract',
          address: contractInfo.address,
          type: identifiedContract.bloxId || 'unknown'
        }

        toast({
          title: "Contract imported successfully",
          description: "The contract has been imported and is ready to use.",
          variant: "default"
        })

        return [...prev, newContract]
      })
    } catch (error) {
      console.error('Error processing contract:', error)
      toast({
        title: "Import failed",
        description: "Failed to process contract information.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
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
              Manage your contracts and monitor their activity.
            </p>
          </div>
          <div className="ml-auto">
            <ImportContract
              buttonVariant="outline"
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </motion.div>

        {/* Contracts Section */}
        <motion.div variants={item} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="text-xl font-bold text-left">Contracts</h2>
          </div>
          <div className="p-4">
            {contracts.length > 0 ? (
              <div className="grid gap-6">
                {contracts.map((contract) => (
                  <DeployedContract
                    key={contract.address}
                    contract={contract}
                    onUnload={handleUnloadContract}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">No Contracts Deployed</h3>
                  <p className="text-sm text-muted-foreground">
                    Import your first contract to get started.
                  </p>
                </div>
                <ImportContract
                  buttonVariant="default"
                  buttonIcon="arrow"
                  buttonText="Import your first contract"
                  onImportSuccess={handleImportSuccess}
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
} 