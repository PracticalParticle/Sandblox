import { useState } from 'react'
import { Address } from 'viem'
import { useAccount } from 'wagmi'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface DeploymentFormProps {
  onDeploy: (params: {
    initialOwner: Address,
    broadcaster: Address,
    recovery: Address,
    timeLockPeriodInDays: number
  }) => Promise<void>
  isLoading?: boolean
}

export function DeploymentForm({ onDeploy, isLoading }: DeploymentFormProps) {
  const { address } = useAccount()
  const [formData, setFormData] = useState({
    initialOwner: address || '',
    broadcaster: '',
    recovery: '',
    timeLockPeriodInDays: '7'
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      // Validate addresses
      if (!formData.initialOwner || !formData.broadcaster || !formData.recovery) {
        throw new Error('All addresses must be provided')
      }

      // Validate timelock period
      const timeLockPeriod = parseInt(formData.timeLockPeriodInDays)
      if (isNaN(timeLockPeriod) || timeLockPeriod >= 90 || timeLockPeriod <= 0) {
        throw new Error('Time lock period must be between 1 and 89 days')
      }

      await onDeploy({
        initialOwner: formData.initialOwner as Address,
        broadcaster: formData.broadcaster as Address,
        recovery: formData.recovery as Address,
        timeLockPeriodInDays: timeLockPeriod
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy SimpleVault</CardTitle>
        <CardDescription>
          Configure your vault's security parameters. Choose addresses carefully as they control critical vault operations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="initialOwner">Initial Owner Address</Label>
            <Input
              id="initialOwner"
              placeholder="0x..."
              value={formData.initialOwner}
              onChange={(e) => setFormData(prev => ({ ...prev, initialOwner: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              The primary address that will control the vault
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcaster">Broadcaster Address</Label>
            <Input
              id="broadcaster"
              placeholder="0x..."
              value={formData.broadcaster}
              onChange={(e) => setFormData(prev => ({ ...prev, broadcaster: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Address authorized to broadcast meta-transactions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery">Recovery Address</Label>
            <Input
              id="recovery"
              placeholder="0x..."
              value={formData.recovery}
              onChange={(e) => setFormData(prev => ({ ...prev, recovery: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Backup address for emergency access
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeLockPeriodInDays">Time Lock Period (Days)</Label>
            <Input
              id="timeLockPeriodInDays"
              type="number"
              min="1"
              max="89"
              value={formData.timeLockPeriodInDays}
              onChange={(e) => setFormData(prev => ({ ...prev, timeLockPeriodInDays: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">
              Withdrawal delay in days (1-89)
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              'Deploy Vault'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
} 