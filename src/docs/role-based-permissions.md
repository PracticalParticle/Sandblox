# Role-Based Permissions in PendingTransactionDialog

This document explains how to use the role-based permission system in the `PendingTransactionDialog` component with the Guardian SDK.

## Overview

The `PendingTransactionDialog` now supports dynamic role-based permissions that are checked on-chain using the Guardian SDK. This allows the dialog to automatically show/hide action buttons based on the connected user's roles and permissions within the contract.

## Key Features

- **Dynamic Permission Checking**: Permissions are checked in real-time using the Guardian SDK
- **Role-Based Actions**: Different actions require different roles (Owner, Broadcaster, etc.)
- **Time Lock Integration**: Actions are enabled/disabled based on time lock expiration
- **Meta Transaction Support**: Full support for meta transaction signing and broadcasting
- **Visual Permission Indicators**: Clear visual feedback showing what actions are available

## Components

### 1. useTransactionPermissions Hook

The `useTransactionPermissions` hook handles all permission checking logic:

```typescript
import { useTransactionPermissions } from '@/hooks/useTransactionPermissions';

const permissions = useTransactionPermissions({
  transaction,
  connectedAddress,
  contractAddress,
  secureOwnable,
  dynamicRBAC,
  definitions,
  timeLockPeriodInMinutes: 60
});
```

**Permission State:**
- `canApprove`: Can approve time-delayed transactions
- `canCancel`: Can cancel transactions
- `canBroadcast`: Can broadcast meta transactions
- `canSignMetaTx`: Can sign meta transactions
- `canExecuteMetaTx`: Can execute meta transactions
- `isTimeDelayExpired`: Whether the time lock period has expired
- `userRoles`: Array of role hashes the user has
- `permissionErrors`: Any errors encountered during permission checking

### 2. Updated PendingTransactionDialog

The dialog now accepts Guardian SDK instances for permission checking:

```typescript
<PendingTransactionDialog
  // ... existing props
  secureOwnable={secureOwnable}
  dynamicRBAC={dynamicRBAC}
  definitions={definitions}
/>
```

## Permission Logic

### Time Lock Tab

**Approve Button:**
- Enabled only if `permissions.canApprove` is true AND `permissions.isTimeDelayExpired` is true
- Requires Owner role or specific function permission

**Cancel Button:**
- Enabled only if `permissions.canCancel` is true
- Requires Owner role or specific function permission

### Meta Transaction Tab

**Sign Meta Transaction Button:**
- Enabled only if `permissions.canSignMetaTx` is true
- Requires Owner or Broadcaster role with meta transaction permissions

**Broadcast Meta Transaction Button:**
- Enabled only if `permissions.canBroadcast` is true
- Requires Broadcaster role and signed meta transaction

**Additional Actions:**
- Sign Cancel Meta Tx: Available if user can sign meta transactions
- Broadcast Cancel Meta Tx: Available if user can broadcast meta transactions

## Role Requirements

### Basic Roles

1. **Owner**: Can approve and cancel time-delayed transactions
2. **Broadcaster**: Can broadcast meta transactions and sign meta transactions
3. **Recovery**: Can perform recovery operations

### Function-Specific Permissions

The system checks specific function selectors for each action:

- `TX_DELAYED_APPROVAL`: Time delay approval
- `TX_CANCELLATION`: Transaction cancellation
- `META_TX_APPROVAL`: Meta transaction approval
- `META_TX_CANCELLATION`: Meta transaction cancellation
- `META_TX_REQUEST_AND_APPROVE`: Meta transaction request and approve

## Usage Example

```typescript
import { PendingTransactionDialog } from '@/components/PendingTransactionDialog';
import { SecureOwnable } from '@/Guardian/sdk/typescript/contracts/SecureOwnable';
import { DynamicRBAC } from '@/Guardian/sdk/typescript/contracts/DynamicRBAC';
import { Definitions } from '@/Guardian/sdk/typescript/lib/Definition';

function MyComponent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Initialize Guardian SDK instances
  const secureOwnable = new SecureOwnable(publicClient, walletClient, contractAddress, chain);
  const dynamicRBAC = new DynamicRBAC(publicClient, walletClient, contractAddress, chain);
  const definitions = new Definitions(publicClient, walletClient, contractAddress, chain);

  return (
    <PendingTransactionDialog
      isOpen={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      title="Pending Transaction"
      contractInfo={{
        contractAddress: "0x...",
        timeLockPeriodInMinutes: 60,
        chainId: 1,
        chainName: "Ethereum Mainnet"
      }}
      transaction={transaction}
      connectedAddress={connectedAddress}
      secureOwnable={secureOwnable}
      dynamicRBAC={dynamicRBAC}
      definitions={definitions}
      onApprove={handleApprove}
      onCancel={handleCancel}
      onMetaTxSign={handleMetaTxSign}
      onBroadcastMetaTx={handleBroadcastMetaTx}
    />
  );
}
```

## Visual Indicators

The dialog includes several visual indicators:

### Permission Status Panel
Shows the user's current permissions with color-coded indicators:
- Green: Permission granted
- Gray: Permission denied

### Alert Messages
Dynamic alert messages based on permissions and time lock status:
- Info: Normal status updates
- Warning: Permission issues
- Error: Critical permission errors

### Button States
- Enabled: User has permission and conditions are met
- Disabled: User lacks permission or conditions not met
- Secondary variant: Permission denied (shows "No Permission" text)

## Error Handling

The permission system includes comprehensive error handling:

1. **Contract Connection Errors**: If SDK instances are not available
2. **Role Check Failures**: If role checking fails, falls back to basic permissions
3. **Permission Validation**: Validates all permissions before enabling actions

## Best Practices

1. **Always Provide SDK Instances**: The dialog requires Guardian SDK instances for full functionality
2. **Handle Permission Errors**: Check `permissions.permissionErrors` for any issues
3. **Update Permissions**: Permissions are automatically updated when props change
4. **Test Different Roles**: Test the dialog with different user roles to ensure proper behavior

## Troubleshooting

### Common Issues

1. **No Permissions Shown**: Ensure Guardian SDK instances are properly initialized
2. **Buttons Always Disabled**: Check if user has the required roles
3. **Permission Errors**: Check console for detailed error messages

### Debug Mode

Enable debug logging by checking the browser console for permission check details.

## Integration with Guardian Framework

This permission system integrates seamlessly with the Guardian Framework's:

- **SecureOwnable**: For ownership-based permissions
- **DynamicRBAC**: For role-based access control
- **Definitions**: For function-specific permissions
- **Meta Transactions**: For gasless transaction support

The system automatically adapts to different contract configurations and permission schemes, making it suitable for any Guardian-based contract deployment.
