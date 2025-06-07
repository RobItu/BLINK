import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type CurrencyType = 'USDC' | 'USD';

interface TransactionData {
  for: string;
  amount: string;
  currency: CurrencyType;
  timestamp: number;
  id: string;
}

export const QRCodeGenerator: React.FC = () => {
  const [currencyType, setCurrencyType] = useState<CurrencyType>('USDC');
  const [amount, setAmount] = useState<string>('5.00');
  const [itemName, setItemName] = useState<string>('lemonade');
  
  // Create the transaction data object
  const transactionData: TransactionData = {
    for: itemName,
    amount: amount,
    currency: currencyType,
    timestamp: Date.now(),
    id: `txn_${Date.now()}` // unique transaction ID
  };
  
  // Convert to JSON string for QR code
  const qrData = JSON.stringify(transactionData);
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Generate Payment QR Code</Text>
      
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Item/Service Name</Text>
          <TextInput
            style={styles.textInput}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Lemonade, Coffee, Haircut"
            placeholderTextColor="#999"
          />
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
      </View>
      
      <View style={styles.qrContainer}>
        <QRCode
          value={qrData}
          size={200}
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
    marginBottom: 30,
    color: '#333',
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  instructionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 10,
    paddingBottom: 20,
  },
});