// services/BankStorageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the interface once here
export interface BankDetails {
  bankAddress: {
    country: string;
    bankName: string;
  };
  billingDetails: {
    postalCode: string;
    district: string;
    line1: string;
    country: string;
    city: string;
    name: string;
  };
  routingNumber: string;
  accountNumber: string;
}

class BankStorageService {
  
  // Generate storage key for wallet address
  private getStorageKey(walletAddress: string): string {
    return `bankData_${walletAddress}`;
  }

  // Check if bank details exist for wallet address
  async hasBankDetails(walletAddress: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(walletAddress);
      const data = await AsyncStorage.getItem(key);
      return data !== null;
    } catch (error) {
      console.error('Error checking bank details:', error);
      return false;
    }
  }

  // Get bank details for wallet address
  async getBankDetails(walletAddress: string): Promise<BankDetails | null> {
    try {
      const key = this.getStorageKey(walletAddress);
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        return JSON.parse(data) as BankDetails;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting bank details:', error);
      return null;
    }
  }

  // Save bank details for wallet address
  async saveBankDetails(walletAddress: string, bankDetails: BankDetails): Promise<boolean> {
    try {
      const key = this.getStorageKey(walletAddress);
      const dataString = JSON.stringify(bankDetails);
      await AsyncStorage.setItem(key, dataString);
      
      console.log(`✅ Bank details saved LOCALLY for wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
      return true;
    } catch (error) {
      console.error('Error saving bank details:', error);
      return false;
    }
  }

  // Remove bank details for wallet address
  async removeBankDetails(walletAddress: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(walletAddress);
      await AsyncStorage.removeItem(key);
      
      console.log(`🗑️ Bank details removed for wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
      return true;
    } catch (error) {
      console.error('Error removing bank details:', error);
      return false;
    }
  }

  // Get all stored bank details (for debugging)
  async getAllBankDetails(): Promise<Record<string, BankDetails>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const bankKeys = allKeys.filter(key => key.startsWith('bankData_'));
      
      const result: Record<string, BankDetails> = {};
      
      for (const key of bankKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const walletAddress = key.replace('bankData_', '');
          result[walletAddress] = JSON.parse(data);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting all bank details:', error);
      return {};
    }
  }

  // Clear all bank details (for debugging/reset)
  async clearAllBankDetails(): Promise<boolean> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const bankKeys = allKeys.filter(key => key.startsWith('bankData_'));
      
      await AsyncStorage.multiRemove(bankKeys);
      
      console.log(`🧹 Cleared ${bankKeys.length} bank detail records`);
      return true;
    } catch (error) {
      console.error('Error clearing all bank details:', error);
      return false;
    }
  }

  // Update specific fields (for partial updates)
  async updateBankDetails(
    walletAddress: string, 
    updates: Partial<BankDetails>
  ): Promise<boolean> {
    try {
      const existingDetails = await this.getBankDetails(walletAddress);
      
      if (!existingDetails) {
        console.error('No existing bank details to update');
        return false;
      }

      // Deep merge the updates
      const updatedDetails: BankDetails = {
        ...existingDetails,
        ...updates,
        bankAddress: {
          ...existingDetails.bankAddress,
          ...(updates.bankAddress || {})
        },
        billingDetails: {
          ...existingDetails.billingDetails,
          ...(updates.billingDetails || {})
        }
      };

      return await this.saveBankDetails(walletAddress, updatedDetails);
    } catch (error) {
      console.error('Error updating bank details:', error);
      return false;
    }
  }

  // Validate bank details format
  validateBankDetails(bankDetails: BankDetails): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!bankDetails.accountNumber?.trim()) {
      errors.push('Account number is required');
    }

    if (!bankDetails.routingNumber?.trim()) {
      errors.push('Routing number is required');
    }

    if (!bankDetails.billingDetails?.name?.trim()) {
      errors.push('Account holder name is required');
    }

    if (!bankDetails.billingDetails?.line1?.trim()) {
      errors.push('Street address is required');
    }

    if (!bankDetails.billingDetails?.city?.trim()) {
      errors.push('City is required');
    }

    if (!bankDetails.billingDetails?.postalCode?.trim()) {
      errors.push('Postal code is required');
    }

    if (!bankDetails.bankAddress?.bankName?.trim()) {
      errors.push('Bank name is required');
    }

    // Validate routing number format (9 digits for US)
    const routingPattern = /^\d{9}$/;
    if (bankDetails.routingNumber && !routingPattern.test(bankDetails.routingNumber)) {
      errors.push('Routing number must be 9 digits');
    }

    // Validate account number (basic check)
    if (bankDetails.accountNumber && bankDetails.accountNumber.length < 4) {
      errors.push('Account number is too short');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const bankStorageService = new BankStorageService();