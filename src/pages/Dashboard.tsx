import { useAccount, useBalance } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import React from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Loader2,
  PackageX,
  Wand2,
  ChevronDown,
  Wallet,
  CircuitBoard,
  Activity,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { ImportContract } from '../components/ImportContract'
import { identifyContract } from '../lib/verification'
import { getAllContracts } from '../lib/catalog'
import type { SecureContractInfo } from '@/lib/types'

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
  onDetectType: (address: string) => Promise<void>
  isDetecting: boolean
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

const DeployedContract = ({ 
  contract, 
  onUnload,
  onDetectType,
  isDetecting,
  onTypeChange 
}: DeployedContractProps & { 
  onUnload?: (address: string) => void,
  onTypeChange: (address: string, type: string, name: string) => void 
}) => {
  const navigate = useNavigate();
  const [availableTypes, setAvailableTypes] = useState<Array<{id: string, name: string}>>([]);
  
  useEffect(() => {
    // Load available contract types from catalog
    getAllContracts().then(contracts => {
      setAvailableTypes(contracts.map(c => ({
        id: c.id,
        name: c.name || c.id
      })));
    });
  }, []);

  const handlePreviewClick = () => {
    navigate(`/preview/${contract.type}`);
  };

  const handleEnterBlox = () => {
    navigate(`/blox/${contract.type}/${contract.address}`);
  };

  return (
    <Card className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{contract.name}</h3>
          <p className="text-sm text-muted-foreground">{contract.address}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Type: {contract.type === 'unknown' ? 'Not detected' : contract.type}
          </p>
        </div>
        <div className="flex gap-2">
          {contract.type === 'unknown' && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Select Type
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {availableTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.id}
                      onClick={() => onTypeChange(contract.address, type.id, type.name)}
                    >
                      {type.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDetectType(contract.address)}
                disabled={isDetecting}
              >
                {isDetecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                Auto Detect
              </Button>
            </>
          )}
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
          {contract.type !== 'unknown' && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePreviewClick}
              >
                Preview
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleEnterBlox}
              >
                Enter Blox
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Show placeholder when type is unknown */}
      {contract.type === 'unknown' && (
        <div className="flex flex-col items-center justify-center h-[200px] rounded-lg border-2 border-dashed border-muted-foreground/20">
          <p className="text-muted-foreground text-sm">
            Click "Auto Detect" to identify the contract type or select it manually
          </p>
        </div>
      )}
    </Card>
  );
};

export function Dashboard(): JSX.Element {
  const { isConnected, address } = useAccount()
  const { data: balanceData } = useBalance({
    address: address,
  })
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isDetecting, setIsDetecting] = useState(false)
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

  const handleImportSuccess = (contractInfo: SecureContractInfo) => {
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

      // Create new contract entry with unknown type initially
      const newContract = {
        id: contractInfo.address,
        name: 'Imported Contract',
        address: contractInfo.address,
        type: 'unknown'
      }

      toast({
        title: "Contract imported successfully",
        description: "The contract has been imported. Click 'Auto Detect' to identify its type.",
        variant: "default"
      })

      return [...prev, newContract]
    })
  }

  const handleDetectType = async (address: string) => {
    setIsDetecting(true)
    try {
      const identifiedContract = await identifyContract(address)
      
      setContracts(prev => 
        prev.map(contract => 
          contract.address === address 
            ? {
                ...contract,
                name: identifiedContract.name || contract.name,
                type: identifiedContract.bloxId || 'unknown'
              }
            : contract
        )
      )

      toast({
        title: "Contract type detected",
        description: `Identified as: ${identifiedContract.name || 'Unknown type'}`,
        variant: "default"
      })
    } catch (error) {
      console.error('Error identifying contract type:', error)
      toast({
        title: "Detection failed",
        description: "Failed to identify contract type. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleTypeChange = (address: string, type: string, name: string) => {
    setContracts(prev => 
      prev.map(contract => 
        contract.address === address 
          ? { ...contract, type, name }
          : contract
      )
    )
    
    toast({
      title: "Contract type updated",
      description: `Contract type manually set to: ${name}`,
      variant: "default"
    })
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
              buttonText="Import Contract"
              buttonIcon="download"
            />
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Dashboard Statistics">
          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Wallet Balance
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>
                {balanceData?.formatted ? `${Number(balanceData.formatted).toFixed(4)} ${balanceData.symbol}` : '0.0000 ETH'}
              </p>
              <p className="text-xs text-muted-foreground">
                Connected wallet balance
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CircuitBoard className="h-4 w-4" aria-hidden="true" />
                Active Contracts
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>{contracts.length}</p>
              <p className="text-xs text-muted-foreground">
                Total imported contracts
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Detected Types
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>
                {contracts.filter(c => c.type !== 'unknown').length}
              </p>
              <p className="text-xs text-muted-foreground">
                Contracts with detected types
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:bg-card/80" role="status">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" aria-hidden="true" />
            <div className="relative space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Ready to Use
              </div>
              <p className="text-2xl font-bold" tabIndex={0}>
                {contracts.filter(c => c.type !== 'unknown').length}
              </p>
              <p className="text-xs text-muted-foreground">
                Contracts ready for interaction
              </p>
            </div>
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
                    onDetectType={handleDetectType}
                    onTypeChange={handleTypeChange}
                    isDetecting={isDetecting}
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