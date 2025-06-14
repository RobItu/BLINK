import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, ScrollView, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { createTransaction, CurrencyType, TransactionData } from '../types/transaction';
import { SUPPORTED_NETWORKS } from '../types/transaction';

interface QRCodeGeneratorProps {
  connectedWalletAddress?: string;
  isWalletConnected?: boolean;
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

// Simple network options from SUPPORTED_NETWORKS
const NETWORK_OPTIONS = SUPPORTED_NETWORKS.map(network => ({
  name: network.name,
  symbol: network.nativeCurrency.symbol,
  icon: getNetworkIcon(network.name) // Add this function
}));



export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  connectedWalletAddress,
  isWalletConnected = false 
}) => {
  const [currencyType, setCurrencyType] = useState<CurrencyType>('USDC');
  const [amount, setAmount] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [sellerWalletAddress, setSellerWalletAddress] = useState<string>('');
  const [memo, setmemo] = useState<string>('');
  const [qrSize, setQrSize] = useState<number>(200);
  const [desiredNetwork, setDesiredNetwork] = useState<string>('Ethereum'); // Default to first option
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  
  // Auto-populate seller wallet address when wallet connects
  useEffect(() => {
    if (connectedWalletAddress && !sellerWalletAddress) {
      setSellerWalletAddress(connectedWalletAddress);
    }
  }, [connectedWalletAddress]);
  
  // Create the full transaction data object (for storage/backend)
  const fullTransactionData: TransactionData = createTransaction(
    itemName,
    amount,
    currencyType,
    sellerWalletAddress || 'Not Connected',
    memo || undefined
  );
  
  
  // Even more compact: just essential info
  const compactData = {
    for: itemName,
    amount: amount,
    currency: currencyType,
    timestamp: Date.now(),
    id: fullTransactionData.id,
    sellerWalletAddress: sellerWalletAddress || 'Not Connected',
    memo: memo || undefined,
    network: desiredNetwork,
  };
  
  // Convert to JSON string for QR code (using compact version)
  const qrData = JSON.stringify(compactData);
  
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
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Generate Payment QR Code</Text>
      
      {/* Wallet Connection Status */}
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
            <Text style={styles.statusSubtext}>Connect a wallet to auto-fill seller address</Text>
          </View>
        )}
      </View>
      
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Destination Network</Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
        style={styles.dropdownButton}
        onPress={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <View style={styles.selectedContainer}>
          {selectedNetwork && (
            <Image source={selectedNetwork.icon} style={styles.networkIcon} />
          )}
          <Text style={styles.selectedText}>
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

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Item/Service Name</Text>
          <TextInput
            style={styles.textInput}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Lemonade, Coffee, Haircut"
            placeholderTextColor="#999"
            maxLength={30} // Limit length for QR efficiency
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
          <View style={styles.labelContainer}>
            <Text style={styles.inputLabel}>Seller Wallet Address</Text>
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
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Memo (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={memo}
            onChangeText={setmemo}
            placeholder="Add a note or memo"
            placeholderTextColor="#999"
            maxLength={20} // Limit length for QR efficiency
          />
          <Text style={styles.characterCount}>{memo.length}/20</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Currency</Text>
          <View style={styles.currencySelector}>
            <TouchableOpacity 
              style={[styles.currencyButton, currencyType === 'USDC' && styles.selectedCurrency]}
              onPress={() => setCurrencyType('USDC')}
            >
              <Text style={[styles.currencyText, currencyType === 'USDC' && styles.selectedText]}>
                USDC
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.currencyButton, currencyType === 'USD' && styles.selectedCurrency]}
              onPress={() => setCurrencyType('USD')}
            >
              <Text style={[styles.currencyText, currencyType === 'USD' && styles.selectedText]}>
                USD (Fiat)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Preview</Text>
        <Text style={styles.previewText}>For: {itemName}</Text>
        <Text style={styles.previewText}>Amount: {amount} {currencyType}</Text>
        <Text style={styles.previewText}>
          Seller: {sellerWalletAddress ? 
            `${sellerWalletAddress.slice(0, 6)}...${sellerWalletAddress.slice(-4)}` : 
            'Not set'
          }
        </Text>
        {memo && <Text style={styles.previewText}>Memo: {memo}</Text>}
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
  walletStatusContainer: {
    width: '100%',
    marginBottom: 20,
  },
  connectedStatus: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4caf50',
    alignItems: 'center',
  },
  disconnectedStatus: {
    backgroundColor: '#ffeaea',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f44336',
    alignItems: 'center',
  },
  connectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 5,
  },
  disconnectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 5,
  },
  walletAddressText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  statusSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  autofillLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
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
  connectedInput: {
    borderColor: '#4caf50',
    backgroundColor: '#f8fff8',
  },
  // Dropdown styles
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
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
  selectedText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
  },
  symbolText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 16,
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
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
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
    fontSize: 16,
    color: '#333',
  },
  dropdownSymbolText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedItemText: {
    color: '#fff',
  },
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
  networkIcon: {
  width: 24,
  height: 24,
  borderRadius: 12,
  marginRight: 10,
},
dropdownItemContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
  });