import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface TransactionData {
  for: string;
  amount: string;
  currency: string;
  timestamp: number;
  id: string;
}

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // DEBUG: Log what params we received
  console.log('Received params:', params);
  
  // Parse the transaction data from params
  let transactionData: TransactionData;
  
  try {
    transactionData = JSON.parse(params.transactionData as string);
    console.log('Parsed transaction data:', transactionData);
  } catch (error) {
    console.log('Error parsing transaction data:', error);
    
    // Fallback with default data if parsing fails
    transactionData = {
      for: 'Unknown Item',
      amount: '0.00',
      currency: 'USD',
      timestamp: Date.now(),
      id: 'error'
    };
  }
  
  const handleConfirmPayment = () => {
    Alert.alert(
      'Payment Confirmed',
      `Payment of ${transactionData.amount} ${transactionData.currency} for ${transactionData.for} has been processed.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction Details</Text>
      
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>For:</Text>
          <Text style={styles.detailValue}>{transactionData.for}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount:</Text>
          <Text style={styles.detailValue}>
            {transactionData.amount} {transactionData.currency}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Transaction ID:</Text>
          <Text style={styles.detailValue}>{transactionData.id}</Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPayment}>
        <Text style={styles.confirmButtonText}>Confirm Payment</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  detailsContainer: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  confirmButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
    width: '80%',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    width: '80%',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});