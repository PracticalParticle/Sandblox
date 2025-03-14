import { useAccount, useBalance, usePublicClient } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
import { formatTokenBalance } from '@/lib/utils'
import type { SecureContractInfo } from '@/lib/types'
import { useDeployedContract } from '@/contexts/DeployedContractContext'

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
    chainId: number;
    chainName: string;
  }
  onDetectType: (address: string) => Promise<void>
  isDetecting: boolean
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

  const handleEnterBlox = () => {
    navigate(`/blox/${contract.type}/${contract.address}`);
  };

  return (
    <Card className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{contract.name}</h3>
          <p className="text-sm text-muted-foreground">{contract.address}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Type: {contract.type === 'unknown' ? 'Not detected' : contract.type}
            </p>
            {contract.chainName && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {contract.chainName}
                </p>
              </>
            )}
          </div>
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
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/blox-security/${contract.address}`)}
              >
                <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
                Manage Security
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
                onClick={() => navigate(`/blox-security/${contract.address}`)}
              >
                <Shield className="h-4 w-4 mr-2" aria-hidden="true" />
                Manage Security
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
    chainId: number;
    chainName: string;
  }>>(() => {
    const storedContracts = localStorage.getItem('dashboardContracts')
    return storedContracts ? JSON.parse(storedContracts) : []
  })
  const publicClient = usePublicClient()
  const { lastDeployedContract } = useDeployedContract()

  useEffect(() => {
    if (!isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  useEffect(() => {
    localStorage.setItem('dashboardContracts', JSON.stringify(contracts))
  }, [contracts])

  // Add effect to handle newly deployed contracts
  useEffect(() => {
    if (lastDeployedContract) {
      // Check if contract already exists in the dashboard
      const contractExists = contracts.some(c => 
        c.address.toLowerCase() === lastDeployedContract.contractAddress.toLowerCase()
      )

      if (!contractExists) {
        // Add the newly deployed contract to the dashboard
        const newContract = {
          id: lastDeployedContract.contractAddress,
          name: lastDeployedContract.contractName || 'Deployed Contract',
          address: lastDeployedContract.contractAddress,
          type: lastDeployedContract.contractType || 'unknown',
          chainId: lastDeployedContract.chainId,
          chainName: lastDeployedContract.chainName
        }

        setContracts(prev => [...prev, newContract])
        
        toast({
          title: "Contract automatically imported",
          description: "Your newly deployed contract has been added to the dashboard.",
          variant: "default"
        })
      }
    }
  }, [lastDeployedContract, contracts, toast])

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
        name: 'Particle Secured Contract',
        address: contractInfo.address,
        type: 'unknown',
        chainId: contractInfo.chainId,
        chainName: contractInfo.chainName
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
      const identifiedContract = await identifyContract(address, publicClient)
      
      setContracts(prev => 
        prev.map(contract => 
          contract.address === address 
            ? {
                ...contract,
                name: identifiedContract.name || contract.name,
                type: identifiedContract.type || 'unknown',
                chainId: contract.chainId,
                chainName: contract.chainName
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
          ? { 
              ...contract,
              type, 
              name,
              chainId: contract.chainId,
              chainName: contract.chainName
            }
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
            <h1 className="text-3xl font-bold tracking-tight text-left">My Blox Dashboard</h1>
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
                {balanceData ? `${formatTokenBalance(balanceData.value, balanceData.decimals)} ${balanceData.symbol}` : '0.0000 ETH'}
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