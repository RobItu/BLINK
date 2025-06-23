// services/TransactionStorageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredTransaction {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  currency: string;
  itemName: string;
  memo?: string;
  network: string;
  transactionHash?: string;
  fromAddress: string;
  toAddress: string;
  timestamp: number;
  status: 'pending' | 'complete' | 'failed';
  isCirclePayment?: boolean;
}

class TransactionStorageService {
  private getStorageKey(walletAddress: string): string {
    return `transactions_${walletAddress}`;
  }

  // Add a new transaction
  async addTransaction(walletAddress: string, transaction: StoredTransaction): Promise<boolean> {
    try {
      const existingTransactions = await this.getTransactions(walletAddress);
      const updatedTransactions = [transaction, ...existingTransactions];
      
      // Keep only last 100 transactions to avoid storage bloat
      const limitedTransactions = updatedTransactions.slice(0, 100);
      
      const key = this.getStorageKey(walletAddress);
      await AsyncStorage.setItem(key, JSON.stringify(limitedTransactions));
      
      console.log(`✅ Transaction stored: ${transaction.type} - ${transaction.amount} ${transaction.currency}`);
      return true;
    } catch (error) {
      console.error('Error adding transaction:', error);
      return false;
    }
  }

  // Get all transactions for a wallet
  async getTransactions(walletAddress: string): Promise<StoredTransaction[]> {
    try {
      const key = this.getStorageKey(walletAddress);
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        return JSON.parse(data) as StoredTransaction[];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  // Update transaction status (e.g., when payment completes)
  async updateTransactionStatus(
    walletAddress: string, 
    transactionId: string, 
    status: 'pending' | 'complete' | 'failed',
    transactionHash?: string
  ): Promise<boolean> {
    try {
      const transactions = await this.getTransactions(walletAddress);
      const updatedTransactions = transactions.map(tx => 
        tx.id === transactionId 
          ? { ...tx, status, transactionHash: transactionHash || tx.transactionHash }
          : tx
      );
      
      const key = this.getStorageKey(walletAddress);
      await AsyncStorage.setItem(key, JSON.stringify(updatedTransactions));
      
      console.log(`✅ Transaction status updated: ${transactionId} -> ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating transaction status:', error);
      return false;
    }
  }

  // Clear all transactions (for debugging)
  async clearTransactions(walletAddress: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(walletAddress);
      await AsyncStorage.removeItem(key);
      console.log(`🧹 Cleared transactions for ${walletAddress}`);
      return true;
    } catch (error) {
      console.error('Error clearing transactions:', error);
      return false;
    }
  }
}

export const transactionStorageService = new TransactionStorageService();