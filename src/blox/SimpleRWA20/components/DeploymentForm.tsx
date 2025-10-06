import { useAccount } from 'wagmi'
import { Address } from 'viem'
import { BaseDeploymentForm, type FormField } from '@/components/BaseDeploymentForm'
import { TIMELOCK_PERIODS } from '@/constants/contract'

interface DeploymentFormProps {
  onDeploy: (params: {
    name: string,
    symbol: string,
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
      id: 'name',
      label: 'Token Name',
      placeholder: 'My RWA Token',
      description: 'The full name of your token (e.g., "My Real World Asset")',
      validate: (value) => {
        if (!value) return 'Token name is required'
        if (value.length < 3) return 'Token name must be at least 3 characters'
        if (value.length > 50) return 'Token name must be less than 50 characters'
      }
    },
    {
      id: 'symbol',
      label: 'Token Symbol',
      placeholder: 'RWA',
      description: 'The trading symbol for your token (e.g., "RWA")',
      validate: (value) => {
        if (!value) return 'Token symbol is required'
        if (value.length < 2) return 'Symbol must be at least 2 characters'
        if (value.length > 10) return 'Symbol must be less than 10 characters'
        if (!/^[A-Z0-9]+$/.test(value)) return 'Symbol must contain only uppercase letters and numbers'
      }
    },
    {
      id: 'initialOwner',
      label: 'Initial Owner Address',
      placeholder: '0x...',
      description: 'The primary address that will control the token',
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
      description: 'Set the time lock with your preferred unit (1 minute to 90 days)',
      defaultValue: '10080',
      validate: (value) => {
        const num = parseInt(value)
        if (isNaN(num) || num < TIMELOCK_PERIODS.MIN || num > TIMELOCK_PERIODS.MAX) {
          return `Please enter a period between 1 minute and 90 days`
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
      title="Deploy SimpleRWA20 Token"
      description="Configure your token's parameters and security settings. Choose addresses carefully as they control critical token operations."
      fields={fields}
      onDeploy={async (params: any) => {
        const value = Number(params.timeLockValue)
        const unit = params.timeLockUnit as 'minutes' | 'hours' | 'days'
        const minutes = unit === 'minutes' ? value : unit === 'hours' ? value * 60 : value * 24 * 60
        await onDeploy({
          name: params.name,
          symbol: params.symbol,
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