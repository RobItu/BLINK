import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveAccount } from "thirdweb/react";
import { TransactionData, SUPPORTED_NETWORKS } from '@/types/transaction';

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const account = useActiveAccount();
  
  // Payment method selection states
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  
  // Parse the transaction data from params
  const transactionData: TransactionData = JSON.parse(params.transactionData as string);
  
  // Get available tokens for selected network
  const selectedNetworkData = SUPPORTED_NETWORKS.find(network => network.name === selectedNetwork);
  const availableTokens = selectedNetworkData ? 
    [selectedNetworkData.nativeCurrency, ...selectedNetworkData.tokens] : [];
  
  const handleConfirmPayment = () => {
    if (!selectedNetwork || !selectedToken) {
      Alert.alert('Error', 'Please select a network and token for payment');
      return;
    }
    
    Alert.alert(
      'Payment Confirmed',
      `Payment of ${transactionData.amount} ${transactionData.currency} for ${transactionData.for} will be paid with ${selectedToken} on ${selectedNetwork}`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const handleNetworkSelect = (networkName: string) => {
    setSelectedNetwork(networkName);
    setSelectedToken(''); // Reset token when network changes
    setShowNetworkModal(false);
  };

  const handleTokenSelect = (tokenSymbol: string) => {
    setSelectedToken(tokenSymbol);
    setShowTokenModal(false);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction Details</Text>
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.detailsContainer}>
          <Text style={styles.detailText}>ID: {transactionData.id}</Text>
          <Text style={styles.detailText}>Your Wallet: {account?.address ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : 'Not Connected'}</Text>
          <Text style={styles.detailText}>Destination Network: {transactionData.network}</Text>
          <Text style={styles.detailText}>To: {transactionData.sellerWalletAddress ? `${transactionData.sellerWalletAddress.slice(0, 6)}...${transactionData.sellerWalletAddress.slice(-4)}` : 'Not specified'}</Text>
          <Text style={styles.detailText}>For: {transactionData.for}</Text>
          <Text style={styles.detailText}>Amount: {transactionData.amount} {transactionData.currency}</Text>
          {transactionData.memo && (
            <Text style={styles.detailText}>Memo: {transactionData.memo}</Text>
          )}
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Network</Text>
            <TouchableOpacity 
              style={styles.selectorButton}
              onPress={() => setShowNetworkModal(true)}
            >
              <Text style={styles.selectorText}>{selectedNetwork || 'Choose Network'}</Text>
              <Text style={styles.arrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {selectedNetwork && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Token</Text>
              <TouchableOpacity 
                style={styles.selectorButton}
                onPress={() => setShowTokenModal(true)}
              >
                <Text style={styles.selectorText}>{selectedToken || 'Choose Token'}</Text>
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.confirmButton, 
            (!selectedNetwork || !selectedToken) && styles.disabledButton
          ]} 
          onPress={handleConfirmPayment}
          disabled={!selectedNetwork || !selectedToken}
        >
          <Text style={styles.buttonText}>Confirm Payment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Network Selection Modal */}
      <Modal
        visible={showNetworkModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Network</Text>
            <ScrollView style={styles.modalList}>
              {SUPPORTED_NETWORKS.map((network) => (
                <TouchableOpacity
                  key={network.chainId}
                  style={styles.modalItem}
                  onPress={() => handleNetworkSelect(network.name)}
                >
                  <Text style={styles.modalItemText}>{network.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowNetworkModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Token Selection Modal */}
      <Modal
        visible={showTokenModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTokenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Token</Text>
            <ScrollView style={styles.modalList}>
              {availableTokens.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={styles.modalItem}
                  onPress={() => handleTokenSelect(token.symbol)}
                >
                  <Text style={styles.modalItemText}>{token.name} ({token.symbol})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowTokenModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  detailsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 8,
  },
  paymentSection: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  arrow: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  modalCloseText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
});