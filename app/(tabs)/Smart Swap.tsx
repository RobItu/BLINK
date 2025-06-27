// app/(tabs)/send.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, Image, Linking, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveAccount, useWalletBalance, useSendTransaction } from "thirdweb/react";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { avalanche, avalancheFuji, baseSepolia, ethereum, polygon, sepolia, arbitrum } from "thirdweb/chains";
import { client } from "@/constants/thirdweb";
import { SUPPORTED_NETWORKS } from '@/types/transaction';
import { BlinkPaymentService } from '@/services/BlinkPaymentService';
import { transactionStorageService } from '@/services/TransactionStorageService';

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
    'Sepolia': require('../../assets/images/networks/sepolia.png'),
    'Polygon': require('../../assets/images/networks/polygon.png'),
    'Avalanche Fuji': require('../../assets/images/networks/avalancheFuji.png'),
    'Base Sepolia': require('../../assets/images/networks/baseSepolia.png'),
    'Arbitrum': require('../../assets/images/networks/arbitrum.png'),
    'Ethereum': require('../../assets/images/networks/ethereum.png'),
    'Avalanche': require('../../assets/images/networks/avalancheFuji.png'),
	'USDC': require('../../assets/images/networks/tokens/USDC.png'),
	'cbBTC': require('../../assets/images/networks/tokens/cbBTC.png'),
	'GUN': require('../../assets/images/networks/tokens/GUN.png'),
  };
  return iconMap[networkName] || require('../../assets/images/networks/sepolia.png');
};

