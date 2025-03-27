import { useAccount } from 'wagmi'
import { Address } from 'viem'
import { BaseDeploymentForm, type FormField } from '@/components/BaseDeploymentForm'

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
      id: 'timeLockPeriodInDays',
      label: 'Time Lock Period (Days)',
      type: 'number',
      min: 1,
      max: 89,
      description: 'Withdrawal delay in days (1-89)',
      defaultValue: '7',
      validate: (value) => {
        const days = parseInt(value)
        if (isNaN(days) || days < 1 || days > 89) {
          return 'Time lock period must be between 1 and 89 days'
        }
      }
    }
  ]

  return (
    <BaseDeploymentForm
      title="Deploy SimpleVault"
      description="Configure your vault's security parameters. Choose addresses carefully as they control critical vault operations."
      fields={fields}
      onDeploy={onDeploy}
      isLoading={isLoading}
    />
  )
} 