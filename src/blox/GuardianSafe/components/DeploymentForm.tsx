import { useAccount } from 'wagmi'
import { Address } from 'viem'
import { BaseDeploymentForm, type FormField } from '@/components/BaseDeploymentForm'

interface DeploymentFormProps {
  onDeploy: (params: {
    initialOwner: Address,
    broadcaster: Address,
    recovery: Address,
    safeAddress: Address,
    delegatedCallEnabled: boolean,
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
      description: 'The primary address that will control the GuardianSafe',
      defaultValue: address,
      validate: (value) => {
        if (!value || !value.startsWith('0x')) return 'Must be a valid Ethereum address'
        return undefined;
      }
    },
    {
      id: 'broadcaster',
      label: 'Broadcaster Address',
      placeholder: '0x...',
      description: 'Address authorized to broadcast meta-transactions',
      validate: (value) => {
        if (!value || !value.startsWith('0x')) return 'Must be a valid Ethereum address'
        return undefined;
      }
    },
    {
      id: 'recovery',
      label: 'Recovery Address',
      placeholder: '0x...',
      description: 'Backup address for emergency access',
      validate: (value) => {
        if (!value || !value.startsWith('0x')) return 'Must be a valid Ethereum address'
        return undefined;
      }
    },
    {
      id: 'safeAddress',
      label: 'Safe Address',
      placeholder: '0x...',
      description: 'The address of the underlying Safe contract to manage',
      validate: (value) => {
        if (!value || !value.startsWith('0x')) return 'Must be a valid Ethereum address'
        return undefined;
      }
    },
    {
      id: 'delegatedCallEnabled',
      label: 'Enable Delegated Calls',
      type: 'checkbox',
      description: 'Allow execution of delegated calls (advanced feature)',
      defaultValue: 'false',
      validate: (value) => {
        // No validation needed for boolean
        return undefined;
      }
    },
    {
      id: 'timeLockPeriodInDays',
      label: 'Time Lock Period (Days)',
      type: 'number',
      min: 1,
      max: 89,
      description: 'Transaction approval delay in days (1-89)',
      defaultValue: '7',
      validate: (value) => {
        const days = parseInt(value)
        if (isNaN(days) || days < 1 || days > 89) {
          return 'Time lock period must be between 1 and 89 days'
        }
        return undefined;
      }
    }
  ]

  // Custom onDeploy handler to convert delegatedCallEnabled to boolean
  const handleDeploy = async (params: Record<string, any>) => {
    // Convert delegatedCallEnabled from string to boolean
    const processedParams = {
      ...params,
      initialOwner: params.initialOwner as Address,
      broadcaster: params.broadcaster as Address,
      recovery: params.recovery as Address,
      safeAddress: params.safeAddress as Address,
      timeLockPeriodInDays: parseInt(params.timeLockPeriodInDays),
      delegatedCallEnabled: params.delegatedCallEnabled === 'true' || params.delegatedCallEnabled === true
    };
    
    // Call the provided onDeploy function with processed parameters
    await onDeploy(processedParams);
  };

  return (
    <BaseDeploymentForm
      title="Deploy GuardianSafe"
      description="Configure your GuardianSafe's security parameters. This contract adds a time-lock and meta-transaction layer to an existing Safe contract."
      fields={fields}
      onDeploy={handleDeploy}
      isLoading={isLoading}
    />
  )
}
