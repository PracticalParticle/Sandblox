import { isAddress } from 'viem';

/**
 * Interface for the transaction data structure
 */
export interface SignedTransaction {
  signedData: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for the contract transactions mapping
 */
export interface ContractTransactions {
  [txId: number]: SignedTransaction;
}

/**
 * Interface for the complete storage structure
 */
export interface TransactionStorage {
  [contractAddress: string]: ContractTransactions;
}

/**
 * Error types for transaction management
 */
export enum TransactionError {
  STORAGE_FULL = 'STORAGE_FULL',
  INVALID_DATA = 'INVALID_DATA',
  NOT_FOUND = 'NOT_FOUND',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
}

/**
 * Class for managing transaction storage in localStorage
 */
export class TransactionManager {
  private readonly storageKey: string;
  private readonly maxStorageSize: number;

  constructor(storageKey = 'dapp_signed_transactions', maxStorageSize = 5 * 1024 * 1024) { // 5MB default
    this.storageKey = storageKey;
    this.maxStorageSize = maxStorageSize;
  }

  /**
   * Validates an Ethereum address
   */
  private validateAddress(address: string): boolean {
    try {
      return isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validates transaction data structure
   */
  private validateTransactionData(data: unknown): data is TransactionStorage {
    if (!data || typeof data !== 'object') return false;

    for (const [address, transactions] of Object.entries(data)) {
      // Validate address
      if (!this.validateAddress(address)) return false;

      // Validate transactions object
      if (!transactions || typeof transactions !== 'object') return false;

      for (const [txId, tx] of Object.entries(transactions)) {
        // Validate transaction ID is a number
        if (isNaN(Number(txId))) return false;

        // Validate transaction structure
        if (!tx || typeof tx !== 'object') return false;
        
        // Type assertion to access properties safely
        const transaction = tx as Partial<SignedTransaction>;
        
        if (typeof transaction.signedData !== 'string') return false;
        if (typeof transaction.timestamp !== 'number') return false;
        if (transaction.metadata !== undefined && (typeof transaction.metadata !== 'object' || transaction.metadata === null)) return false;
      }
    }

    return true;
  }

  /**
   * Handles BigInt serialization for JSON
   */
  private bigIntReplacer(_key: string, value: any): any {
    if (typeof value === "bigint") {
      return value.toString() + 'n';
    }
    return value;
  }

  /**
   * Handles BigInt deserialization from JSON
   */
  private bigIntReviver(_key: string, value: any): any {
    if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }
  }

  /**
   * Gets all transaction data from localStorage
   */
  private getTransactionData(): TransactionStorage {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return {};

      const parsedData = JSON.parse(data, this.bigIntReviver);
      if (!this.validateTransactionData(parsedData)) {
        console.warn('Invalid transaction data found in storage, resetting...');
        localStorage.removeItem(this.storageKey);
        return {};
      }

      // Convert string txIds to numbers
      const normalizedData: TransactionStorage = {};
      for (const [address, transactions] of Object.entries(parsedData)) {
        normalizedData[address] = {};
        for (const [txId, tx] of Object.entries(transactions)) {
          normalizedData[address][Number(txId)] = tx;
        }
      }

      return normalizedData;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      throw new Error(TransactionError.SERIALIZATION_ERROR);
    }
  }

  /**
   * Saves transaction data to localStorage
   */
  private saveTransactionData(data: TransactionStorage): void {
    try {
      const serialized = JSON.stringify(data, this.bigIntReplacer);
      if (serialized.length > this.maxStorageSize) {
        throw new Error(TransactionError.STORAGE_FULL);
      }
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      throw error instanceof Error ? error : new Error(TransactionError.SERIALIZATION_ERROR);
    }
  }

  /**
   * Stores a signed transaction
   */
  public storeSignedTransaction(
    contractAddress: string,
    txId: string | number,
    signedTx: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const numericTxId = Number(txId);
    if (isNaN(numericTxId) || !signedTx) {
      throw new Error(TransactionError.INVALID_DATA);
    }

    const data = this.getTransactionData();
    
    if (!data[contractAddress]) {
      data[contractAddress] = {};
    }

    data[contractAddress][numericTxId] = {
      signedData: signedTx,
      timestamp: Date.now(),
      metadata
    };

    this.saveTransactionData(data);
  }

  /**
   * Gets a specific signed transaction
   */
  public getSignedTransaction(
    contractAddress: string,
    txId: string | number
  ): SignedTransaction | null {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const numericTxId = Number(txId);
    if (isNaN(numericTxId)) {
      throw new Error(TransactionError.INVALID_DATA);
    }

    const data = this.getTransactionData();
    return data[contractAddress]?.[numericTxId] || null;
  }

  /**
   * Gets all signed transactions for a contract
   */
  public getSignedTransactionsByContract(
    contractAddress: string
  ): ContractTransactions {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const data = this.getTransactionData();
    return data[contractAddress] || {};
  }

  /**
   * Removes a specific signed transaction
   */
  public removeSignedTransaction(
    contractAddress: string,
    txId: string | number
  ): void {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const numericTxId = Number(txId);
    if (isNaN(numericTxId)) {
      throw new Error(TransactionError.INVALID_DATA);
    }

    const data = this.getTransactionData();
    
    if (data[contractAddress]?.[numericTxId]) {
      delete data[contractAddress][numericTxId];
      
      // Remove the contract address if no transactions remain
      if (Object.keys(data[contractAddress]).length === 0) {
        delete data[contractAddress];
      }
      
      this.saveTransactionData(data);
    }
  }

  /**
   * Clears all transactions for a contract
   */
  public clearContractTransactions(contractAddress: string): void {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const data = this.getTransactionData();
    
    if (data[contractAddress]) {
      delete data[contractAddress];
      this.saveTransactionData(data);
    }
  }

  /**
   * Gets all contract addresses
   */
  public getAllContractAddresses(): string[] {
    const data = this.getTransactionData();
    return Object.keys(data);
  }

  /**
   * Gets the total size of stored data
   */
  public getStorageSize(): number {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? new Blob([data]).size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Clears all stored transactions
   */
  public clearAllTransactions(): void {
    localStorage.removeItem(this.storageKey);
  }
} 