import React from 'react';
import { Address } from 'viem';
import { PendingTransactionDialog } from '../PendingTransactionDialog';
import { TxRecord } from '@/Guardian/sdk/typescript';
import { SecureOwnable } from '@/Guardian/sdk/typescript/contracts/SecureOwnable';
import { DynamicRBAC } from '@/Guardian/sdk/typescript/contracts/DynamicRBAC';
import { Definitions } from '@/Guardian/sdk/typescript/lib/Definition';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';

interface PendingTransactionDialogExampleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TxRecord;
  contractAddress: Address;
  connectedAddress: Address;
  onApprove?: (txId: number) => Promise<void>;
  onCancel?: (txId: number) => Promise<void>;
  onMetaTxSign?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onBroadcastMetaTx?: (tx: TxRecord, type: 'approve' | 'cancel') => Promise<void>;
  onNotification?: (message: any) => void;
}

export function PendingTransactionDialogExample({
  isOpen,
  onOpenChange,
  transaction,
  contractAddress,
  connectedAddress,
  onApprove,
  onCancel,
  onMetaTxSign,
  onBroadcastMetaTx,
  onNotification,
}: PendingTransactionDialogExampleProps) {
  // Initialize Guardian SDK instances
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http()
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(),
    account: connectedAddress
  });

  // Initialize Guardian SDK contracts
  const secureOwnable = new SecureOwnable(
    publicClient,
    walletClient,
    contractAddress,
    mainnet
  );

  const dynamicRBAC = new DynamicRBAC(
    publicClient,
    walletClient,
    contractAddress,
    mainnet
  );

  const definitions = new Definitions(
    publicClient,
    walletClient,
    contractAddress,
    mainnet
  );

  return (
    <PendingTransactionDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Pending Transaction"
      description="Review and manage the pending transaction with role-based permissions."
      contractInfo={{
        contractAddress,
        timeLockPeriodInMinutes: 60, // 1 hour
        chainId: 1,
        chainName: 'Ethereum Mainnet',
        broadcaster: '0x...', // Will be fetched from contract
        owner: '0x...', // Will be fetched from contract
        recoveryAddress: '0x...', // Will be fetched from contract
      }}
      transaction={transaction}
      connectedAddress={connectedAddress}
      onApprove={onApprove}
      onCancel={onCancel}
      onMetaTxSign={onMetaTxSign}
      onBroadcastMetaTx={onBroadcastMetaTx}
      onNotification={onNotification}
      // Guardian SDK instances for permission checking
      secureOwnable={secureOwnable}
      dynamicRBAC={dynamicRBAC}
      definitions={definitions}
    />
  );
}

// Usage example:
/*
const ExampleUsage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transaction, setTransaction] = useState<TxRecord | null>(null);

  const handleApprove = async (txId: number) => {
    // Handle approval logic
    console.log('Approving transaction:', txId);
  };

  const handleCancel = async (txId: number) => {
    // Handle cancellation logic
    console.log('Cancelling transaction:', txId);
  };

  const handleMetaTxSign = async (tx: TxRecord, type: 'approve' | 'cancel') => {
    // Handle meta transaction signing
    console.log('Signing meta transaction:', type, tx);
  };

  const handleBroadcastMetaTx = async (tx: TxRecord, type: 'approve' | 'cancel') => {
    // Handle meta transaction broadcasting
    console.log('Broadcasting meta transaction:', type, tx);
  };

  const handleNotification = (message: any) => {
    // Handle notifications
    console.log('Notification:', message);
  };

  return (
    <PendingTransactionDialogExample
      isOpen={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      transaction={transaction!}
      contractAddress="0x1234567890123456789012345678901234567890" as Address
      connectedAddress="0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address
      onApprove={handleApprove}
      onCancel={handleCancel}
      onMetaTxSign={handleMetaTxSign}
      onBroadcastMetaTx={handleBroadcastMetaTx}
      onNotification={handleNotification}
    />
  );
};
*/