const getTokenIcon = (token: TokenBalance, networkName: string) => {
  if (!token.contractAddress) {
    return getNetworkIcon(networkName);
  }
  return getNetworkIcon(networkName);
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getExplorerUrl = (networkName: string, txHash: string) => {
  const explorerMap: { [key: string]: string } = {
    'Avalanche Fuji': `https://testnet.snowtrace.io/tx/${txHash}`,
    'Base Sepolia': `https://sepolia.basescan.org/tx/${txHash}`,
    'Sepolia': `https://sepolia.etherscan.io/tx/${txHash}`,
    'Polygon': `https://polygonscan.com/tx/${txHash}`,
    'Ethereum': `https://etherscan.io/tx/${txHash}`,
    'Arbitrum': `https://arbiscan.io/tx/${txHash}`,
  };
  return explorerMap[networkName] || `https://etherscan.io/tx/${txHash}`;
};

export default function SendTabScreen() {
  const router = useRouter();
  const account = useActiveAccount();
  
  // Form states
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [amountType, setAmountType] = useState<'token' | 'usd'>('usd');
  const [memo, setMemo] = useState<string>('');
  
  // Selection states
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [destinationNetwork, setDestinationNetwork] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [receivedToken, setReceivedToken] = useState<string>('');
  
  // Modal states
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showReceivedTokenModal, setShowReceivedTokenModal] = useState(false);
  
  // Custom modal states
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    sendAmount: string;
    usdValue: string;
    isCrossChain: boolean;
  } | null>(null);
  const [successData, setSuccessData] = useState<{
    transactionHash: string;
    sendAmount: string;
    usdValue: string;
    isCrossChain: boolean;
    explorerUrl: string;
    ccipUrl?: string;
  } | null>(null);
  
  // Balance states
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [destinationTokens, setDestinationTokens] = useState<TokenBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [sendingTransaction, setSendingTransaction] = useState(false);
  
  const { mutate: sendTransaction } = useSendTransaction();
  
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
  const destinationNetworkData = SUPPORTED_NETWORKS.find(network => network.name === destinationNetwork);
  const selectedChainObject = getChainObject(selectedNetwork);
  
  // Get native token balance using thirdweb hook
  const { data: nativeBalance, isLoading: nativeLoading } = useWalletBalance({
    client,
    chain: selectedChainObject,
    address: account?.address,
  });

  // Fetch destination network tokens when destination changes
  useEffect(() => {
    if (destinationNetworkData) {
      fetchDestinationTokens();
    }
  }, [destinationNetworkData]);

  // Fetch source token balances when network changes
  useEffect(() => {
    if (selectedNetworkData && account?.address && selectedChainObject) {
      fetchTokenBalances();
    }
  }, [selectedNetworkData, account?.address, selectedChainObject, nativeBalance]);

  // Fetch destination network available tokens
  const fetchDestinationTokens = () => {
    if (!destinationNetworkData) return;
    
    const tokens: TokenBalance[] = [
      {
        symbol: destinationNetworkData.nativeCurrency.symbol,
        name: destinationNetworkData.nativeCurrency.name,
        balance: '0',
        decimals: destinationNetworkData.nativeCurrency.decimals,
      },
      ...destinationNetworkData.tokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        balance: '0',
        contractAddress: token.contractAddress,
        decimals: token.decimals,
      }))
    ];
    
    setDestinationTokens(tokens);
  };

  // Fetch USD prices for tokens
  const fetchTokenPrices = async (tokens: TokenBalance[]) => {
    setLoadingPrices(true);
    try {
      const coinGeckoIds = [
        selectedNetworkData?.nativeCurrency.coinGeckoId,
        ...selectedNetworkData?.tokens.map(token => token.coinGeckoId) || []
      ].filter(Boolean).join(',');

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`
      );
      
      const prices = await response.json();
      
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
            chain: selectedChainObject,
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

  // Calculate amount based on type selection
const calculateSendAmount = (selectedTokenBalance: TokenBalance) => {
  if (!amountInput || amountInput === '') return '0';
  
  if (amountType === 'token') {
    return parseFloat(amountInput).toFixed(6);
  } else {
    const usdAmount = parseFloat(amountInput);
    const tokenPrice = selectedTokenBalance.usdPrice || 0;
    if (tokenPrice === 0 || isNaN(usdAmount)) return '0';
    return (usdAmount / tokenPrice).toFixed(6);
  }
};

  const hasInsufficientBalance = (tokenBalance: TokenBalance) => {
    const sendAmount = parseFloat(calculateSendAmount(tokenBalance));
    const availableBalance = parseFloat(tokenBalance.balance);
    return sendAmount > availableBalance;
  };

 const handleConfirmPayment = async () => {
  if (!selectedNetwork || !destinationNetwork || !selectedToken || !receivedToken || !recipientAddress || !amountInput) {
    Alert.alert('Error', 'Please fill in all required fields');
    return;
  }

  if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
    Alert.alert('Error', 'Please enter a valid Ethereum address');
    return;
  }
  
  const selectedTokenBalance = tokenBalances.find(token => token.symbol === selectedToken);
  if (!selectedTokenBalance) return;

  const sendAmount = calculateSendAmount(selectedTokenBalance);
  const usdValue = amountType === 'usd' 
    ? amountInput 
    : (parseFloat(sendAmount) * (selectedTokenBalance.usdPrice || 0)).toFixed(2);

  const isCrossChain = selectedNetwork !== destinationNetwork;
  const needsSwap = BlinkPaymentService.isSwapNeeded(selectedToken, receivedToken, selectedNetwork, destinationNetwork);

  console.log('🐛 DEBUG SMART SWAP:');
  console.log('selectedToken:', selectedToken);
  console.log('receivedToken:', receivedToken);
  console.log('selectedNetwork:', selectedNetwork);
  console.log('destinationNetwork:', destinationNetwork);
  console.log('isCrossChain:', isCrossChain);
  console.log('needsSwap:', needsSwap);

  // Set confirmation data and show custom modal
  setConfirmationData({
    sendAmount,
    usdValue,
    isCrossChain,
  });
  setShowConfirmationModal(true);
};

  const executePayment = async (sendAmount: string, usdValue: string, isCrossChain: boolean) => {
  const selectedTokenBalance = tokenBalances.find(token => token.symbol === selectedToken);
  if (!account?.address || !selectedChainObject || !selectedTokenBalance) return;
  
  setSendingTransaction(true);
  setShowConfirmationModal(false);
  
  try {
    console.log('🐛 DEBUG SMART SWAP EXECUTION:');
    console.log('sendAmount:', sendAmount);
    console.log('selectedToken:', selectedToken);
    console.log('receivedToken:', receivedToken);
    console.log('selectedNetwork:', selectedNetwork);
    console.log('destinationNetwork:', destinationNetwork);
    console.log('isCrossChain:', isCrossChain);
    
    await BlinkPaymentService.executePayment({
      client,
      sourceNetwork: selectedNetwork,
      destinationNetwork: destinationNetwork,
      selectedChain: selectedChainObject,
      userAddress: account.address,
      sellerAddress: recipientAddress,
      tokenBalance: {
        symbol: selectedTokenBalance.symbol,
        contractAddress: selectedTokenBalance.contractAddress,
        balance: selectedTokenBalance.balance,
      },
      requiredAmount: sendAmount,
      receivedTokenSymbol: receivedToken, // This is crucial - use the token the recipient should receive
      sendTransaction: (tx: any, callbacks: any) => {
        sendTransaction(tx, {
          onSuccess: (result: any) => {
            handlePaymentSuccess(result, sendAmount, usdValue, selectedToken, isCrossChain);
            callbacks.onSuccess?.(result);
          },
          onError: (error: any) => {
            handlePaymentError(error);
            callbacks.onError?.(error);
          },
        });
      },
    });
  } catch (error) {
    console.error('Payment error:', error);
    Alert.alert('Error', 'Failed to process payment');
    setSendingTransaction(false);
  }
};

  const handlePaymentSuccess = async (result: any, sendAmount: string, usdValue: string, currency: string, isCrossChain: boolean) => {
    console.log(result);
    const transactionHash = result.transactionHash;
    const ccipExplorerUrl = `https://ccip.chain.link/tx/${transactionHash}`;
    const explorerUrl = getExplorerUrl(selectedNetwork, transactionHash);

    await transactionStorageService.addTransaction(account?.address!, {
      id: generateUUID(),
      type: 'sent',
      amount: usdValue,
      currency: currency,
      itemName: `Smart Swap → ${selectedToken} → ${receivedToken}`,
      memo: memo || undefined,
      network: selectedNetwork,
      transactionHash: result.transactionHash,
      fromAddress: account?.address!,
      toAddress: recipientAddress,
      timestamp: Date.now(),
      status: 'complete',
      isCirclePayment: false
    });

    // Set success data and show custom modal
    setSuccessData({
      transactionHash,
      sendAmount,
      usdValue,
      isCrossChain,
      explorerUrl,
      ccipUrl: isCrossChain ? ccipExplorerUrl : undefined,
    });
    setShowSuccessModal(true);
    setSendingTransaction(false);
  };

  const handlePaymentError = (error: any) => {
    Alert.alert('Transaction Failed', `Error: ${error.message}`);
    setSendingTransaction(false);
  };

  const handleNetworkSelect = (networkName: string) => {
    setSelectedNetwork(networkName);
    setSelectedToken('');
    setTokenBalances([]);
    setShowNetworkModal(false);
  };

  const handleDestinationSelect = (networkName: string) => {
    setDestinationNetwork(networkName);
    setReceivedToken('');
    setShowDestinationModal(false);
  };

  const handleTokenSelect = (tokenSymbol: string) => {
    setSelectedToken(tokenSymbol);
  };

  const handleReceivedTokenSelect = (tokenSymbol: string) => {
    setReceivedToken(tokenSymbol);
    setShowReceivedTokenModal(false);
  };

  if (!account?.address) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Connect your wallet to send payments</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Swap</Text>
      
      <ScrollView style={styles.scrollContainer}>
        {/* Recipient Info Box */}
        <View style={styles.recipientBox}>
          <Text style={styles.boxTitle}>Recipient Will Receive</Text>
          
          <View style={styles.recipientRow}>
            <Text style={styles.recipientLabel}>TO:</Text>
            <TouchableOpacity 
              style={styles.recipientAddressContainer}
              onPress={() => {/* Could open address book or QR scanner */}}
            >
              <TextInput
                style={styles.recipientAddressInput}
                value={recipientAddress}
                onChangeText={setRecipientAddress}
                placeholder="0x..."
                placeholderTextColor="#999"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.recipientRow}>
  <Text style={styles.recipientLabel}>NETWORK:</Text>
  <TouchableOpacity 
    style={styles.recipientSelector}
    onPress={() => setShowDestinationModal(true)}
  >
    <View style={styles.selectorWithIcon}>
      {destinationNetwork && (
        <Image 
          source={getNetworkIcon(destinationNetwork)} 
          style={styles.recipientNetworkIcon} 
        />
      )}
      <Text style={[
        styles.recipientSelectorText,
        !destinationNetwork && styles.disabledText
      ]}>
        {destinationNetwork || '[SELECT NETWORK]'}
      </Text>
    </View>
    <Text style={styles.arrow}>▼</Text>
  </TouchableOpacity>
