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
  [txId: string]: SignedTransaction;
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
   * Gets all transaction data from localStorage
   */
  private getTransactionData(): TransactionStorage {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
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
      const serialized = JSON.stringify(data);
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
    txId: string,
    signedTx: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    if (!txId || !signedTx) {
      throw new Error(TransactionError.INVALID_DATA);
    }

    const data = this.getTransactionData();
    
    if (!data[contractAddress]) {
      data[contractAddress] = {};
    }

    data[contractAddress][txId] = {
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
    txId: string
  ): SignedTransaction | null {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const data = this.getTransactionData();
    return data[contractAddress]?.[txId] || null;
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
    txId: string
  ): void {
    if (!this.validateAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const data = this.getTransactionData();
    
    if (data[contractAddress]?.[txId]) {
      delete data[contractAddress][txId];
      
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