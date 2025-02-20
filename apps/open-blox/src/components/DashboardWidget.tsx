import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { ImportContractDialog } from './ImportContractDialog'
import { ContractInfoDialog } from './ContractInfoDialog'
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { BarChart3, Clock, Wallet, Shield } from 'lucide-react'
import type { ContractInfo } from '../lib/verification'
import { localDevnet } from '../config/chains'

export function DashboardWidget() {
  const navigate = useNavigate()
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showContractInfoDialog, setShowContractInfoDialog] = useState(false)
  const [importedAddress, setImportedAddress] = useState('')
  const { address } = useAccount()
  const { data: balance } = useBalance({
    address,
    chainId: localDevnet.id
  })

  const handleImport = (address: string) => {
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your deployed contracts and monitor their performance.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Import Contract
          </Button>
          <Button onClick={() => navigate('/blox-contracts')}>
            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Deploy New Contract
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Wallet Balance */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Wallet Balance
            </div>
            <p className="text-2xl font-bold">
              {balance ? `${Number(formatEther(balance.value)).toFixed(4)} ETH` : '0 ETH'}
            </p>
            <p className="text-xs text-muted-foreground">
              Connected wallet balance
            </p>
          </div>
        </div>

        {/* Total Value Locked */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
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

        {/* Active Contracts */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Active Contracts
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">
              Currently deployed and active
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="group relative overflow-hidden rounded-lg bg-[#0f1729] p-6 transition-colors">
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
      </div>

      <ImportContractDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
      />

      <ContractInfoDialog
        address={importedAddress}
        open={showContractInfoDialog}
        onOpenChange={setShowContractInfoDialog}
        onContinue={handleContractInfoContinue}
      />
    </div>
  )
} 