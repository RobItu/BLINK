import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useActiveAccount, useWalletBalance, useSendTransaction } from "thirdweb/react";
import { getContract, prepareTransaction } from "thirdweb";
import { balanceOf, transfer } from "thirdweb/extensions/erc20";
import { avalanche, avalancheFuji, baseSepolia, ethereum, polygon, sepolia, arbitrum } from "thirdweb/chains";
import { toWei } from "thirdweb/utils";
import { client } from "@/constants/thirdweb";
import { TransactionData, SUPPORTED_NETWORKS } from '@/types/transaction';
import { BlinkPaymentService } from '@/services/BlinkPaymentService';


interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  contractAddress?: string;
  decimals: number;
  usdPrice?: number;
  usdValue?: string;
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

// Helper function to get token icon (use network icon for native tokens)
const getTokenIcon = (token: TokenBalance, networkName: string) => {
  // For native tokens (ETH, AVAX, MATIC), use network icon
  if (!token.contractAddress) {
    return getNetworkIcon(networkName);
  }
  // For ERC20 tokens, you could add specific token icons here
  // For now, use a default or network icon
  return getNetworkIcon(networkName);
};

export default function TransactionDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const account = useActiveAccount();
  
  // Payment method selection states
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [sendingTransaction, setSendingTransaction] = useState(false);
  
  const { mutate: sendTransaction } = useSendTransaction();
  
  // Parse the transaction data from params
  const transactionData: TransactionData = JSON.parse(params.transactionData as string);
  
  // Map network names to actual chain objects
  const getChainObject = (networkName: string) => {
    const chainMap: { [key: string]: any } = {
      'Ethereum': ethereum,
      'Polygon': polygon,
      'Avalanche': avalanche,
      'Arbitrum': arbitrum,
      'Sepolia': sepolia,
      'Avalanche Fuji': avalancheFuji,
      'Base Sepolia': baseSepolia,
    };
    return chainMap[networkName];
  };

  // Get selected network data and chain object
  const selectedNetworkData = SUPPORTED_NETWORKS.find(network => network.name === selectedNetwork);
  const selectedChainObject = getChainObject(selectedNetwork);
  
  // Get native token balance using thirdweb hook
  const { data: nativeBalance, isLoading: nativeLoading } = useWalletBalance({
    client,
    chain: selectedChainObject,
    address: account?.address,
  });

  // Fetch token balances when network changes
  useEffect(() => {
    if (selectedNetworkData && account?.address && selectedChainObject) {
      fetchTokenBalances();
    }
  }, [selectedNetworkData, account?.address, selectedChainObject, nativeBalance]);

  // Fetch USD prices for tokens
  const fetchTokenPrices = async (tokens: TokenBalance[]) => {
    setLoadingPrices(true);
    try {
      // Get unique coinGeckoIds from the network data
      const coinGeckoIds = [
        selectedNetworkData?.nativeCurrency.coinGeckoId,
        ...selectedNetworkData?.tokens.map(token => token.coinGeckoId) || []
      ].filter(Boolean).join(',');

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`
      );
      
      const prices = await response.json();
      
      // Update tokens with USD prices and values
      const updatedTokens = tokens.map(token => {
        const tokenData = selectedNetworkData?.nativeCurrency.symbol === token.symbol 
          ? selectedNetworkData.nativeCurrency 
          : selectedNetworkData?.tokens.find(t => t.symbol === token.symbol);
          
        const coinGeckoId = tokenData?.coinGeckoId;
        const usdPrice = coinGeckoId && prices[coinGeckoId] ? prices[coinGeckoId].usd : 0;
        const balance = parseFloat(token.balance);
        const usdValue = usdPrice && balance ? (balance * usdPrice).toFixed(2) : '0.00';
        
        return {
          ...token,
          usdPrice,
          usdValue
        };
      });
      
      setTokenBalances(updatedTokens);
    } catch (error) {
      console.error('Error fetching token prices:', error);
      // Keep tokens without USD data if price fetch fails
    } finally {
      setLoadingPrices(false);
    }
  };

  const fetchTokenBalances = async () => {
    if (!selectedNetworkData || !account?.address || !selectedChainObject) return;
    
    setLoadingBalances(true);
    const balances: TokenBalance[] = [];
    
    try {
      // Add native token balance
      if (nativeBalance) {
        balances.push({
          symbol: selectedNetworkData.nativeCurrency.symbol,
          name: selectedNetworkData.nativeCurrency.name,
          balance: formatBalance(nativeBalance.displayValue, 6),
          decimals: selectedNetworkData.nativeCurrency.decimals,
        });
      }

      // Fetch ERC20 token balances
      for (const token of selectedNetworkData.tokens) {
        try {
          const contract = getContract({
            client,
            chain: selectedChainObject, // Use the full chain object
            address: token.contractAddress!,
          });

          const balance = await balanceOf({
            contract,
            address: account.address,
          });

          const formattedBalance = formatTokenBalance(balance, token.decimals);
          
          balances.push({
            symbol: token.symbol,
            name: token.name,
            balance: formattedBalance,
            contractAddress: token.contractAddress,
            decimals: token.decimals,
          });
        } catch (error) {
          console.log(`Error fetching ${token.symbol} balance:`, error);
          // Add token with 0 balance if fetch fails
          balances.push({
            symbol: token.symbol,
            name: token.name,
            balance: '0.00',
            contractAddress: token.contractAddress,
            decimals: token.decimals,
          });
        }
      }

      setTokenBalances(balances);
      
      // Fetch USD prices after getting balances
      await fetchTokenPrices(balances);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const formatBalance = (balance: string, maxDecimals: number = 6): string => {
    const num = parseFloat(balance);
    if (num === 0) return '0.00';
    if (num < 0.000001) return '< 0.000001';
    return num.toFixed(Math.min(maxDecimals, 6));
  };

  const formatTokenBalance = (balance: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals);
    const quotient = balance / divisor;
    const remainder = balance % divisor;
    
    const wholePart = quotient.toString();
    const fractionalPart = remainder.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalPart.slice(0, 6).replace(/0+$/, '');
    
    if (trimmedFractional) {
      return `${wholePart}.${trimmedFractional}`;
    }
    return wholePart;
  };

  const handleConfirmPayment = async () => {
    if (!selectedNetwork || !selectedToken) {
      Alert.alert('Error', 'Please select a network and token for payment');
      return;
    }
    
    const selectedTokenBalance = tokenBalances.find(token => token.symbol === selectedToken);
    const requiredAmount = calculateRequiredTokenAmount(selectedTokenBalance!);
    const remainingBalance = getRemainingBalance(selectedTokenBalance!);
    
    // Show confirmation with option to send
    Alert.alert(
      'Confirm Payment',
      `⚠️ Payment Warning:

You will be sending ${transactionData.amount} USD worth of ${selectedToken}.
Your remaining ${selectedToken} balance will be ${remainingBalance} ${selectedToken}.

Payment Details:
• Item: ${transactionData.for}
• Network: ${selectedNetwork}
• Sending: ${requiredAmount} ${selectedToken}
• To: ${transactionData.sellerWalletAddress?.slice(0, 6)}...${transactionData.sellerWalletAddress?.slice(-4)}

Do you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Payment', onPress: () => executePayment(selectedTokenBalance!, requiredAmount) }
      ]
    );
  };

  const handlePaymentSuccess = (result: any, requiredAmount: string, isCrossChain: boolean) => {
  const successMessage = isCrossChain 
    ? `Cross-chain payment initiated! 🚀\n\nThe payment will arrive at ${transactionData.network} shortly.`
    : `Payment sent successfully! 🎉`;

  Alert.alert('Payment Completed!', successMessage, [
    { text: 'OK', onPress: () => router.back() }
  ]);
  setSendingTransaction(false);
};

