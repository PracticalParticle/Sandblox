import { useState } from 'react'
import { Button } from './ui/button'
import { ImportContractDialog } from './ImportContractDialog'
import { ContractInfoDialog } from './ContractInfoDialog'
import type { ContractInfo } from '../lib/verification'

export function DashboardWidget() {
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showContractInfoDialog, setShowContractInfoDialog] = useState(false)
  const [importedAddress, setImportedAddress] = useState('')

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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => setShowImportDialog(true)}>
          Import Existing Contract
        </Button>
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

      {/* Rest of the dashboard content */}
    </div>
  )
} 