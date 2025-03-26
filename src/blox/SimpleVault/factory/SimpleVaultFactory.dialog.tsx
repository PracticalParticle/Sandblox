import { useState } from 'react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { DeploymentForm } from '../components/DeploymentForm'
import { useWriteContract } from 'wagmi'
import { Address } from 'viem'
import { Alert, AlertDescription } from "@/components/ui/alert"

const factoryABI = [
  {
    name: 'createVault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'initialOwner', type: 'address' },
      { name: 'broadcaster', type: 'address' },
      { name: 'recovery', type: 'address' },
      { name: 'timeLockPeriodInDays', type: 'uint256' }
    ],
    outputs: [{ name: 'vault', type: 'address' }]
  }
] as const

interface SimpleVaultFactoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  factoryAddress: Address
}

function SimpleVaultFactoryDialog({ open, onOpenChange, factoryAddress }: SimpleVaultFactoryDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { writeContract } = useWriteContract()

  const handleDeploy = async (params: {
    initialOwner: Address,
    broadcaster: Address,
    recovery: Address,
    timeLockPeriodInDays: number
  }) => {
    try {
      setError(null)
      setIsLoading(true)
      await writeContract({
        abi: factoryABI,
        address: factoryAddress,
        functionName: 'createVault',
        args: [
          params.initialOwner,
          params.broadcaster,
          params.recovery,
          BigInt(params.timeLockPeriodInDays)
        ]
      })
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DeploymentForm
          onDeploy={handleDeploy}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  )
}

export default SimpleVaultFactoryDialog
