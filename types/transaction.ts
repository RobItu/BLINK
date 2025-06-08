// types/transaction.ts

export type CurrencyType = 'USDC' | 'USD';

export interface AcceptedToken {
  symbol: string;
  name: string;
  contractAddress?: string; // For ERC20 tokens
  network: string;
  decimals: number;
  coinGeckoId: string; // For price fetching
}

export interface AcceptedNetwork {
  name: string;
  chainId: number;
  nativeCurrency: AcceptedToken;
  tokens: AcceptedToken[];
}

export interface TransactionData {
  // Basic transaction info
  for: string;
  amount: string;
  currency: CurrencyType;
  timestamp: number;
  id: string;
  
  // Seller info
  sellerWalletAddress: string;
  sellerName?: string;
  
  // Payment options
  acceptedNetworks: AcceptedNetwork[];
  
  // Optional metadata
  description?: string;
  expiresAt?: number; // Unix timestamp
  requiresConfirmation?: boolean;
}

// Predefined network configurations
export const SUPPORTED_NETWORKS: AcceptedNetwork[] = [
  {
    name: 'Ethereum',
    chainId: 1,
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'ethereum',
      decimals: 18,
      coinGeckoId: 'ethereum'
    },
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0xA0b86a33E6729C167C9DcF34b44d2c3c570AaA3E',
        network: 'ethereum',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        network: 'ethereum',
        decimals: 6,
        coinGeckoId: 'tether'
      }
    ]
  },
  {
    name: 'Polygon',
    chainId: 137,
    nativeCurrency: {
      symbol: 'MATIC',
      name: 'Polygon',
      network: 'polygon',
      decimals: 18,
      coinGeckoId: 'matic-network'
    },
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        network: 'polygon',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      }
    ]
  },
  {
    name: 'Avalanche',
    chainId: 43114,
    nativeCurrency: {
      symbol: 'AVAX',
      name: 'Avalanche',
      network: 'avalanche',
      decimals: 18,
      coinGeckoId: 'avalanche-2'
    },
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        network: 'avalanche',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      }
    ]
  },
  {
    name: 'Arbitrum',
    chainId: 42161,
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'arbitrum',
      decimals: 18,
      coinGeckoId: 'ethereum'
    },
    tokens: [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        network: 'arbitrum',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      }
    ]
  }
];

// Helper function to get default accepted networks for a transaction
export const getDefaultAcceptedNetworks = (): AcceptedNetwork[] => {
  return SUPPORTED_NETWORKS;
};

// Helper function to create a transaction
export const createTransaction = (
  itemName: string,
  amount: string,
  currency: CurrencyType,
  sellerWalletAddress: string,
  sellerName?: string
): TransactionData => {
  return {
    for: itemName,
    amount,
    currency,
    timestamp: Date.now(),
    id: `txn_${Date.now()}`,
    sellerWalletAddress,
    sellerName,
    acceptedNetworks: getDefaultAcceptedNetworks(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
    requiresConfirmation: true
  };
};