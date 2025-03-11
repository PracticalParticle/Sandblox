# SimpleVault

![Particle Crypto Security](https://via.placeholder.com/150x50?text=Particle+Security)

A secure, time-locked digital asset vault built on Particle's Account Abstraction framework. SimpleVault provides enhanced security for storing and managing ETH and ERC20 tokens.

## Features

- **Enhanced Security**: Time-delayed withdrawals with mandatory waiting periods
- **Self-Custody**: Maintain control while adding additional security layers
- **Multi-Role Access Control**: Separate roles for management, recovery, and operations
- **Multi-Token Support**: Store both ETH and any ERC20 tokens
- **Gasless Operations**: Support for meta-transactions to approve withdrawals (paid by broadcaster role)
- **Modern UI**: Beautiful React interface for easy management

## Why SimpleVault?

Traditional blockchain wallets rely on a single private key, creating a high-risk single point of failure. SimpleVault eliminates this vulnerability by introducing:

1. **Time-Delayed Security**: Critical operations require a waiting period, creating an opportunity to detect and prevent unauthorized transactions
2. **Role-Based Protection**: Separate keys for different functions, limiting the damage if any single key is compromised
3. **Recovery Mechanisms**: Dedicated recovery address for emergency access

## Getting Started

### Setup

1. Deploy the SimpleVault contract:

```bash
# Using hardhat
npx hardhat deploy --network mainnet \
  --owner YOUR_OWNER_ADDRESS \
  --broadcaster YOUR_BROADCASTER_ADDRESS \
  --recovery YOUR_RECOVERY_ADDRESS \
  --timelock 1440  # 24 hours in minutes
```

2. Install the SDK in your application:

```bash
npm install particle-abstraction-sdk
```

3. Initialize the vault in your application:

```typescript
import { SimpleVault } from 'particle-abstraction-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';

// Create clients
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

const walletClient = createWalletClient({
  chain: mainnet,
  transport: http()
});

// Create vault instance
const vault = new SimpleVault(
  publicClient,
  walletClient,
  '0xYourVaultContractAddress',
  mainnet
);
```

### Using the UI

SimpleVault includes a complete React UI for managing your vault:

```tsx
import SimpleVaultUI from 'particle-abstraction-sdk/ui';

function App() {
  return (
    <SimpleVaultUI 
      contractAddress="0xYourVaultContractAddress"
      onError={(error) => console.error(error)}
    />
  );
}
```

## Managing Your Vault

### Depositing Assets

Deposit ETH or ERC20 tokens into your vault:

```typescript
// Deposit ETH
await vault.depositEth(
  ethers.utils.parseEther("1.0"),
  { from: yourAddress }
);

// Deposit ERC20 tokens
await vault.depositToken(
  tokenAddress,
  amount,
  { from: yourAddress }
);
```

Through the UI, simply use the deposit form to add assets.

### Withdrawing Assets

Withdrawals follow a secure two-step process:

1. **Request Withdrawal**:
   ```typescript
   // Request ETH withdrawal
   const txResult = await vault.withdrawEthRequest(
     recipientAddress,
     amount,
     { from: ownerAddress }
   );
   
   const txId = txResult.txId;
   ```

2. **Approve After Timelock**:
   ```typescript
   // After timelock period has passed
   await vault.approveWithdrawalAfterDelay(
     txId,
     { from: ownerAddress }
   );
   ```

The UI simplifies this process with a unified withdrawal flow and clear status indicators.

### Meta Tx Approvals

For withdrawal approvals:

1. Generate and sign a meta-transaction:
   ```typescript
   const metaTxParams = {
     deadline: BigInt(Math.floor(Date.now()/1000) + 3600), // 1 hour
     maxGasPrice: BigInt(50000000000) // 50 gwei
   };
   
   const metaTx = await vault.generateUnsignedWithdrawalMetaTxApproval(
     txId,
     metaTxParams
   );
   
   // Sign the meta-transaction
   const signature = await walletClient.signMessage({
     message: { raw: metaTx.message },
     account: ownerAddress
   });
   
   metaTx.signature = signature;
   ```

2. Submit the meta-transaction:
   ```typescript
   await vault.approveWithdrawalWithMetaTx(
     metaTx,
     { from: broadcasterAddress }
   );
   ```

The UI includes built-in meta-transaction support for one-click signing.

## Security Best Practices

1. **Use Separate Devices** for owner, broadcaster, and recovery keys
2. **Monitor Pending Transactions** regularly to detect unauthorized requests
3. **Set Appropriate Timelock** periods based on your security needs
4. **Regularly Verify** owner and recovery addresses
5. **Test Recovery** procedures periodically
6. **Start with Small Amounts** when first using the vault

## Development

For detailed technical documentation, see [SimpleVault.md](./SimpleVault.md).

## License

MPL-2.0

---

Built with [Particle Account Abstraction](../../vaultify-docs/knowledge_base/Particle_Account_Abstraction.md)