const handlePaymentError = (error: any) => {
  Alert.alert('Transaction Failed', `Error: ${error.message}`);
  setSendingTransaction(false);
};

const executePayment = async (tokenBalance: TokenBalance, requiredAmount: string) => {
  if (!account?.address || !selectedChainObject) return;
  
  setSendingTransaction(true);
  
  try {
    const isCrossChain = BlinkPaymentService.isCrossChainAvailable(selectedNetwork, transactionData.network as string);
    
    // Show appropriate confirmation
    const paymentMethod = isCrossChain ? 'Cross-Chain BLINK Payment' : 'Direct Transfer';
    const confirmMessage = `${paymentMethod}\n\n${
      isCrossChain 
        ? `${selectedNetwork} → ${transactionData.network}\nAmount: ${requiredAmount} ${selectedToken}`
        : `Network: ${selectedNetwork}\nAmount: ${requiredAmount} ${selectedToken}`
    }\n\nProceed?`;
    
    Alert.alert('Confirm Payment', confirmMessage, [
      { text: 'Cancel', style: 'cancel', onPress: () => setSendingTransaction(false) },
      { 
        text: 'Confirm', 
        onPress: async () => {
          await BlinkPaymentService.executePayment({
            client,
            sourceNetwork: selectedNetwork,
            destinationNetwork: transactionData.network || '',
            selectedChain: selectedChainObject,
            userAddress: account.address,
            sellerAddress: transactionData.sellerWalletAddress as string,
            tokenBalance: {
              symbol: tokenBalance.symbol,
              contractAddress: tokenBalance.contractAddress,
              balance: tokenBalance.balance,
            },
            requiredAmount,
            sendTransaction: (tx: any, callbacks: any) => {
              sendTransaction(tx, {
                onSuccess: (result: any) => {
                  handlePaymentSuccess(result, requiredAmount, isCrossChain);
                  callbacks.onSuccess?.(result);
                },
                onError: (error: any) => {
                  handlePaymentError(error);
                  callbacks.onError?.(error);
                },
              });
            },
          });
        }
      }
    ]);
  } catch (error) {
    console.error('Payment error:', error);
    Alert.alert('Error', 'Failed to process payment');
    setSendingTransaction(false);
  }
};

  const handleNetworkSelect = (networkName: string) => {
    setSelectedNetwork(networkName);
    setSelectedToken(''); // Reset token when network changes
    setTokenBalances([]); // Clear previous balances
    setShowNetworkModal(false);
  };

  const handleTokenSelect = (tokenSymbol: string) => {
    setSelectedToken(tokenSymbol);
    setShowTokenModal(false);
  };

  const hasInsufficientBalance = (tokenBalance: TokenBalance) => {
    const tokenUsdValue = parseFloat(tokenBalance.usdValue || '0');
    const requiredUsd = parseFloat(transactionData.amount);
    return tokenUsdValue < requiredUsd;
  };

  const calculateRequiredTokenAmount = (tokenBalance: TokenBalance) => {
    const requiredUsd = parseFloat(transactionData.amount);
    const tokenUsdPrice = tokenBalance.usdPrice || 0;
    
    if (tokenUsdPrice === 0) return '0';
    
    const requiredTokenAmount = requiredUsd / tokenUsdPrice;
    return requiredTokenAmount.toFixed(6); // 6 decimal places
  };

  const getRemainingBalance = (tokenBalance: TokenBalance) => {
    const currentBalance = parseFloat(tokenBalance.balance);
    const requiredAmount = parseFloat(calculateRequiredTokenAmount(tokenBalance));
    const remaining = currentBalance - requiredAmount;
    
    return remaining > 0 ? remaining.toFixed(6) : '0';
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
              <Text style={styles.inputLabel}>Your Token Balances</Text>
              
              {/* Warning Message */}
              {selectedToken && (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>
                    ⚠️ You will send ${transactionData.amount} USD worth of {selectedToken} when confirming payment
                  </Text>
                </View>
              )}
              
              {loadingBalances || nativeLoading || loadingPrices ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.loadingText}>
                    {loadingBalances || nativeLoading ? 'Loading balances...' : 'Loading prices...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.tokenBalancesContainer}>
                  {tokenBalances.map((token) => (
                    <TouchableOpacity
                      key={token.symbol}
                      style={[
                        styles.tokenBalanceButton,
                        selectedToken === token.symbol && styles.selectedTokenButton,
                        hasInsufficientBalance(token) && styles.insufficientBalanceButton,
                      ]}
                      onPress={() => handleTokenSelect(token.symbol)}
                      disabled={hasInsufficientBalance(token)}
                    >
                      <View style={styles.tokenInfo}>
                        <View style={styles.tokenHeader}>
                          <Image source={getTokenIcon(token, selectedNetwork)} style={styles.tokenIcon} />
                          <View style={styles.tokenNameContainer}>
                            <Text style={[
                              styles.tokenSymbol,
                              selectedToken === token.symbol && styles.selectedTokenText,
                              hasInsufficientBalance(token) && styles.insufficientBalanceText,
                            ]}>
                              {token.symbol}
                            </Text>
                            <Text style={[
                              styles.tokenName,
                              selectedToken === token.symbol && styles.selectedTokenText,
                              hasInsufficientBalance(token) && styles.insufficientBalanceText,
                            ]}>
                              {token.name}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.balanceInfo}>
                        <Text style={[
                          styles.tokenBalance,
                          selectedToken === token.symbol && styles.selectedTokenText,
                          hasInsufficientBalance(token) && styles.insufficientBalanceText,
                        ]}>
                          {token.balance}
                        </Text>
                        {token.usdValue && (
                          <Text style={[
                            styles.usdValue,
                            selectedToken === token.symbol && styles.selectedTokenText,
                            hasInsufficientBalance(token) && styles.insufficientBalanceText,
                          ]}>
                            ${token.usdValue}
                          </Text>
                        )}
                        {!hasInsufficientBalance(token) && token.usdPrice && (
                          <Text style={[
                            styles.requiredAmount,
                            selectedToken === token.symbol && styles.selectedTokenText,
                          ]}>
                            Need: {calculateRequiredTokenAmount(token)} {token.symbol}
                          </Text>
                        )}
                        {hasInsufficientBalance(token) && (
                          <Text style={styles.insufficientText}>Insufficient</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.confirmButton, 
            ((!selectedNetwork || !selectedToken) || sendingTransaction) && styles.disabledButton
          ]} 
          onPress={handleConfirmPayment}
          disabled={!selectedNetwork || !selectedToken || sendingTransaction}
        >
          <Text style={styles.buttonText}>
            {sendingTransaction ? 'Sending...' : 'Confirm Payment'}
          </Text>
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
                  <View style={styles.modalItemContainer}>
                    <Image source={getNetworkIcon(network.name)} style={styles.networkIcon} />
                    <Text style={styles.modalItemText}>{network.name}</Text>
                  </View>
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
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  networkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },
  arrow: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  tokenBalancesContainer: {
    gap: 10,
  },
  tokenBalanceButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTokenButton: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  insufficientBalanceButton: {
    borderColor: '#ffcccc',
    backgroundColor: '#fff5f5',
    opacity: 0.6,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenNameContainer: {
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  balanceInfo: {
    alignItems: 'flex-end',
  },
  tokenBalance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  usdValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  requiredAmount: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
    fontWeight: '500',
  },
  insufficientText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 2,
  },
  selectedTokenText: {
    color: '#007AFF',
  },
  insufficientBalanceText: {
    color: '#999',
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
  modalItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});