import { getContract, prepareTransaction, prepareContractCall } from "thirdweb";
import { toWei } from "thirdweb/utils";
import { transfer, approve } from "thirdweb/extensions/erc20";

// Updated BLINK contract ABI to match your current contract
const BLINK_CONTRACT_ABI = [
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "tokenIn",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "tokenOut",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "receiver",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "receiverContract",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "destinationChain",
            "type": "uint64"
          },
          {
            "internalType": "uint256",
            "name": "minAmountOut",
            "type": "uint256"
          }
        ],
        "internalType": "struct PaymentParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "processPayment",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "messageId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

// BLINK Contract Configuration
const BLINK_CONTRACT_ADDRESSES: Record<string, string> = {
//   'Avalanche Fuji': '0x02379E7bfD2DAe5162Ef5f18eA750E6acc1cff61',
'Avalanche Fuji': '0x03397e5c20d0D9C99E6622bCa9945e680b0C5dD6',
  'Sepolia': '0xA0Df20Ce1B5f84eeDBD83FF29276e9445D44bb1B',
  'Base Sepolia': '0xFD1A6ce265fB857993E9F24657A229f6c9B10833',
};

const CHAIN_SELECTORS: Record<string, string> = {
  'Sepolia': '16015286601757825753',
  'Avalanche Fuji': '14767482510784806043',
  'Base Sepolia': '10344971235874465080',
};

// Updated token addresses to include native token representations
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  'Sepolia': {
    'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'ETH': '0x0000000000000000000000000000000000000000',
    'WETH': '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', // Native WETH
  },
  'Avalanche Fuji': {
    'USDC': '0x5425890298aed601595a70AB815c96711a31Bc65',
    'AVAX': '0x0000000000000000000000000000000000000000', // Native AVAX
    'LTX': '0x26deBD39D5eD069770406FCa10A0E4f8d2c743eB',
  },
  'Base Sepolia': {
    'USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
    'cbBTC': '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
    'WETH': '0x4200000000000000000000000000000000000006',
  },
};

export interface PaymentParams {
  client: any;
  sourceNetwork: string;
  destinationNetwork: string;
  selectedChain: any;
  userAddress: string;
  sellerAddress: string;
  tokenBalance: {
    symbol: string;
    contractAddress?: string;
    balance: string;
  };
  requiredAmount: string;
  receivedTokenSymbol: string; // NEW: The token symbol user wants to receive
  sendTransaction: (tx: any, callbacks: any) => void;
}

export class BlinkPaymentService {
  static isCrossChainAvailable(sourceNetwork: string, destinationNetwork: string): boolean {
    const sourceContract = BLINK_CONTRACT_ADDRESSES[sourceNetwork];
    const destinationSelector = CHAIN_SELECTORS[destinationNetwork];
    return !!(sourceContract && destinationSelector && sourceNetwork !== destinationNetwork);
  }

   static isSwapNeeded(inputToken: string, outputToken: string, sourceNetwork: string, destinationNetwork: string): boolean {
    return sourceNetwork === destinationNetwork && inputToken !== outputToken;
  }

  static async executePayment(params: PaymentParams): Promise<void> {
    const {
      sourceNetwork,
      destinationNetwork,
      tokenBalance,
      receivedTokenSymbol,
    } = params;

    const isCrossChain = this.isCrossChainAvailable(sourceNetwork, destinationNetwork);
    const needsSwap = this.isSwapNeeded(tokenBalance.symbol, receivedTokenSymbol, sourceNetwork, destinationNetwork);
    
    // Use BLINK contract if it's cross-chain OR if we need to swap tokens
    if (isCrossChain || needsSwap) {
      await this.executeBLINKPayment(params);
    } else {
      await this.executeDirectPayment(params);
    }
  }
  
  private static parseTokenAmount(amount: string, tokenSymbol: string, network: string): bigint {
  // Get token decimals based on network and symbol
  const decimals = this.getTokenDecimals(network, tokenSymbol);
  const amountBigInt = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
  return amountBigInt;
}

private static getTokenDecimals(network: string, tokenSymbol: string): number {
  // Default decimals for common tokens
  const tokenDecimals: Record<string, Record<string, number>> = {
    'Base Sepolia': {
      'USDC': 6,
      'ETH': 18,
      'WETH': 18,
      'cbBTC': 8,
    },
    'Sepolia': {
      'USDC': 6,
      'ETH': 18,
    },
    'Avalanche Fuji': {
      'USDC': 6,
      'AVAX': 18,
    }
  };
  
  return tokenDecimals[network]?.[tokenSymbol] || 18; // Default to 18
}

