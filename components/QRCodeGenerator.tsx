// QRCodeGenerator.tsx - Clean Bank Integration with Simplified UI
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, ScrollView, Image, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { createTransaction, CurrencyType, TransactionData } from '../types/transaction';
import { SUPPORTED_NETWORKS } from '../types/transaction';
import { BankDetailsModal } from './BankDetailsModal';
import { bankStorageService, BankDetails } from '../services/BankStorageService';
import { transactionStorageService } from '../services/TransactionStorageService';
import { useRouter } from 'expo-router';



const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"; // Ngrok URL or local backend

interface QRCodeGeneratorProps {
  connectedWalletAddress?: string;
  isWalletConnected?: boolean;
  merchantId: string;
}

const getNetworkIcon = (networkName: string) => {
  const iconMap: { [key: string]: any } = {
    'Sepolia': require('../assets/images/networks/sepolia.png'),
    'Polygon': require('../assets/images/networks/polygon.png'),
    'Avalanche Fuji': require('../assets/images/networks/avalancheFuji.png'),
    'Base Sepolia': require('../assets/images/networks/baseSepolia.png'),
    'Arbitrum': require('../assets/images/networks/arbitrum.png'),
    'Ethereum': require('../assets/images/networks/ethereum.png'),
    'Avalanche': require('../assets/images/networks/avalancheFuji.png'),
  };
  return iconMap[networkName] || require('../assets/images/networks/sepolia.png');
};

