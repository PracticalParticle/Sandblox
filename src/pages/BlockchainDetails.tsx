import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
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
  Copy,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useState, useEffect } from 'react'
import { useStandaloneDeployment } from '@/lib/deployment/standalone'
import { readFileSync } from 'fs'
import { join } from 'path'

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
  libraryAddress?: string;
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

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function BlockchainDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [network, setNetwork] = useState<NetworkType | null>(null)
  const [rpcHealthStatus, setRpcHealthStatus] = useState<Record<string, boolean>>({})
  const [isDeploying, setIsDeploying] = useState(false)
  const [libraryAddress, setLibraryAddress] = useState<string>('')
  const [librarySource, setLibrarySource] = useState<string>('')

  useEffect(() => {
    // Load the library source code
    const loadLibrarySource = async () => {
      try {
        const response = await fetch('/contracts/core/library/MultiPhaseSecureOperation.sol');
        if (!response.ok) throw new Error('Failed to fetch library source');
        const text = await response.text();
        setLibrarySource(text);
      } catch (error) {
        console.error('Error loading library source:', error);
        toast({
          title: 'Error',
          description: 'Failed to load library source code',
          variant: 'destructive',
        });
      }
    };

    loadLibrarySource();
  }, []);

  const deployment = useStandaloneDeployment({
    solidityCode: librarySource,
    compilerVersion: '0.8.25',
    constructorArgs: []
  });

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

  const handleDeployLibrary = async () => {
    if (!address) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    if (!network?.chainId) {
      toast({
        title: 'Error',
        description: 'Invalid network configuration',
        variant: 'destructive',
      });
      return;
    }

    if (!walletClient) {
      toast({
        title: 'Error',
        description: 'Wallet not connected',
        variant: 'destructive',
      });
      return;
    }

    // Check if we're on the right network
    const chainId = parseInt(network.chainId);
    if (!publicClient) {
      toast({
        title: 'Error',
        description: 'Public client not initialized',
        variant: 'destructive',
      });
      return;
    }
    if (publicClient.chain.id !== chainId) {
      toast({
        title: 'Error',
        description: 'Please switch to the correct network in your wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsDeploying(true);
    try {
      await deployment.deploy();
      if (deployment.address) {
        setLibraryAddress(deployment.address);
        
        // Update network with library address in localStorage
        if (network) {
          const saved = localStorage.getItem('customNetworks');
          if (saved) {
            const networks = JSON.parse(saved);
            const updatedNetworks = networks.map((n: NetworkType) => 
              n.id === network.id ? { ...n, libraryAddress: deployment.address } : n
            );
            localStorage.setItem('customNetworks', JSON.stringify(updatedNetworks));
          }
        }

        toast({
          title: 'Success',
          description: 'Library deployed successfully',
        });
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast({
        title: 'Error',
        description: 'Failed to deploy library. Please check console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsDeploying(false);
    }
  };

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
          <Badge 
            variant={network.isOfficial ? "secondary" : "outline"} 
            className="ml-auto gap-1"
          >
            {network.isOfficial ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Official Support
              </>
            ) : (
              <>
                <Shield className="h-3 w-3" />
                Unofficial Support
              </>
            )}
          </Badge>
        </div>

        {/* Network Information */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Network Details</h2>
            </div>
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

        {/* Security Infrastructure */}
        <motion.div variants={item}>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Security Infrastructure</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">MultiPhaseSecureOperation Library:</span>
                  {libraryAddress && (
                    <div className="flex items-center gap-2 ml-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{libraryAddress}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(libraryAddress, 'Library address')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {!network?.isOfficial && !libraryAddress && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={handleDeployLibrary}
                    disabled={isDeploying || !librarySource}
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deploying...
                      </>
                    ) : !librarySource ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading Library...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Deploy Library
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
} 