import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';

interface CCIPTransferProps {
  onTransferComplete?: (txHash: string) => void;
  onError?: (error: string) => void;
}

interface TokenInfo {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
}

type TransferStatus = 'success' | 'error' | null;

const CCIPTransferInterface: React.FC<CCIPTransferProps> = ({
  onTransferComplete,
  onError
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatus>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Get ThirdWeb wallet and account info
  const activeWallet = useActiveWallet();
  const account = useActiveAccount();

  // Determine wallet connection state
  const isWalletConnected = !!account && !!activeWallet;
  const walletAddress = account?.address || '';

  // Token details - CCIP-BnM as specified
  const tokenInfo: TokenInfo = {
    name: 'CCIP-BnM',
    address: '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
    symbol: 'CCIP-BnM',
    decimals: 18
  };

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError('');
    }
  };

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsTransferring(true);
    setError('');
    setTransferStatus(null);

    try {
      // Log the transfer details
      console.log('Initiating CCIP transfer:', {
        token: tokenInfo.address,
        amount: amount,
        recipient: walletAddress,
        sourceChain: 'Solana',
        destinationChain: 'Ethereum'
      });

      // Call your CCIP transfer API/service here
      const response = await fetch('/api/ccip/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress: tokenInfo.address,
          amount: amount,
          recipientAddress: walletAddress,
          sourceChain: 'solana',
          destinationChain: 'ethereum'
        })
      });

      if (!response.ok) {
        throw new Error('Transfer failed');
      }

      const result = await response.json();
      
      // Simulate successful transfer
      setTimeout(() => {
        const mockTxHash = '0xabcd1234...5678efgh';
        setTransactionHash(mockTxHash);
        setTransferStatus('success');
        setIsTransferring(false);
        
        // Show success alert
        Alert.alert(
          '✅ Transfer Successful!',
          `${amount} ${tokenInfo.symbol} has been transferred to your wallet.`,
          [{ text: 'Great!', onPress: () => {} }]
        );
        
        // Call success callback if provided
        if (onTransferComplete) {
          onTransferComplete(mockTxHash);
        }
      }, 3000);

    } catch (err: any) {
      const errorMessage = err.message || 'Transfer failed. Please try again.';
      setError(errorMessage);
      setIsTransferring(false);
      setTransferStatus('error');
      
      // Show error alert
      Alert.alert('❌ Transfer Failed', errorMessage);
      
      // Call error callback if provided
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const resetForm = () => {
    setAmount('');
    setTransferStatus(null);
    setTransactionHash('');
    setError('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Receive CCIP-BnM Tokens</Text>
        <Text style={styles.subtitle}>
          Transfer tokens from Solana to your connected wallet
        </Text>
      </View>

      {/* Token Info Card */}
      <View style={styles.tokenCard}>
        <View style={styles.tokenIconContainer}>
          <Text style={styles.tokenIcon}>CB</Text>
        </View>
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenName}>{tokenInfo.name}</Text>
          <Text style={styles.tokenAddress}>
            {tokenInfo.address.slice(0, 6)}...{tokenInfo.address.slice(-4)}
          </Text>
        </View>
      </View>

      {/* Wallet Connection Status */}
      {isWalletConnected ? (
        <View style={styles.walletConnected}>
          <View style={styles.walletStatusRow}>
            <Text style={styles.walletIcon}>✅</Text>
            <View style={styles.walletInfo}>
              <Text style={styles.walletStatusText}>Wallet Connected</Text>
              <Text style={styles.walletAddress}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.walletDisconnected}>
          <View style={styles.walletStatusRow}>
            <Text style={styles.walletIcon}>❌</Text>
            <View style={styles.walletInfo}>
              <Text style={styles.walletStatusTextDisconnected}>No Wallet Connected</Text>
              <Text style={styles.walletAddressDisconnected}>
                Please connect your ThirdWeb wallet first
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Amount Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Amount to Receive</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.textInput,
              isTransferring && styles.textInputDisabled
            ]}
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
            editable={!isTransferring}
          />
          <Text style={styles.inputSuffix}>{tokenInfo.symbol}</Text>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Transfer Button */}
      <TouchableOpacity
        style={[
          styles.transferButton,
          (!amount || isTransferring || !isWalletConnected) && styles.transferButtonDisabled
        ]}
        onPress={handleTransfer}
        disabled={!amount || isTransferring || !isWalletConnected}
        activeOpacity={0.8}
      >
        {isTransferring ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.buttonText}>Processing Transfer...</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Transfer CCIP-BnM</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Transfer Status */}
      {transferStatus === 'success' && (
        <View style={styles.successContainer}>
          <View style={styles.successHeader}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Transfer Successful!</Text>
          </View>
          <View style={styles.successDetails}>
            <Text style={styles.successAmount}>Amount: {amount} {tokenInfo.symbol}</Text>
            <Text style={styles.successTx}>TX: {transactionHash}</Text>
          </View>
          <TouchableOpacity onPress={resetForm} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Make Another Transfer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transfer Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Transfer Details:</Text>
        <Text style={styles.infoItem}>• From: Solana Network</Text>
        <Text style={styles.infoItem}>• To: Ethereum Network</Text>
        <Text style={styles.infoItem}>• Via: Chainlink CCIP</Text>
        <Text style={styles.infoItem}>• Estimated time: 2-5 minutes</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  tokenCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tokenIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenIcon: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  tokenAddress: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  walletConnected: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  walletDisconnected: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  walletStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
    marginBottom: 2,
  },
  walletStatusTextDisconnected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 2,
  },
  walletAddress: {
    fontSize: 12,
    color: '#16a34a',
    fontFamily: 'monospace',
  },
  walletAddressDisconnected: {
    fontSize: 12,
    color: '#dc2626',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#ffffff',
    paddingRight: 80,
  },
  textInputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
  },
  inputSuffix: {
    position: 'absolute',
    right: 16,
    top: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  transferButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  transferButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  buttonArrow: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803d',
  },
  successDetails: {
    marginBottom: 12,
  },
  successAmount: {
    fontSize: 14,
    color: '#16a34a',
    marginBottom: 4,
  },
  successTx: {
    fontSize: 12,
    color: '#16a34a',
    fontFamily: 'monospace',
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  infoContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
});

export default CCIPTransferInterface;