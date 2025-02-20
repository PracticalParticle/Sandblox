import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { identifyContract, type ContractInfo } from '../lib/verification'

interface ContractInfoDialogProps {
  address: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onContinue: (contractInfo: ContractInfo) => void
}

export function ContractInfoDialog({
  address,
  open,
  onOpenChange,
  onContinue,
}: ContractInfoDialogProps) {
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContractInfo() {
      if (!address || !open) return
      
      try {
        setLoading(true)
        setError(null)
        const info = await identifyContract(address)
        setContractInfo(info)
      } catch (err) {
        setError('Failed to identify contract. Please ensure the address is valid.')
        console.error('Error loading contract info:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContractInfo()
  }, [address, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contract Information</DialogTitle>
          <DialogDescription>
            {loading ? (
              'Analyzing contract...'
            ) : error ? (
              error
            ) : contractInfo ? (
              <>
                <p className="mt-2">
                  Contract Type:{' '}
                  <span className="font-medium">
                    {contractInfo.type === 'known'
                      ? contractInfo.name
                      : 'Unknown Contract'}
                  </span>
                </p>
                {contractInfo.type === 'known' && (
                  <>
                    <p className="mt-2">
                      Category: <span className="font-medium">{contractInfo.category}</span>
                    </p>
                    <p className="mt-2">
                      Description: {contractInfo.description}
                    </p>
                  </>
                )}
                <p className="mt-2">
                  Address: <span className="font-medium break-all">{address}</span>
                </p>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => contractInfo && onContinue(contractInfo)}
            disabled={loading || !!error || !contractInfo}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 