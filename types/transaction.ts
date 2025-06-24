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
  id: string;
  for: string;
  amount: string;
  currency: CurrencyType;
  sellerWalletAddress: string;
  timestamp: number;
  memo?: string;
  network?: string;
  merchantId?: string;
  isCirclePayment?: boolean; // Add this line
}
// Predefined network configurations
export const SUPPORTED_NETWORKS: AcceptedNetwork[] = [
  {
    name: 'Sepolia',
    chainId: 11155111,
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'sepolia',
      decimals: 18,
      coinGeckoId: 'ethereum'
    },
    tokens: [{
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        network: 'sepolia',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        contractAddress: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        network: 'sepolia',
        decimals: 18,
        coinGeckoId: 'ethereum'
      }]
      
  },
  {
    name: 'Avalanche Fuji',
    chainId: 43113,
    nativeCurrency: {
      symbol: 'AVAX',
      name: 'Avalanche',
      network: 'avalanche-fuji',
      decimals: 18,
      coinGeckoId: 'avalanche-2'
    },
    tokens: [{
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
        network: 'avalanche-fuji',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      },
      {
        symbol: 'LTX',
        name: 'Coinbase Wrapped BTC',
        contractAddress: '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
        network: 'avalanche-fuji',
        decimals: 8,
        coinGeckoId: 'bitcoin'
      }]
  },
  {
    name: 'Base Sepolia',
    chainId: 84532,
    nativeCurrency: {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'base-sepolia',
      decimals: 18,
      coinGeckoId: 'ethereum'
    },
    tokens: [ {
        symbol: 'USDC',
        name: 'USD Coin',
        contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: 'base-sepolia',
        decimals: 6,
        coinGeckoId: 'usd-coin'
      },
      {
        symbol: 'cbBTC',
        name: 'Coinbase Wrapped BTC',
        contractAddress: '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
        network: 'base-sepolia',
        decimals: 8,
        coinGeckoId: 'bitcoin'
      },
     {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        contractAddress: '0x4200000000000000000000000000000000000006',
        network: 'base-sepolia',
        decimals: 18,
        coinGeckoId: 'ethereum'
      }]
  },
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
  memo?: string
): TransactionData => {
  return {
    for: itemName,
    amount,
    currency,
    timestamp: Date.now(),
    id: `txn_${Date.now()}`,
    sellerWalletAddress,
    memo: memo || '',
  };

  
};