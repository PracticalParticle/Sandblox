import { useAccount } from 'wagmi'
import { Address } from 'viem'
import { BaseDeploymentForm, type FormField } from '@/components/BaseDeploymentForm'
import { TIMELOCK_PERIODS } from '@/constants/contract'

interface DeploymentFormProps {
  onDeploy: (params: {
    initialOwner: Address,
    broadcaster: Address,
    recovery: Address,
    timeLockPeriodInMinutes: number
  }) => Promise<void>
  isLoading?: boolean
}

export function DeploymentForm({ onDeploy, isLoading }: DeploymentFormProps) {
  const { address } = useAccount()

  const fields: FormField[] = [
    {
      id: 'initialOwner',
      label: 'Initial Owner Address',
      placeholder: '0x...',
      description: 'The primary address that will control the vault',
      defaultValue: address,
      validate: (value) => {
        if (!value.startsWith('0x')) return 'Must be a valid Ethereum address'
      }
    },
    {
      id: 'broadcaster',
      label: 'Broadcaster Address',
      placeholder: '0x...',
      description: 'Address authorized to broadcast meta-transactions',
      validate: (value) => {
        if (!value.startsWith('0x')) return 'Must be a valid Ethereum address'
      }
    },
    {
      id: 'recovery',
      label: 'Recovery Address',
      placeholder: '0x...',
      description: 'Backup address for emergency access',
      validate: (value) => {
        if (!value.startsWith('0x')) return 'Must be a valid Ethereum address'
      }
    },
    {
      id: 'timeLockValue',
      label: 'Time Lock Value',
      type: 'number',
      min: 1,
      max: 129600,
      description: 'Set the time lock with your preferred unit (1 day to 90 days)',
      defaultValue: '10080',
      validate: (value) => {
        const num = parseInt(value)
        if (isNaN(num) || num < 1 || num > TIMELOCK_PERIODS.MAX) {
          return `Please enter a period up to 90 days`
        }
      }
    },
    {
      id: 'timeLockUnit',
      label: 'Time Lock Unit',
      type: 'select',
      defaultValue: 'minutes',
      options: [
        { label: 'Minutes', value: 'minutes' },
        { label: 'Hours', value: 'hours' },
        { label: 'Days', value: 'days' }
      ]
    }
  ]

  return (
    <BaseDeploymentForm
      title="Deploy SimpleVault"
      description="Configure your vault's security parameters. Choose addresses carefully as they control critical vault operations."
      fields={fields}
      onDeploy={async (params: any) => {
        const value = Number(params.timeLockValue)
        const unit = params.timeLockUnit as 'minutes' | 'hours' | 'days'
        const minutes = unit === 'minutes' ? value : unit === 'hours' ? value * 60 : value * 24 * 60
        // Enforce SimpleVault contract constraints: 1 day to 90 days
        if (minutes < 1440) {
          throw new Error('Time lock must be at least 1 day (1440 minutes)')
        }
        if (minutes > TIMELOCK_PERIODS.MAX) {
          throw new Error('Time lock must be at most 90 days (129600 minutes)')
        }
        await onDeploy({
          initialOwner: params.initialOwner,
          broadcaster: params.broadcaster,
          recovery: params.recovery,
          timeLockPeriodInMinutes: minutes
        })
      }}
      isLoading={isLoading}
    />
  )
} 