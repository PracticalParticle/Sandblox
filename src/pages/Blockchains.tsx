import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Network,
  Blocks,
  Activity,
  Shield,
  Wallet,
  ArrowRight,
  Plus,
  CheckCircle,
  Settings,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  rpcUrl?: string;
  chainId?: string;
  isPublic?: boolean;
}

const blockchains = {
  public: [
    {
      id: 'ethereum',
      name: 'Ethereum',
      description: 'The leading smart contract platform',
      icon: <Network className="h-6 w-6" />,
      stats: {
        contracts: '250M+',
        tvl: '$50B+',
        transactions: '1.5M daily'
      },
      isOfficial: true
    }
  ],
  private: []
}

interface NetworkFormData {
  name: string;
  rpcUrl: string;
  chainId: string;
  description: string;
  type: 'public' | 'private';
}

export default function Blockchains() {
  const { isConnected } = useAccount()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isAddNetworkOpen, setIsAddNetworkOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingNetwork, setEditingNetwork] = useState<NetworkType | null>(null)
  const [customNetworks, setCustomNetworks] = useState<NetworkType[]>(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem('customNetworks')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Restore the icon JSX element since it was stringified
        return parsed.map((network: NetworkType) => ({
          ...network,
          icon: <Shield className="h-6 w-6" />
        }))
      } catch (e) {
        console.error('Failed to parse saved networks:', e)
        return []
      }
    }
    return []
  })

  // Save to localStorage whenever customNetworks changes
  useEffect(() => {
    try {
      // Remove the icon before stringifying since JSX can't be serialized
      const networksToSave = customNetworks.map(({ icon, ...rest }) => rest)
      localStorage.setItem('customNetworks', JSON.stringify(networksToSave))
    } catch (e) {
      console.error('Failed to save networks to localStorage:', e)
    }
  }, [customNetworks])

  const [newNetwork, setNewNetwork] = useState<NetworkFormData>({
    name: '',
    rpcUrl: '',
    chainId: '',
    description: '',
    type: 'private'
  })

  const handleAddNetwork = async () => {
    try {
      if (!newNetwork.name || !newNetwork.rpcUrl || !newNetwork.chainId || !newNetwork.type) {
        throw new Error('Please fill in all required fields')
      }

      const network: NetworkType = {
        id: `custom-${Date.now()}`,
        name: newNetwork.name,
        description: newNetwork.description || 'Custom blockchain network',
        icon: <Shield className="h-6 w-6" />,
        stats: {
          contracts: '0',
          tvl: '$0',
          transactions: '0 daily'
        },
        rpcUrl: newNetwork.rpcUrl,
        chainId: newNetwork.chainId,
        isPublic: newNetwork.type === 'public'
      }

      setCustomNetworks(prev => [...prev, network])
      
      toast({
        title: "Network Added",
        description: `${newNetwork.name} has been added to your ${newNetwork.type} networks.`
      })
      
      setIsAddNetworkOpen(false)
      setNewNetwork({ name: '', rpcUrl: '', chainId: '', description: '', type: 'private' })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add network",
        variant: "destructive"
      })
    }
  }

  const handleEditNetwork = (network: NetworkType) => {
    setEditingNetwork(network)
    setNewNetwork({
      name: network.name,
      rpcUrl: network.rpcUrl || '',
      chainId: network.chainId || '',
      description: network.description,
      type: network.isPublic ? 'public' : 'private'
    })
    setIsEditMode(true)
    setIsAddNetworkOpen(true)
  }

  const handleUpdateNetwork = async () => {
    try {
      if (!editingNetwork) return

      const updatedNetwork: NetworkType = {
        ...editingNetwork,
        name: newNetwork.name,
        description: newNetwork.description,
        rpcUrl: newNetwork.rpcUrl,
        chainId: newNetwork.chainId
      }

      setCustomNetworks(prev => 
        prev.map(n => n.id === editingNetwork.id ? updatedNetwork : n)
      )

      toast({
        title: "Network Updated",
        description: `${newNetwork.name} has been updated successfully.`
      })

      setIsAddNetworkOpen(false)
      setIsEditMode(false)
      setEditingNetwork(null)
      setNewNetwork({ name: '', rpcUrl: '', chainId: '', description: '', type: 'private' })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update network",
        variant: "destructive"
      })
    }
  }

  const handleDeleteNetwork = (networkId: string, isOfficial: boolean) => {
    if (isOfficial) {
      toast({
        title: "Cannot Delete",
        description: "Official networks cannot be removed.",
        variant: "destructive"
      })
      return
    }
    setCustomNetworks(prev => prev.filter(n => n.id !== networkId))
    toast({
      title: "Network Removed",
      description: "The network has been removed from your supported networks."
    })
  }

  const NetworkCard = ({ chain, isCustom = false }: { chain: NetworkType, isCustom?: boolean }) => (
    <Card className="p-6 hover:bg-card/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              {chain.icon}
            </div>
            <div>
              <h3 className="text-xl font-semibold">{chain.name}</h3>
              {chain.isOfficial && (
                <Badge variant="secondary" className="mt-1 gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Official Support
                </Badge>
              )}
            </div>
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
        {isCustom || chain.isOfficial ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover/95">
              <DropdownMenuItem onClick={() => handleEditNetwork(chain)}>
                Edit Network
              </DropdownMenuItem>
              {!chain.isOfficial && (
                <DropdownMenuItem 
                  onClick={() => handleDeleteNetwork(chain.id, !!chain.isOfficial)}
                  className="text-destructive"
                >
                  Remove Network
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8" role="main" aria-label="Blockchains">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header with Add Network */}
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-left" tabIndex={0}>Blockchains</h1>
            <p className="mt-2 text-muted-foreground" tabIndex={0}>
              Explore and interact with different blockchain networks
            </p>
          </div>
          <Dialog open={isAddNetworkOpen} onOpenChange={(open) => {
            setIsAddNetworkOpen(open)
            if (!open) {
              setIsEditMode(false)
              setEditingNetwork(null)
              setNewNetwork({ name: '', rpcUrl: '', chainId: '', description: '', type: 'private' })
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Network
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit Network' : 'Add New Network'}</DialogTitle>
                <DialogDescription>
                  {isEditMode 
                    ? 'Update your blockchain network settings.'
                    : 'Add a new blockchain network to your supported networks.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Network Type</Label>
                  <Select
                    value={newNetwork.type}
                    onValueChange={(value: 'public' | 'private') => 
                      setNewNetwork(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network type" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover/95">
                      <SelectItem value="public">Public Network</SelectItem>
                      <SelectItem value="private">Private Network</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Network Name</Label>
                  <Input
                    id="name"
                    value={newNetwork.name}
                    onChange={(e) => setNewNetwork(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. My Private Network"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newNetwork.description}
                    onChange={(e) => setNewNetwork(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your network"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rpcUrl">RPC URL</Label>
                  <Input
                    id="rpcUrl"
                    value={newNetwork.rpcUrl}
                    onChange={(e) => setNewNetwork(prev => ({ ...prev, rpcUrl: e.target.value }))}
                    placeholder="e.g. http://localhost:8545"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="chainId">Chain ID</Label>
                  <Input
                    id="chainId"
                    value={newNetwork.chainId}
                    onChange={(e) => setNewNetwork(prev => ({ ...prev, chainId: e.target.value }))}
                    placeholder="e.g. 1337"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  setIsAddNetworkOpen(false)
                  setIsEditMode(false)
                  setEditingNetwork(null)
                  setNewNetwork({ name: '', rpcUrl: '', chainId: '', description: '', type: 'private' })
                }}>
                  Cancel
                </Button>
                <Button onClick={isEditMode ? handleUpdateNetwork : handleAddNetwork}>
                  {isEditMode ? 'Update Network' : 'Add Network'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <p className="text-2xl font-bold" tabIndex={0}>2</p>
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
              <p className="text-2xl font-bold" tabIndex={0}>$50B+</p>
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
              <p className="text-2xl font-bold" tabIndex={0}>1.5M+</p>
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
              <p className="text-2xl font-bold" tabIndex={0}>1M+</p>
              <p className="text-xs text-muted-foreground">
                Unique daily users
              </p>
            </div>
          </div>
        </motion.div>

        {/* Public Blockchain Section */}
        <motion.div variants={item}>
          <h2 className="text-2xl font-semibold mb-6">Public Networks</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blockchains.public.map((chain) => (
              <NetworkCard key={chain.id} chain={chain} />
            ))}
            {customNetworks.filter(network => network.isPublic).map((chain) => (
              <NetworkCard key={chain.id} chain={chain} isCustom />
            ))}
          </div>
        </motion.div>

        {/* Private Blockchain Section */}
        <motion.div variants={item}>
          <h2 className="text-2xl font-semibold mb-6">Private Networks</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {customNetworks.filter(network => !network.isPublic).map((chain) => (
              <NetworkCard key={chain.id} chain={chain} isCustom />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
} 