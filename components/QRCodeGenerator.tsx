import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { createTransaction, CurrencyType, TransactionData } from '../types/transaction';

interface QRCodeGeneratorProps {
  connectedWalletAddress?: string;
  isWalletConnected?: boolean;
}


export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  connectedWalletAddress,
  isWalletConnected = false 
}) => {
  const [currencyType, setCurrencyType] = useState<CurrencyType>('USDC');
  const [amount, setAmount] = useState<string>('5.00');
  const [itemName, setItemName] = useState<string>('lemonade');
  const [sellerWalletAddress, setSellerWalletAddress] = useState<string>('');
  const [memo, setmemo] = useState<string>('');
  const [qrSize, setQrSize] = useState<number>(200);
  
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
    memo: memo || undefined
  };
  
  // Convert to JSON string for QR code (using compact version)
  const qrData = JSON.stringify(compactData);
  
  const handleUseConnectedWallet = () => {
    if (connectedWalletAddress) {
      setSellerWalletAddress(connectedWalletAddress);
    }
  };
  
  // // Calculate QR data size
  // const dataSize = new Blob([qrData]).size;
  // const isDataTooLarge = dataSize > 1000; // Warn if over 1KB
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Generate Payment QR Code</Text>
      
      {/* QR Size Controller
      <View style={styles.qrSizeContainer}>
        <Text style={styles.inputLabel}>QR Code Size</Text>
        <View style={styles.sizeButtons}>
          {[150, 200, 250, 300].map(size => (
            <TouchableOpacity
              key={size}
              style={[
                styles.sizeButton,
                qrSize === size && styles.selectedSizeButton
              ]}
              onPress={() => setQrSize(size)}
            >
              <Text style={[
                styles.sizeButtonText,
                qrSize === size && styles.selectedSizeButtonText
              ]}>
                {size}px
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View> */}
      
      
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
        {/* <Text style={styles.previewTextSmall}>
          QR Data Size: {dataSize} bytes
        </Text> */}
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
  qrSizeContainer: {
    width: '100%',
    marginBottom: 15,
  },
  sizeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  sizeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedSizeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sizeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  selectedSizeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
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
  useWalletButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  useWalletButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  previewTextSmall: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 5,
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
  selectedText: {
    color: '#fff',
    fontWeight: 'bold',
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
  technicalDetails: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
  },
  technicalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  technicalText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  instructionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 10,
    paddingBottom: 20,
  },
});