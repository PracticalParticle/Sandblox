export interface NotificationMessage {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface TokenState {
  balance: bigint;
  metadata?: TokenMetadata;
  loading: boolean;
  error?: string;
}

export interface TokenBalanceState {
  [key: string]: TokenState;
}

export interface VaultMetaTxParams {
  deadline: bigint;
  maxGasPrice: bigint;
}

export interface StoredTransaction {
  signedData: string;
  metadata: {
    type: string;
    timestamp: number;
  };
}

export interface MetaTransactionManager {
  transactions: Record<string, StoredTransaction>;
  storeTransaction: (key: string, signedData: string, metadata: StoredTransaction['metadata']) => void;
} 