</View>

          <View style={styles.recipientRow}>
            <Text style={styles.recipientLabel}>TOKEN:</Text>
            <TouchableOpacity 
              style={styles.recipientSelector}
              onPress={() => setShowReceivedTokenModal(true)}
              disabled={!destinationNetwork}
            >
              <View style={styles.selectorWithIcon}>
                {receivedToken && (
                  <Image 
                    source={getTokenIcon(destinationTokens.find(t => t.symbol === receivedToken) || { symbol: receivedToken, name: '', balance: '0', decimals: 18 }, destinationNetwork)} 
                    style={styles.recipientNetworkIcon} 
                  />
                )}
                <Text style={[
                  styles.recipientSelectorText,
                  !destinationNetwork && styles.disabledText
                ]}>
                  {receivedToken || '[SELECT TOKEN]'}
                </Text>
              </View>
              <Text style={styles.arrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount Section */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Amount ({amountType === 'usd' ? 'USD' : 'Token'})</Text>
          
          <View style={styles.amountTypeSelector}>
            <TouchableOpacity 
              style={[styles.amountTypeButton, amountType === 'usd' && styles.selectedAmountType]}
              onPress={() => setAmountType('usd')}
            >
              <Text style={[styles.amountTypeText, amountType === 'usd' && styles.selectedAmountTypeText]}>
                USD Amount
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.amountTypeButton, amountType === 'token' && styles.selectedAmountType]}
              onPress={() => setAmountType('token')}
            >
              <Text style={[styles.amountTypeText, amountType === 'token' && styles.selectedAmountTypeText]}>
                Token Amount
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.textInput}
            value={amountInput}
            onChangeText={setAmountInput}
            placeholder={amountType === 'usd' ? '10.00' : '0.1'}
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
        </View>

        {/* From Network */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>From Network</Text>
          <TouchableOpacity 
            style={styles.selectorButton}
            onPress={() => setShowNetworkModal(true)}
          >
            <View style={styles.selectorWithIcon}>
              {selectedNetwork && (
                <Image 
                  source={getNetworkIcon(selectedNetwork)} 
                  style={styles.recipientNetworkIcon} 
                />
              )}
              <Text style={[
                styles.selectorText,
                !selectedNetwork && styles.disabledText
              ]}>
                {selectedNetwork || '[SELECT NETWORK]'}
              </Text>
            </View>
            <Text style={styles.arrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Memo */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Memo (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={memo}
            onChangeText={setMemo}
            placeholder="Add a note..."
            placeholderTextColor="#999"
            maxLength={50}
          />
        </View>

        {/* Select Token */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Select Token to Send</Text>
          
           {selectedNetwork && (
   <>
     {loadingBalances || nativeLoading || loadingPrices ? (
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="small" color="#007AFF" />
         <Text style={styles.loadingText}>Loading tokens...</Text>
       </View>
     ) : (
       <View style={styles.tokenGrid}>
         {tokenBalances.map((token) => (
           <TouchableOpacity
             key={token.symbol}
             style={[
               styles.tokenCard,
               selectedToken === token.symbol && styles.selectedTokenCard,
               hasInsufficientBalance(token) && amountInput !== '' && styles.insufficientBalanceCard,
             ]}
             onPress={() => handleTokenSelect(token.symbol)}
             disabled={hasInsufficientBalance(token) && amountInput !== ''}
           >
             <Image source={getTokenIcon(token, selectedNetwork)} style={styles.tokenIcon} />
             <Text style={[
               styles.tokenSymbol,
               selectedToken === token.symbol && styles.selectedTokenText,
               hasInsufficientBalance(token) && amountInput !== '' && styles.insufficientBalanceText,
             ]}>
               {token.symbol}
             </Text>
             <Text style={[
               styles.tokenBalance,
               selectedToken === token.symbol && styles.selectedTokenText,
               hasInsufficientBalance(token) && amountInput !== '' && styles.insufficientBalanceText,
             ]}>
               {token.balance}
             </Text>
             {token.usdValue && (
               <Text style={styles.tokenUsdValue}>${token.usdValue}</Text>
             )}
             
             {amountInput && token.usdPrice && (
               <Text style={[
                 styles.needAmount,
                 hasInsufficientBalance(token) ? styles.insufficientText : styles.validNeedAmount,
               ]}>
                 Need: {calculateSendAmount(token)} {token.symbol}
               </Text>
             )}
             
             {hasInsufficientBalance(token) && amountInput !== '' && (
               <Text style={styles.insufficientText}>Insufficient</Text>
             )}
           </TouchableOpacity>
         ))}
       </View>
     )}
   </>
 )}
</View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.sendButton, 
            ((!selectedNetwork || !destinationNetwork || !selectedToken || !receivedToken || !recipientAddress || !amountInput) || sendingTransaction) && styles.disabledButton
          ]} 
          onPress={handleConfirmPayment}
          disabled={!selectedNetwork || !destinationNetwork || !selectedToken || !receivedToken || !recipientAddress || !amountInput || sendingTransaction}
        >
          <Text style={styles.buttonText}>
            {sendingTransaction ? 'SENDING...' : 'SEND PAYMENT'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Network Selection Modals */}
      <Modal visible={showNetworkModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Source Network</Text>
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
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowNetworkModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDestinationModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Destination Network</Text>
            <ScrollView style={styles.modalList}>
              {SUPPORTED_NETWORKS.map((network) => (
                <TouchableOpacity
                  key={network.chainId}
                  style={styles.modalItem}
                  onPress={() => handleDestinationSelect(network.name)}
                >
                  <View style={styles.modalItemContainer}>
                    <Image source={getNetworkIcon(network.name)} style={styles.networkIcon} />
                    <Text style={styles.modalItemText}>{network.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowDestinationModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showReceivedTokenModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Token Recipient Will Receive</Text>
            <ScrollView style={styles.modalList}>
              {destinationTokens.map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={styles.modalItem}
                  onPress={() => handleReceivedTokenSelect(token.symbol)}
                >
                  <View style={styles.modalItemContainer}>
                    <Image source={getTokenIcon(token, destinationNetwork)} style={styles.networkIcon} />
                    <Text style={styles.modalItemText}>{token.symbol} - {token.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowReceivedTokenModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowConfirmationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            {/* Warning Icon */}
            <View style={styles.warningIcon}>
              <Text style={styles.warningSymbol}>⚠️</Text>
            </View>
            
            {/* Title */}
            <Text style={styles.confirmationTitle}>CONFIRM SMART SWAP</Text>
            
            {/* Swap Route */}
            {confirmationData?.isCrossChain ? (
              <View style={styles.crossChainRoute}>
                <View style={styles.networkContainer}>
                  <Image source={getNetworkIcon(selectedNetwork)} style={styles.routeNetworkIcon} />
                  <Text style={styles.routeNetworkText}>{selectedNetwork}</Text>
                </View>
                <Text style={styles.routeArrow}>→</Text>
                <View style={styles.networkContainer}>
                  <Image source={getNetworkIcon(destinationNetwork)} style={styles.routeNetworkIcon} />
                  <Text style={styles.routeNetworkText}>{destinationNetwork}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.singleNetworkRoute}>
                <Image source={getNetworkIcon(selectedNetwork)} style={styles.routeNetworkIcon} />
                <Text style={styles.routeText}>{selectedNetwork} Network</Text>
              </View>
            )}
            
            {/* Swap Details */}
            <View style={styles.confirmationDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>You Send:</Text>
                <Text style={styles.detailValue}>{confirmationData?.sendAmount} {selectedToken}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>USD Value:</Text>
                <Text style={styles.detailValue}>${confirmationData?.usdValue}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recipient Gets:</Text>
                <Text style={styles.detailValue}>{receivedToken}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>To Address:</Text>
                <Text style={styles.detailValue}>
                  {recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}
                </Text>
              </View>
              
              <View style={styles.swapTypeContainer}>
                <Text style={styles.swapTypeText}>
                  {confirmationData?.isCrossChain ? '🔄 Multi-step swap process will handle conversion' : '💸 Direct transfer'}
                </Text>
              </View>
              
              <Text style={styles.deliveryText}>
                {confirmationData?.isCrossChain ? '⏱️ Delivery: 10-20 minutes' : '✅ Delivered immediately'}
              </Text>
            </View>
            
            {/* Buttons */}
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.cancelConfirmButton}
                onPress={() => setShowConfirmationModal(false)}
              >
                <Text style={styles.cancelConfirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.sendPaymentButton}
                onPress={() => {
                  if (confirmationData) {
                    executePayment(
                      confirmationData.sendAmount,
                      confirmationData.usdValue,
                      confirmationData.isCrossChain
                    );
                  }
                }}
              >
                <Text style={styles.sendPaymentButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSuccessModal(false);
          // Reset form
          setRecipientAddress('');
          setAmountInput('');
          setMemo('');
          setSelectedToken('');
          setReceivedToken('');
          setDestinationNetwork('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            {/* Success Icon */}
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            
            {/* Title */}
            <Text style={styles.successTitle}>SMART SWAP COMPLETE!</Text>
            
            {/* Swap Details */}
            <View style={styles.successDetails}>
              <Text style={styles.successAmount}>
                {successData?.sendAmount} {selectedToken}
              </Text>
              <Text style={styles.successValue}>
                ${successData?.usdValue} USD
              </Text>
              
              {successData?.isCrossChain ? (
                <View style={styles.crossChainRoute}>
                  <View style={styles.networkContainer}>
                    <Image source={getNetworkIcon(selectedNetwork)} style={styles.routeNetworkIcon} />
                    <Text style={styles.routeNetworkText}>{selectedNetwork}</Text>
                  </View>
                  <Text style={styles.routeArrow}>→</Text>
                  <View style={styles.networkContainer}>
                    <Image source={getNetworkIcon(destinationNetwork)} style={styles.routeNetworkIcon} />
                    <Text style={styles.routeNetworkText}>{destinationNetwork}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.singleNetworkRoute}>
                  <Image source={getNetworkIcon(selectedNetwork)} style={styles.routeNetworkIcon} />
                  <Text style={styles.routeText}>{selectedNetwork} Network</Text>
                </View>
              )}
              
              <Text style={styles.recipientInfo}>
                Recipient will receive: {receivedToken}
              </Text>
              
              <Text style={styles.deliveryText}>
                {successData?.isCrossChain ? '⏱️ Delivery: 10-20 minutes' : '✅ Delivered immediately'}
              </Text>
              
              {/* Transaction Hash */}
              <View style={styles.hashContainer}>
                <Text style={styles.hashLabel}>Transaction Hash</Text>
                <Text style={styles.hashValue}>
                  {successData?.transactionHash.slice(0, 8)}...{successData?.transactionHash.slice(-8)}
                </Text>
              </View>
            </View>
            
            {/* Buttons */}
            <View style={styles.successButtons}>
              {successData?.isCrossChain && successData?.ccipUrl && (
                <TouchableOpacity 
                  style={styles.trackButton}
                  onPress={() => Linking.openURL(successData.ccipUrl!)}
                >
                  <Text style={styles.trackButtonText}>Track on CCIP</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.explorerButton}
                onPress={() => successData?.explorerUrl && Linking.openURL(successData.explorerUrl)}
              >
                <Text style={styles.explorerButtonText}>View on Explorer</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.continueButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Reset form
                  setRecipientAddress('');
                  setAmountInput('');
                  setMemo('');
                  setSelectedToken('');
                  setReceivedToken('');
                  setDestinationNetwork('');
                }}
              >
                <Text style={styles.continueButtonText}>DONE</Text>
              </TouchableOpacity>
            </View>
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
    marginTop: 60,
    marginBottom: 20,
  },
  recipientBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  boxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 15,
    textAlign: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipientLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    width: 80,
  },
  recipientAddressContainer: {
    flex: 1,
  },
  recipientAddressInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#333',
  },
  recipientSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  recipientSelectorText: {
    fontSize: 14,
    color: '#333',
  },
  disabledText: {
    color: '#999',
  },
  arrow: {
    fontSize: 14,
    color: '#6c757d',
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
  amountTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 5,
    marginBottom: 10,
  },
  amountTypeButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectedAmountType: {
    backgroundColor: '#007AFF',
  },
  amountTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedAmountTypeText: {
    color: '#fff',
  },
  selectorButton: {
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
  selectorText: {
    fontSize: 16,
    color: '#333',
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
  tokenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tokenCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    minHeight: 120,
  },
  selectedTokenCard: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  insufficientBalanceCard: {
    borderColor: '#ffcccc',
    backgroundColor: '#fff5f5',
    opacity: 0.6,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tokenBalance: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  tokenUsdValue: {
    fontSize: 12,
    color: '#999',
  },
  selectedTokenText: {
    color: '#007AFF',
  },
  insufficientBalanceText: {
    color: '#999',
  },
  insufficientText: {
    fontSize: 10,
    color: '#ff4444',
    marginTop: 4,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '85%',
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
  networkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  modalCloseText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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
  },
  selectorWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recipientNetworkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
  },
  needAmount: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  validNeedAmount: {
    color: '#007AFF',
  },

  // Confirmation Modal Styles
  confirmationModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFA500',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  warningSymbol: {
    fontSize: 35,
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    letterSpacing: 1,
  },
  crossChainRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  singleNetworkRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
  },
  networkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  routeNetworkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  routeNetworkText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  routeText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  routeArrow: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  confirmationDetails: {
    width: '100%',
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 20,
  },
  swapTypeContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  swapTypeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  deliveryText: {
    fontSize: 14,
    color: '#28a745',
    marginBottom: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  confirmationButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 15,
  },
  cancelConfirmButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  sendPaymentButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendPaymentButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },

  // Success Modal Styles
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    letterSpacing: 1,
  },
  successDetails: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  successValue: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: '600',
    marginBottom: 15,
  },
  recipientInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  hashContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 15,
  },
  hashLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  hashValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    fontWeight: '500',
  },
  successButtons: {
    width: '100%',
  },
  trackButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  explorerButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  explorerButtonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});