  private static async executeBLINKPayment(params: PaymentParams): Promise<void> {
    const {
      client,
      sourceNetwork,
      destinationNetwork,
      selectedChain,
      sellerAddress,
      tokenBalance,
      requiredAmount,
      receivedTokenSymbol,
      sendTransaction,
    } = params;

    const contractAddress = BLINK_CONTRACT_ADDRESSES[sourceNetwork];
    const destinationChainSelector = CHAIN_SELECTORS[destinationNetwork];
    const receiverContractAddress = BLINK_CONTRACT_ADDRESSES[destinationNetwork];

    // Get the token addresses based on user selections
    const tokenInAddress = this.getTokenAddress(sourceNetwork, tokenBalance.symbol);
    const tokenOutAddress = this.getTokenAddress(destinationNetwork, receivedTokenSymbol);

    const blinkContract = getContract({
      client,
      chain: selectedChain,
      address: contractAddress,
      abi: BLINK_CONTRACT_ABI,
    });

    // Build the payment params struct matching your contract
    const paymentParams = {
      tokenIn: tokenInAddress,
      amountIn: this.parseTokenAmount(requiredAmount, tokenBalance.symbol, sourceNetwork),
      tokenOut: tokenOutAddress,
      receiver: sellerAddress,
      receiverContract: receiverContractAddress,
      destinationChain: BigInt(destinationChainSelector),
      minAmountOut: BigInt(0),
    };

	

    // 🐛 DEBUG: Log what we're sending to the contract
    console.log('🚀 BLINK Payment Debug:');
    console.log('Source network:', sourceNetwork);
    console.log('Destination network:', destinationNetwork);
    console.log('Source contract address:', contractAddress);
    console.log('Destination contract address:', receiverContractAddress);
    console.log('Required amount (original):', requiredAmount);
    console.log('Token being sent:', tokenBalance.symbol);
    console.log('Token to receive:', receivedTokenSymbol);
    console.log('Payment params being sent:', {
      tokenIn: paymentParams.tokenIn,
      amountIn: paymentParams.amountIn.toString(),
      tokenOut: paymentParams.tokenOut,
      receiver: paymentParams.receiver,
      receiverContract: paymentParams.receiverContract,
      destinationChain: paymentParams.destinationChain.toString(),
      minAmountOut: paymentParams.minAmountOut.toString(),
    });

    if (tokenBalance.contractAddress && tokenBalance.contractAddress !== '0x0000000000000000000000000000000000000000') {
      // ERC20 - Two step process
      return new Promise((resolve, reject) => {
        // Step 1: Approve
        const tokenContract = getContract({
          client,
          chain: selectedChain,
          address: tokenBalance.contractAddress!,
        });

        const approveTransaction = approve({
          contract: tokenContract,
          spender: contractAddress,
          amount: requiredAmount,
        });

        sendTransaction(approveTransaction, {
          onSuccess: async () => {
            // Step 2: Process payment
            const paymentTransaction = prepareContractCall({
              contract: blinkContract,
              method: "processPayment",
              params: [paymentParams],
            });

            sendTransaction(paymentTransaction, {
              onSuccess: resolve,
              onError: reject,
            });
          },
          onError: reject,
        });
      });
    } else {
      // Native token - include value in transaction
      const paymentTransaction = prepareContractCall({
        contract: blinkContract,
        method: "processPayment",
        params: [paymentParams],
        value: toWei(requiredAmount),
      });

      return new Promise((resolve, reject) => {
        sendTransaction(paymentTransaction, {
          onSuccess: resolve,
          onError: reject,
        });
      });
    }
  }

  private static async executeDirectPayment(params: PaymentParams): Promise<void> {
    const {
      client,
      selectedChain,
      sellerAddress,
      tokenBalance,
      requiredAmount,
      sendTransaction,
    } = params;

    if (tokenBalance.contractAddress && tokenBalance.contractAddress !== '0x0000000000000000000000000000000000000000') {
      // ERC20 Token Transfer
      const contract = getContract({
        client,
        chain: selectedChain,
        address: tokenBalance.contractAddress,
      });

      const transaction = transfer({
        contract,
        to: sellerAddress,
        amount: requiredAmount,
      });

      return new Promise((resolve, reject) => {
        sendTransaction(transaction, {
          onSuccess: resolve,
          onError: reject,
        });
      });
    } else {
      // Native Token Transfer
      const transaction = prepareTransaction({
        client,
        chain: selectedChain,
        to: sellerAddress,
        value: toWei(requiredAmount),
      });

      return new Promise((resolve, reject) => {
        sendTransaction(transaction, {
          onSuccess: resolve,
          onError: reject,
        });
      });
    }
  }

  // Helper method to get token address based on network and symbol
  private static getTokenAddress(network: string, tokenSymbol: string): string {
    const networkTokens = TOKEN_ADDRESSES[network];
    if (!networkTokens) {
      console.warn(`Network ${network} not found, defaulting to address(0)`);
      return '0x0000000000000000000000000000000000000000';
    }

    const tokenAddress = networkTokens[tokenSymbol];
    if (!tokenAddress) {
      console.warn(`Token ${tokenSymbol} not found on ${network}, defaulting to address(0)`);
      return '0x0000000000000000000000000000000000000000';
    }

    return tokenAddress;
  }
}