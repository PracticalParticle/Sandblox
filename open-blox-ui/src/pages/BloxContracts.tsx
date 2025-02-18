import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  ArrowRight,
  Shield,
  Clock,
  Wallet,
  ChevronDown,
} from 'lucide-react'

interface Contract {
  id: string
  name: string
  description: string
  category: string
  securityLevel: 'Basic' | 'Advanced' | 'Enterprise'
  deployments: number
  lastUpdated: string
}

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'simple-vault',
    name: 'Simple Vault',
    description: 'A secure vault contract for storing and managing assets with basic access controls.',
    category: 'Storage',
    securityLevel: 'Basic',
    deployments: 1234,
    lastUpdated: '2024-02-15',
  },
  {
    id: 'multi-sig-wallet',
    name: 'Multi-Signature Wallet',
    description: 'A wallet requiring multiple signatures for transaction approval.',
    category: 'Wallet',
    securityLevel: 'Advanced',
    deployments: 856,
    lastUpdated: '2024-02-14',
  },
  {
    id: 'token-vesting',
    name: 'Token Vesting',
    description: 'A contract for managing token vesting schedules with time-locks.',
    category: 'Tokens',
    securityLevel: 'Advanced',
    deployments: 567,
    lastUpdated: '2024-02-13',
  },
]

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

export function BloxContracts() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSecurityLevel, setSelectedSecurityLevel] = useState<string | null>(
    null
  )

  const filteredContracts = MOCK_CONTRACTS.filter((contract) => {
    const matchesSearch =
      contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || contract.category === selectedCategory
    const matchesSecurityLevel =
      !selectedSecurityLevel || contract.securityLevel === selectedSecurityLevel
    return matchesSearch && matchesCategory && matchesSecurityLevel
  })

  const categories = Array.from(new Set(MOCK_CONTRACTS.map((c) => c.category)))
  const securityLevels = Array.from(
    new Set(MOCK_CONTRACTS.map((c) => c.securityLevel))
  )

  return (
    <div className="container py-8">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Blox Contracts</h1>
          <p className="max-w-[750px] text-lg text-muted-foreground">
            Browse our collection of pre-audited smart contracts. Each contract is
            thoroughly tested and secured with built-in safety features.
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div variants={item} className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contracts..."
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row lg:w-auto">
            <div className="relative">
              <select
                className="h-9 w-[200px] appearance-none rounded-lg border bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="relative">
              <select
                className="h-9 w-[200px] appearance-none rounded-lg border bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedSecurityLevel || ''}
                onChange={(e) => setSelectedSecurityLevel(e.target.value || null)}
              >
                <option value="">All Security Levels</option>
                {securityLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </motion.div>

        {/* Contract Grid */}
        <motion.div variants={item} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContracts.map((contract) => (
            <motion.div
              key={contract.id}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-xl border bg-card transition-colors hover:bg-card/80"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="relative p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{contract.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors">
                        {contract.category}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          contract.securityLevel === 'Basic'
                            ? 'bg-blue-500/10 text-blue-500'
                            : contract.securityLevel === 'Advanced'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-orange-500/10 text-orange-500'
                        }`}
                      >
                        <Shield className="h-3 w-3" />
                        {contract.securityLevel}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {contract.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Wallet className="h-4 w-4" />
                      {contract.deployments.toLocaleString()} deployments
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Updated {new Date(contract.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/contracts/${contract.id}`)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                >
                  View Details
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {filteredContracts.length === 0 && (
          <motion.div
            variants={item}
            className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
          >
            <div className="rounded-full bg-primary/10 p-3">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">No Contracts Found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
} 