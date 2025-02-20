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
import { useToast } from '../components/ui/use-toast'
import { useSecureContract } from '@/hooks/useSecureContract'
import { Address } from 'viem'
import { ImportContract } from '../components/ImportContract'

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

export function Dashboard(): JSX.Element {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  const handleImportSuccess = (contractInfo: any) => {
    toast({
      title: "Contract imported successfully",
      description: "The contract has been imported and is ready to use.",
      variant: "default"
    })
    // You can add additional logic here if needed
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col space-y-8">
        {/* Header */}
        <div className="flex items-center justify-start">
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
        </div>

        {/* No Contracts Message */}
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
      </div>
    </div>
  )
} 