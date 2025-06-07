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
  
  // Parse the transaction data from params
  const transactionData: TransactionData = JSON.parse(params.transactionData as string);
  
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
        <Text style={styles.detailText}>For: {transactionData.for}</Text>
        <Text style={styles.detailText}>Amount: {transactionData.amount} {transactionData.currency}</Text>
        <Text style={styles.detailText}>ID: {transactionData.id}</Text>
      </View>
      
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPayment}>
        <Text style={styles.buttonText}>Confirm Payment</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  detailsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  detailText: {
    fontSize: 18,
    marginBottom: 10,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#666',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});