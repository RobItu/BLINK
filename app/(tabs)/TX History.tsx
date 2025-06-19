// app/(tabs)/history.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Alert } from 'react-native';
import { useActiveAccount } from "thirdweb/react";
import { transactionStorageService, StoredTransaction } from '@/services/TransactionStorageService';

const getNetworkIcon = (networkName: string) => {
  const iconMap: { [key: string]: any } = {
    'Sepolia': require('../../assets/images/networks/sepolia.png'),
    'Polygon': require('../../assets/images/networks/polygon.png'),
    'Avalanche Fuji': require('../../assets/images/networks/avalancheFuji.png'),
    'Base Sepolia': require('../../assets/images/networks/baseSepolia.png'),
    'Arbitrum': require('../../assets/images/networks/arbitrum.png'),
    'Ethereum': require('../../assets/images/networks/ethereum.png'),
    'Avalanche': require('../../assets/images/networks/avalancheFuji.png'),
  };
  return iconMap[networkName] || require('../../assets/images/networks/sepolia.png');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'complete': return '#28a745';
    case 'pending': return '#ffc107';
    case 'failed': return '#dc3545';
    default: return '#6c757d';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'complete': return '✅';
    case 'pending': return '⏳';
    case 'failed': return '❌';
    default: return '❓';
  }
};

export default function TransactionHistoryScreen() {
  const account = useActiveAccount();
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  useEffect(() => {
    if (account?.address) {
      loadTransactions();
    }
  }, [account?.address]);

  const loadTransactions = async () => {
    if (!account?.address) return;
    
    try {
      const txns = await transactionStorageService.getTransactions(account.address);
      setTransactions(txns);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const clearAllTransactions = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all transaction history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            if (account?.address) {
              await transactionStorageService.clearTransactions(account.address);
              setTransactions([]);
            }
          }
        }
      ]
    );
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderTransaction = ({ item }: { item: StoredTransaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.leftSection}>
          <Image source={getNetworkIcon(item.network)} style={styles.networkIcon} />
          <View style={styles.transactionInfo}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            <Text style={styles.addressText}>
              {item.type === 'sent' ? `To: ${formatAddress(item.toAddress)}` : `From: ${formatAddress(item.fromAddress)}`}
            </Text>
            {item.memo && <Text style={styles.memoText}>"{item.memo}"</Text>}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <Text style={[
            styles.amountText, 
            { color: item.type === 'sent' ? '#dc3545' : '#28a745' }
          ]}>
            {item.type === 'sent' ? '-' : '+'}{item.amount} {item.currency}
          </Text>
          <Text style={styles.timestampText}>{formatDate(item.timestamp)}</Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
      
      {item.transactionHash && (
        <View style={styles.hashContainer}>
          <Text style={styles.hashLabel}>Transaction Hash:</Text>
          <Text style={styles.hashText}>{formatAddress(item.transactionHash)}</Text>
        </View>
      )}
      
      {item.isCirclePayment && (
        <View style={styles.circleLabel}>
          <Text style={styles.circleLabelText}>💰 Auto-converted to fiat</Text>
        </View>
      )}
    </View>
  );

  if (!account?.address) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Connect your wallet to view transaction history</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity onPress={clearAllTransactions} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'sent', 'received'] as const).map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[styles.filterButton, filter === filterType && styles.activeFilterButton]}
            onPress={() => setFilter(filterType)}
          >
            <Text style={[styles.filterText, filter === filterType && styles.activeFilterText]}>
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {filter === 'all' ? 'No transactions yet' : `No ${filter} transactions`}
          </Text>
          <Text style={styles.emptySubtext}>
            {filter === 'sent' ? 'Scan QR codes to send payments' : 'Generate QR codes to receive payments'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  clearButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f8f9fa',
  },
  activeFilterButton: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  transactionItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftSection: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  networkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  memoText: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  hashContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  hashLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  hashText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  circleLabel: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  circleLabelText: {
    fontSize: 12,
    color: '#28a745',
    backgroundColor: '#f8fff8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});