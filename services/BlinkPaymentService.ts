
import { getContract, prepareTransaction, prepareContractCall } from "thirdweb";
import { toWei } from "thirdweb/utils";
import { transfer, approve } from "thirdweb/extensions/erc20";

// Add the BLINK contract ABI
const BLINK_CONTRACT_ABI = [
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "bytes32",
						"name": "messageId",
						"type": "bytes32"
					},
					{
						"internalType": "uint64",
						"name": "sourceChainSelector",
						"type": "uint64"
					},
					{
						"internalType": "bytes",
						"name": "sender",
						"type": "bytes"
					},
					{
						"internalType": "bytes",
						"name": "data",
						"type": "bytes"
					},
					{
						"components": [
							{
								"internalType": "address",
								"name": "token",
								"type": "address"
							},
							{
								"internalType": "uint256",
								"name": "amount",
								"type": "uint256"
							}
						],
						"internalType": "struct Client.EVMTokenAmount[]",
						"name": "destTokenAmounts",
						"type": "tuple[]"
					}
				],
				"internalType": "struct Client.Any2EVMMessage",
				"name": "message",
				"type": "tuple"
			}
		],
		"name": "ccipReceive",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_ccipRouter",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_linkToken",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_usdcToken",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_uniswapRouter",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_traderJoeRouter",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "InvalidAmount",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "router",
				"type": "address"
			}
		],
		"name": "InvalidRouter",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "current",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "required",
				"type": "uint256"
			}
		],
		"name": "NotEnoughBalance",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "messageId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint64",
				"name": "destinationChain",
				"type": "uint64"
			}
		],
		"name": "PaymentProcessed",
		"type": "event"
	},
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
				"internalType": "struct BLINKPayment.PaymentParams",
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
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "withdrawToken",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [
			{
				"internalType": "uint64",
				"name": "destinationChain",
				"type": "uint64"
			},
			{
				"internalType": "uint256",
				"name": "usdcAmount",
				"type": "uint256"
			}
		],
		"name": "getEstimatedFee",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getRouter",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "IS_AVALANCHE",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "traderJoeRouter",
		"outputs": [
			{
				"internalType": "contract ITraderJoeRouter",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "uniswapRouter",
		"outputs": [
			{
				"internalType": "contract ISwapRouter",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "USDC_ADDRESS",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "WAVAX_ADDRESS",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
] as const;

// BLINK Contract Configuration
const BLINK_CONTRACT_ADDRESSES: Record<string, string> = {
  'Avalanche Fuji': '0x02379E7bfD2DAe5162Ef5f18eA750E6acc1cff61',
  'Sepolia': '0xE220b9356fc15395dAf0037761bc8078dB39842b',
};

const CHAIN_SELECTORS: Record<string, string> = {
  'Sepolia': '16015286601757825753',
  'Avalanche Fuji': '14767482510784806043',
};

const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  'Sepolia': {
    'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'ETH': '0x0000000000000000000000000000000000000000',
  },
  'Avalanche Fuji': {
    'USDC': '0x5425890298aed601595a70AB815c96711a31Bc65',
    'AVAX': '0x0000000000000000000000000000000000000000',
	'GUN': '0x26deBD39D5eD069770406FCa10A0E4f8d2c743eB',
  },
  'Base Sepolia': {
	'USDC': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
	'ETH': '0x0000000000000000000000000000000000000000',
	'cbBTC': '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
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
  sendTransaction: (tx: any, callbacks: any) => void;
}

export class BlinkPaymentService {
  static isCrossChainAvailable(sourceNetwork: string, destinationNetwork: string): boolean {
    const sourceContract = BLINK_CONTRACT_ADDRESSES[sourceNetwork];
    const destinationSelector = CHAIN_SELECTORS[destinationNetwork];
    return !!(sourceContract && destinationSelector && sourceNetwork !== destinationNetwork);
  }

  static async executePayment(params: PaymentParams): Promise<void> {
    const {
      client,
      sourceNetwork,
      destinationNetwork,
      selectedChain,
      userAddress,
      sellerAddress,
      tokenBalance,
      requiredAmount,
      sendTransaction,
    } = params;

    if (this.isCrossChainAvailable(sourceNetwork, destinationNetwork)) {
      await this.executeBLINKPayment(params);
    } else {
      await this.executeDirectPayment(params);
    }
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
      sendTransaction,
    } = params;

    const contractAddress = BLINK_CONTRACT_ADDRESSES[sourceNetwork];
    const destinationChainSelector = CHAIN_SELECTORS[destinationNetwork];
    const destinationTokenAddress = TOKEN_ADDRESSES[destinationNetwork]?.['USDC'] || '0x0000000000000000000000000000000000000000';

    const blinkContract = getContract({
      client,
      chain: selectedChain,
      address: contractAddress,
      abi: BLINK_CONTRACT_ABI, // Add the ABI here
    });

    const paymentParams = {
      tokenIn: tokenBalance.contractAddress || "0x0000000000000000000000000000000000000000",
      amountIn: toWei(requiredAmount),
      tokenOut: destinationTokenAddress,
      receiver: sellerAddress,
      destinationChain: BigInt(destinationChainSelector),
      minAmountOut: BigInt(0),
    };

    // 🐛 DEBUG: Log what we're sending to the contract
    console.log('🚀 BLINK Payment Debug:');
    console.log('Contract address:', contractAddress);
    console.log('Required amount (original):', requiredAmount);
    console.log('Payment params being sent:', {
      tokenIn: paymentParams.tokenIn,
      amountIn: paymentParams.amountIn.toString(),
      tokenOut: paymentParams.tokenOut,
      receiver: paymentParams.receiver,
      destinationChain: paymentParams.destinationChain.toString(),
      minAmountOut: paymentParams.minAmountOut.toString(),
    });
    console.log('Token balance info:', tokenBalance);

    // 🐛 DEBUG: Log what we're sending to the contract
    console.log('🚀 BLINK Payment Debug:');
    console.log('Contract address:', contractAddress);
    console.log('Required amount (original):', requiredAmount);
    console.log('Payment params being sent:', {
      tokenIn: paymentParams.tokenIn,
      amountIn: paymentParams.amountIn.toString(),
      tokenOut: paymentParams.tokenOut,
      receiver: paymentParams.receiver,
      destinationChain: paymentParams.destinationChain.toString(),
      minAmountOut: paymentParams.minAmountOut.toString(),
    });
    console.log('Token balance info:', tokenBalance);

    if (tokenBalance.contractAddress) {
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
      // Native token
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

    if (tokenBalance.contractAddress) {
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
}