const NETWORK_OPTIONS = SUPPORTED_NETWORKS.map(network => ({
  name: network.name,
  symbol: network.nativeCurrency.symbol,
  icon: getNetworkIcon(network.name)
}));

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  connectedWalletAddress,
  isWalletConnected = false,
  merchantId
}) => {
  const [currencyType, setCurrencyType] = useState<CurrencyType>('USDC');
  const [amount, setAmount] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [sellerWalletAddress, setSellerWalletAddress] = useState<string>('');
  const [memo, setmemo] = useState<string>('');
  const [qrSize, setQrSize] = useState<number>(200);
  const [desiredNetwork, setDesiredNetwork] = useState<string>('Sepolia');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const router = useRouter();

  
  // New state for Additional Settings
  const [showAdditionalSettings, setShowAdditionalSettings] = useState(false);
  
  // Bank workflow state
  const [showBankModal, setShowBankModal] = useState(false);
  const [circleDepositAddress, setCircleDepositAddress] = useState<string | null>(null);

  const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
  
  // Auto-populate seller wallet address when wallet connects
  useEffect(() => {
    if (connectedWalletAddress && !sellerWalletAddress) {
      setSellerWalletAddress(connectedWalletAddress);
    }
  }, [connectedWalletAddress]);

useEffect(() => {
  // Only connect WebSocket when expecting USD payments and wallet is connected
  if (connectedWalletAddress) {
    // Don't create new connection if one already exists
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      return;
    }
    
    const wsUrl = `${API_BASE.replace('https', 'wss')}?merchantId=${connectedWalletAddress}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setWsConnection(ws);
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data);
        
        if (data.type === 'deposit_received' && data.status === 'complete') {
            await transactionStorageService.addTransaction(connectedWalletAddress!, {
    id: data.transactionHash,
    type: 'received',
    amount: data.amount,
    currency: currencyType,
    itemName: `Circle Deposit for ${itemName}`,
    memo: memo,
    network: data.sourceChain,
    transactionHash: data.transactionHash,
    fromAddress: '', // Circle doesn't provide sender
    toAddress: circleDepositAddress!,
    timestamp: Date.now(),
    status: data.status === 'complete' ? 'complete' : 'pending',
    isCirclePayment: true
  });
          
          setPaymentReceived(true);
          Alert.alert(
            '💰 Payment Received!',
            `$${data.amount} received and will be converted to USD in your bank account.`,
            [{ text: 'Great!', onPress: () => setPaymentReceived(false) }]
          );
        }

         if (data.type === 'usdc_received' && data.status === 'complete') {
      console.log('🎯 USDC notification received!', data);
      
      // Add to transaction history
      await transactionStorageService.addTransaction(connectedWalletAddress!, {
        id: data.transactionHash,
        type: 'received',
        amount: data.amount,
        currency: 'USDC',
        itemName: itemName || 'USDC Payment Received',
        memo: memo,
        network: data.network,
        transactionHash: data.transactionHash,
        fromAddress: data.fromAddress,
        toAddress: connectedWalletAddress!,
        timestamp: Date.now(),
        status: 'complete',
        isCirclePayment: false
      });
      
      Alert.alert(
  '💰 USDC Payment Received!', 
  `${data.amount} USDC received!`,
  [
    { text: 'OK', style: 'cancel' },
    { 
      text: 'View Transaction', 
      onPress: () => {
        router.push('/(tabs)/TX History');
      }
    }
  ]
);
    }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setWsConnection(null);
    };
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  } else {
    // Close connection if switching away from USD
    if (wsConnection) {
      console.log('🔌 Closing WebSocket (not USD payment)');
      wsConnection.close();
      setWsConnection(null);
    }
  }
}, [currencyType, connectedWalletAddress, circleDepositAddress, wsConnection]);

  // Currency toggle handler with bank workflow
  const handleCurrencyToggle = async (newCurrencyType: CurrencyType) => {
  console.log('API Base URL:', API_BASE);
  
  if (newCurrencyType === 'USD') {
    // Step 1: Setup Circle deposit address
    try {
      // Map your network names to Circle chain codes
      const networkToChainMap: { [key: string]: string } = {
        'Ethereum': 'ETH',
        'Avalanche': 'AVAX', 
        'Avalanche Fuji': 'AVAX',
        'Base Sepolia': 'BASE',
        'Polygon': 'POLY',
        'Arbitrum': 'ARB',
        'Sepolia': 'ETH'
      };
      
      const chainCode = networkToChainMap[desiredNetwork];
      
      const response = await fetch(`${API_BASE}/api/merchants/${connectedWalletAddress}/setup-circle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: chainCode }) // Pass the mapped chain
      });
      
      const data = await response.json();
      if (data.success) {
        setCircleDepositAddress(data.depositAddress);
        
        // Step 2: Check if bank details exist
        const hasBankDetails = await bankStorageService.hasBankDetails(connectedWalletAddress || '');
        
        if (!hasBankDetails) {
          // Step 3: Show bank modal if no details
          setShowBankModal(true);
          return; // Don't set currency yet
        }
        
        // Bank details exist, proceed with fiat
        setCurrencyType('USD');
      }
    } catch (error) {
      console.error('Failed to setup Circle:', error);
      return;
    }
  } else {
    setCurrencyType(newCurrencyType);
  }
};

  // Bank save handler
 const handleBankSave = async (bankDetails: BankDetails) => {
  try {
    // Save to AsyncStorage
    await bankStorageService.saveBankDetails(connectedWalletAddress || '', bankDetails);
    
    // Create bank account AND store bank ID in one call
    const response = await fetch(`${API_BASE}/api/test/create-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        bankDetails,
        merchantId: connectedWalletAddress // Pass merchant ID
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setCurrencyType('USD');
      console.log('Bank account linked successfully with ID:', data.bankAccountId);
    } else {
      console.error('Failed to create bank account:', data.error);
    }
  } catch (error) {
    console.error('Failed to save bank details:', error);
  }
};

  // Get recipient address based on currency type
  const getRecipientAddress = () => {
    if (currencyType === 'USD' && circleDepositAddress) {
      return circleDepositAddress; // Use Circle address for fiat
    }
    return sellerWalletAddress || 'Not Connected'; // Use ThirdWeb wallet for crypto
  };

  // Create transaction data
  const fullTransactionData: TransactionData = createTransaction(
    itemName,
    amount,
    currencyType,
    sellerWalletAddress || 'Not Connected',
    memo || undefined
  );
  
  // QR code data
  const compactData = {
    for: itemName,
    amount: amount,
    currency: currencyType,
    timestamp: Date.now(),
    id: fullTransactionData.id,
    sellerWalletAddress: getRecipientAddress(),
    memo: memo || undefined,
    network: desiredNetwork,
    merchantId: merchantId,
    isCirclePayment: currencyType === 'USD' && !!circleDepositAddress
  };
  
  const qrData = JSON.stringify(compactData);
  
  // Helper functions
  const handleUseConnectedWallet = () => {
    if (connectedWalletAddress) {
      setSellerWalletAddress(connectedWalletAddress);
    }
  };

  const handleNetworkSelect = (networkName: string) => {
    setDesiredNetwork(networkName);
    setIsDropdownOpen(false);
  };

  const selectedNetwork = NETWORK_OPTIONS.find(option => option.name === desiredNetwork);

  const deleteBankDetails = async () => {
  try {
    const success = await bankStorageService.removeBankDetails(connectedWalletAddress || '');
    if (success) {
      Alert.alert('Success', 'Bank details deleted');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to delete bank details');
  }
};
  
  return (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Generate Payment QR Code</Text>
    
    {/* Main Form Fields - Simple and Clean */}
    <View style={styles.formContainer}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Item/Service Name</Text>
        <TextInput
          style={styles.textInput}
          value={itemName}
          onChangeText={setItemName}
          placeholder="e.g. Lemonade, Coffee, Haircut"
          placeholderTextColor="#999"
          maxLength={30}
        />
        <Text style={styles.characterCount}>{itemName.length}/30</Text>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount</Text>
        <TextInput
          style={styles.textInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Currency</Text>
        <View style={styles.currencySelector}>
          <TouchableOpacity 
            style={[styles.currencyButton, currencyType === 'USDC' && styles.selectedCurrency]}
            onPress={() => handleCurrencyToggle('USDC')}
          >
            <Text style={[styles.currencyText, currencyType === 'USDC' && styles.selectedText]}>
              USDC
            </Text>
            <Text style={styles.currencySubtext}>Receive crypto</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.currencyButton, currencyType === 'USD' && styles.selectedCurrency]}
            onPress={() => handleCurrencyToggle('USD')}
          >
            <Text style={[styles.currencyText, currencyType === 'USD' && styles.selectedText]}>
              USD (Fiat)
            </Text>
            <Text style={styles.currencySubtext}>Auto-convert to bank</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Memo (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={memo}
          onChangeText={setmemo}
          placeholder="Add a note or memo"
          placeholderTextColor="#999"
          maxLength={20}
        />
        <Text style={styles.characterCount}>{memo.length}/20</Text>
      </View>
    </View>
    
    {/* Additional Settings Collapsible Section */}
    <View style={styles.additionalSettingsSection}>
      <TouchableOpacity
        style={styles.additionalSettingsHeader}
        onPress={() => setShowAdditionalSettings(!showAdditionalSettings)}
        activeOpacity={0.7}
      >
        <Text style={styles.additionalSettingsTitle}>⚙️ Additional Settings</Text>
        <Text style={[
          styles.additionalSettingsArrow,
          showAdditionalSettings && styles.additionalSettingsArrowOpen
        ]}>
          ▼
        </Text>
      </TouchableOpacity>
      
      {showAdditionalSettings && (
        <View style={styles.additionalSettingsContent}>
          {/* Wallet Connection Status */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Wallet Status</Text>
            <View style={styles.walletStatusContainer}>
              {isWalletConnected ? (
                <View style={styles.connectedStatus}>
                  <Text style={styles.connectedText}>✅ Wallet Connected</Text>
                  <Text style={styles.walletAddressText}>
                    {connectedWalletAddress?.slice(0, 6)}...{connectedWalletAddress?.slice(-4)}
                  </Text>
                </View>
              ) : (
                <View style={styles.disconnectedStatus}>
                  <Text style={styles.disconnectedText}>❌ No Wallet Connected</Text>
                  <Text style={styles.statusSubtext}>Connect a wallet to auto-fill your address</Text>
                </View>
              )}
            </View>
          </View>

          {/* Destination Network */}
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Destination Network</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <View style={styles.selectedContainer}>
                  {selectedNetwork && (
                    <Image source={selectedNetwork.icon} style={styles.networkIcon} />
                  )}
                  <Text style={styles.dropdownSelectedText}>
                    {selectedNetwork ? selectedNetwork.name : 'Select Network'}
                  </Text>
                </View>
                <Text style={styles.arrow}>{isDropdownOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={styles.dropdown}>
                  {NETWORK_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.name}
                      style={[
                        styles.dropdownItem,
                        desiredNetwork === option.name && styles.selectedItem
                      ]}
                      onPress={() => handleNetworkSelect(option.name)}
                    >
                      <View style={styles.dropdownItemContainer}>
                        <Image source={option.icon} style={styles.networkIcon} />
                        <Text style={[
                          styles.dropdownItemText,
                          desiredNetwork === option.name && styles.selectedItemText
                        ]}>
                          {option.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Your Wallet Address (renamed from Seller Wallet Address) */}
          <View style={styles.settingGroup}>
            <View style={styles.labelContainer}>
              <Text style={styles.settingLabel}>Your Wallet Address</Text>
              {isWalletConnected && sellerWalletAddress !== connectedWalletAddress && (
                <TouchableOpacity onPress={handleUseConnectedWallet}>
                  <Text style={styles.autofillLink}>Use connected wallet</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[
                styles.textInput,
                sellerWalletAddress === connectedWalletAddress && styles.connectedInput
              ]}
              value={sellerWalletAddress}
              onChangeText={setSellerWalletAddress}
              placeholder="0x..."
              placeholderTextColor="#999"
            />
          </View>

          {/* Debug Button - Only in Additional Settings */}
          {/* <TouchableOpacity 
            style={styles.debugButton} 
            onPress={deleteBankDetails}
          >
            <Text style={styles.debugText}>DEBUG: Delete Bank Details</Text>
          </TouchableOpacity> */}
        </View>
      )}
    </View>
    
    {/* QR Code Preview and Generation */}
    <View style={[styles.previewContainer, paymentReceived && styles.paymentReceivedContainer]}>
      {paymentReceived && (
        <View style={styles.paymentSuccessIndicator}>
          <Text style={styles.paymentSuccessText}>✅ Payment Received!</Text>
        </View>
      )}
      
      <Text style={styles.previewTitle}>Preview</Text>
      <Text style={styles.previewText}>For: {itemName || 'Not set'}</Text>
      <Text style={styles.previewText}>Amount: {amount || '0.00'} {currencyType}</Text>
      <Text style={styles.previewText}>
        Recipient: {getRecipientAddress() ? 
          `${getRecipientAddress().slice(0, 6)}...${getRecipientAddress().slice(-4)} (You)` : 
          'Not set'
        }
      </Text>
      {memo && <Text style={styles.previewText}>Memo: {memo}</Text>}
      {currencyType === 'USD' && (
        <Text style={styles.previewText}>💰 Will auto-convert to USD in your bank</Text>
      )}
      
      {/* WebSocket connection status for USD payments */}
      {currencyType === 'USD' && connectedWalletAddress && (
        <Text style={styles.connectionStatus}>
          {wsConnection ? '🟢 Watching for payments...' : '🔴 Connecting...'}
        </Text>
      )}
    </View>
    
    <View style={styles.qrContainer}>
      <QRCode
        value={qrData}
        size={qrSize}
        color="black"
        backgroundColor="white"
      />
    </View>
    
    <Text style={styles.instructionText}>
      Have the customer scan this QR code to proceed with payment
    </Text>
    
    {/* Bank Details Modal */}
    <BankDetailsModal
      visible={showBankModal}
      onClose={() => setShowBankModal(false)}
      onSave={handleBankSave}
    />
  </ScrollView>
);
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  currencySelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 5,
  },
  currencyButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectedCurrency: {
    backgroundColor: '#007AFF',
  },
  currencyText: {
    fontSize: 16,
    color: '#666',
  },
  currencySubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  selectedText: {
    color: '#fff',
  },
  
  // Additional Settings Styles
  additionalSettingsSection: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  additionalSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
  },
  additionalSettingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  additionalSettingsArrow: {
    fontSize: 12,
    color: '#64748B',
  },
  additionalSettingsArrowOpen: {
    transform: [{ rotate: '180deg' }],
  },
  additionalSettingsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  settingGroup: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  
  // Wallet Status Styles (moved to settings)
  walletStatusContainer: {
    width: '100%',
  },
  connectedStatus: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    alignItems: 'center',
  },
  disconnectedStatus: {
    backgroundColor: '#ffeaea',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    alignItems: 'center',
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  disconnectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 4,
  },
  walletAddressText: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
  },
  statusSubtext: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  
  // Network Dropdown Styles (moved to settings)
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  arrow: {
    fontSize: 14,
    color: '#666',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItem: {
    backgroundColor: '#007AFF',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  selectedItemText: {
    color: '#fff',
  },
  dropdownItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  networkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  
  // Wallet Address Input (moved to settings)
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  autofillLink: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  connectedInput: {
    borderColor: '#4caf50',
    backgroundColor: '#f8fff8',
  },
  
  // Debug Button
  debugButton: {
    backgroundColor: '#FF6B6B',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Preview and QR Styles
  previewContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
    alignItems: 'center',
  },
  instructionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 10,
    paddingBottom: 20,
  },
  paymentReceivedContainer: {
    borderColor: '#4caf50',
    borderWidth: 2,
    backgroundColor: '#f8fff8',
  },
  paymentSuccessIndicator: {
    backgroundColor: '#4caf50',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  paymentSuccessText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectionStatus: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});