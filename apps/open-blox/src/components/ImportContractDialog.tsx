import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { isValidEthereumAddress } from '../lib/utils'

interface ImportContractDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (address: string) => void
}

export function ImportContractDialog({ isOpen, onClose, onImport }: ImportContractDialogProps) {
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleImport = () => {
    if (!address) {
      setError('Please enter a contract address')
      return
    }

    if (!isValidEthereumAddress(address)) {
      setError('Please enter a valid Ethereum address')
      return
    }

    setError(null)
    onImport(address)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Existing Contract</DialogTitle>
          <DialogDescription>
            Enter the address of an existing contract to import it into your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="contract-address"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Contract Address
            </label>
            <input
              id="contract-address"
              placeholder="0x..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setError(null)
              }}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport}>
              Import Contract
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 