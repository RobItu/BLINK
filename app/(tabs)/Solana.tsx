import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';

const API_BASE = process.env.EXPO_PUBLIC_API_URL

interface CCIPTransferProps {
  onTransferComplete?: (txHash: string) => void;
  onError?: (error: string) => void;
}

interface TokenInfo {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  image?: any;
}

type TransferStatus = 'success' | 'error' | null;

const CCIPTransferInterface: React.FC<CCIPTransferProps> = ({
  onTransferComplete,
  onError
}) => {
  const [showTokenDropdown, setShowTokenDropdown] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
const [solanaAddress] = useState<string>('AhUVqriSjwvj48rwHZjQ13nPEYmqedngTuvV4B2t7gmn');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatus>(null);
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState<string>('');

// Token options
const tokenOptions: TokenInfo[] = [
  {
    name: 'CCIP-BnM',
    address: '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
    symbol: 'CCIP-BnM',
    decimals: 18,
    image: require('../../assets/images/networks/sepolia.png')
  },
  {
    name: 'FHE token',
    address: 'AUyYTiXWP77qerK7Ccb12oz27kdVcqCqDCe8MUBCWqWH',
    symbol: 'FHE',
    decimals: 18,
    image: require('../../assets/images/networks/tokens/FHE.png')
  },
  {
    name: 'LINK',
    address: 'LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L',
    symbol: 'LINK',
    decimals: 18,
    image: require('../../assets/images/networks/tokens/LINK.png')
  },
  {
    name: 'zBTC',
    address: 'zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg',
    symbol: 'zBTC',
    decimals: 8,
    image: require('../../assets/images/networks/tokens/zbtc.png')
  }
];

const [selectedToken, setSelectedToken] = useState<TokenInfo>(tokenOptions[0]);

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


  const validateSolanaAddress = (address: string): boolean => {
    // Basic Solana address validation (should be 32-44 characters, base58)
    if (!address) return false;
    if (address.length < 32 || address.length > 44) return false;
    // Basic base58 character check
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
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

 if (!solanaAddress) {
   setError('Solana address is required');
   return;
 }

 if (!validateSolanaAddress(solanaAddress)) {
   setError('Invalid Solana address configuration');
   return;
 }

 setIsTransferring(true);
 setError('');
 setTransferStatus(null);

 try {
   // Log the transfer details
   console.log('Initiating CCIP transfer:', {
     token: selectedToken.address,
     amount: amount,
     recipient: walletAddress,
     sourceAddress: solanaAddress,
     sourceChain: 'Solana',
     destinationChain: 'Ethereum'
   });

   // Call your CCIP transfer API/service here
   const response = await fetch(`${API_BASE}/api/solana/transfer`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       tokenAddress: selectedToken.address,
       amount: amount,
       recipientAddress: walletAddress,
       sourceAddress: solanaAddress,
       sourceChain: 'solana',
       destinationChain: 'ethereum'
     })
   });

   if (!response.ok) {
     throw new Error('Transfer failed');
   }

   const result = await response.json();

   if (result.success) {
     setTransactionHash(result.transactionHash);
     setTransferStatus('success');
     setIsTransferring(false);
     
     // Enhanced success alert with explorer links
     Alert.alert(
       '✅ Transfer Successful!',
       `${amount} ${selectedToken.symbol} transferred!\n\nTransaction: ${result.transactionHash}`,
       [
         { text: 'View CCIP', onPress: () => {
           if (result.ccipExplorerUrl) {
             console.log('CCIP Explorer:', result.ccipExplorerUrl);
             // Add Linking.openURL(result.ccipExplorerUrl) if you want to open in browser
           }
         }},
         { text: 'View Solana', onPress: () => {
           if (result.solanaExplorerUrl) {
             console.log('Solana Explorer:', result.solanaExplorerUrl);
             // Add Linking.openURL(result.solanaExplorerUrl) if you want to open in browser
           }
         }},
         { text: 'Done', onPress: () => {} }
       ]
     );
     
     // Call success callback if provided
     if (onTransferComplete) {
       onTransferComplete(result.transactionHash);
     }
   } else {
     throw new Error(result.error || 'Transfer failed');
   }

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
      {/* Banner Image */}
      <View style={styles.bannerContainer}>
        <Image
          source={require('../../assets/images/Solana-SOL-Ethereum-ETH.jpg')}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerTitle}>Cross-Chain Transfer</Text>
          <Text style={styles.bannerSubtitle}>Solana → Ethereum via CCIP</Text>
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Receive Solana Tokens</Text>
        <Text style={styles.subtitle}>
          Transfer tokens from Solana to your connected wallet
        </Text>
      </View>

      {/* Token Info Card */}
      {/* <View style={styles.tokenCard}>
        <View style={styles.tokenIconContainer}>
          <Text style={styles.tokenIcon}>CB</Text>
        </View>
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenName}>{tokenInfo.name}</Text>
          <Text style={styles.tokenAddress}>
            {tokenInfo.address.slice(0, 6)}...{tokenInfo.address.slice(-4)}
          </Text>
        </View>
      </View> */}

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

      {/* Solana Source Address - Read Only */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Solana Address (Source)</Text>
        <View style={styles.solanaInputContainer}>
          <TextInput
            style={[
              styles.textInput,
              styles.solanaInput,
              styles.textInputDisabled // Always disabled/greyed out
            ]}
            value={solanaAddress}
            placeholder="AhUVqriSjwvj48rwHZjQ13nPEYmqedngTuvV4B2t7gmn"
            placeholderTextColor="#999"
            editable={false} // Make it read-only
            multiline={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.validationIcon}></Text>
        </View>
      </View>

      {/* Token Selection */}
<View style={styles.inputSection}>
  <Text style={styles.inputLabel}>Token to Receive</Text>
  <TouchableOpacity
    style={styles.tokenSelector}
    onPress={() => setShowTokenDropdown(!showTokenDropdown)}
    activeOpacity={0.7}
  >
    <View style={styles.tokenSelectorContent}>
      {selectedToken.image && <Image source={selectedToken.image} style={styles.tokenSelectorIcon} />}
      <Text style={styles.tokenSelectorText}>{selectedToken.symbol}</Text>
    </View>
    <Text style={styles.dropdownArrow}>{showTokenDropdown ? '▲' : '▼'}</Text>
  </TouchableOpacity>
  
  {showTokenDropdown && (
    <View style={styles.tokenDropdown}>
      {tokenOptions.map((token) => (
        <TouchableOpacity
          key={token.address}
          style={styles.tokenOption}
          onPress={() => {
            setSelectedToken(token);
            setShowTokenDropdown(false);
          }}
        >
          {token.image && <Image source={token.image} style={styles.tokenOptionIcon} />}
          <Text style={styles.tokenOptionText}>{token.symbol}</Text>
          <Text style={styles.tokenOptionName}>{token.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )}
</View>

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
    <Text style={styles.inputSuffix}>{selectedToken.symbol}</Text>
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
      <Text style={styles.buttonText}>Transfer {selectedToken.symbol}</Text>
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
        <Text style={styles.infoItem}>• To: Sepolia Network</Text>
        <Text style={styles.infoItem}>• Via: Chainlink CCIP</Text>
        <Text style={styles.infoItem}>• Token: {tokenInfo.symbol}</Text>
        <Text style={styles.infoItem}>• Estimated time: 2-5 minutes</Text>
        {solanaAddress && (
          <Text style={styles.infoItem}>
            • Source: {solanaAddress.slice(0, 8)}...{solanaAddress.slice(-8)}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  tokenSelector: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderWidth: 1,
  borderColor: '#d1d5db',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: '#ffffff',
},
tokenSelectorContent: {
  flexDirection: 'row',
  alignItems: 'center',
},
tokenSelectorIcon: {
  width: 20,
  height: 20,
  marginRight: 8,
},
tokenSelectorText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1f2937',
},
dropdownArrow: {
  fontSize: 12,
  color: '#6b7280',
},
tokenDropdown: {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#e5e7eb',
  marginTop: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
tokenOption: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},
tokenOptionIcon: {
  width: 18,
  height: 18,
  marginRight: 10,
},
tokenOptionText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1f2937',
  marginRight: 8,
},
tokenOptionName: {
  fontSize: 12,
  color: '#6b7280',
  flex: 1,
},
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  bannerContainer: {
    position: 'relative',
    height: 200,
    marginBottom: 20,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 16,
    color: '#e5e7eb',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
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
    marginHorizontal: 20,
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
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  walletDisconnected: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 20,
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
    paddingHorizontal: 20,
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
    fontWeight: "normal",
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
    marginHorizontal: 20,
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
    marginHorizontal: 20,
  },
  transferButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  solanaInputContainer: {
    position: 'relative',
  },
  solanaInput: {
    paddingRight: 40,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  validationIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    fontSize: 16,
  },
  inputHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
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
    marginHorizontal: 20,
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
    marginHorizontal: 20,
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