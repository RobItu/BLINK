// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/utils/SafeERC20.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
*@dev Interface for uniswap router contract. Testnet liquidity is usually really bad for TOKEN/USDC on testnet, so slippage is heavy.
*NOTE: Should not be a problem in mainnet
*
**/
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256);
}

contract BLINKPayment is CCIPReceiver {
    using SafeERC20 for IERC20;

    error NotEnoughBalance(uint256 current, uint256 required);
    error InvalidAmount();

    address public owner;
    IRouterClient private immutable ccipRouter;
    IERC20 private immutable linkToken;
    IERC20 private immutable usdcToken;
    ISwapRouter public immutable dexRouter;
    
    // Config
    address public immutable USDC_ADDRESS;
    address public immutable NATIVE_WRAPPER; // WETH/WAVAX/etc
    address public immutable ETH_USD_FEED;
    
    // Mockswap toggle - set to true to force mock swaps
    bool public forceMockSwap = true; 
    
    /**
 * @dev Payment parameters for cross-chain token transfers. This is what the BLINK app sends! 
 * @param tokenIn Address of input token (address(0) for native token)
 * @param amountIn Amount of input token to send (in token's native decimals)
 * @param tokenOut Address of desired output token on destination chain
 * @param receiver Address to receive tokens on destination chain
 * @param destinationChain CCIP chain selector for target blockchain
 * @param minAmountOut Minimum acceptable output amount (slippage protection)
 */
    struct PaymentParams {
        address tokenIn;
        uint256 amountIn;
        address tokenOut;
        address receiver;
        uint64 destinationChain;
        uint256 minAmountOut;
    }

    event PaymentProcessed(bytes32 messageId, address sender, uint64 destinationChain);
    event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, string swapType);

    constructor(
        address _ccipRouter,
        address _linkToken,
        address _usdcToken,
        address _dexRouter,
        address _nativeWrapper,
        address _nativeUsdPriceFeed
    ) CCIPReceiver(_ccipRouter) {
        owner = msg.sender;
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = IERC20(_linkToken);
        usdcToken = IERC20(_usdcToken);
        dexRouter = ISwapRouter(_dexRouter);
        USDC_ADDRESS = _usdcToken;
        NATIVE_WRAPPER = _nativeWrapper;
        ETH_USD_FEED = _nativeUsdPriceFeed;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
    *@dev Main function BLINK app will call. Responsible for swapping tokens to USDC and sending it to CCIP to destination determined by user
    *@param params - struct with needed information of tokens transferred and data to build CCIP message
    *Note: Native-currency/USDC pair has terrible liquidity in testnets, so I created a mock swap using CL Feeds, however liquidity should not 
    *NOTE: be a problem in mainnet. Correct route address must be used in constructor when deploying contract. Dex for sepolia/ethereum should be Uniswap
    **/
    function processPayment(PaymentParams calldata params) external payable returns (bytes32 messageId) {
        if (params.amountIn == 0) revert InvalidAmount();
        
        // Transfer input token to contract
        if (params.tokenIn == address(0)) {
            require(msg.value >= params.amountIn, "Insufficient native token");
        } else {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        // Convert to USDC if needed
        uint256 usdcAmount;
        if (params.tokenIn == USDC_ADDRESS) {
            // No conversion needed
            usdcAmount = params.amountIn;
        } else if (forceMockSwap) {
            // Force mock swap path (bypasses dexRoute swap logic)
            usdcAmount = _performMockSwap(params.tokenIn, params.amountIn);
            emit SwapExecuted(params.tokenIn, USDC_ADDRESS, params.amountIn, usdcAmount, "MockSwap");
        } else {
            // Swap using dexRoute like Uniswap or other
            usdcAmount = _convertToUSDC(params.tokenIn, params.amountIn);
        }

        // Send via CCIP
        messageId = _sendCCIP(params.destinationChain, usdcAmount, params.tokenOut, params.receiver, params.minAmountOut);
        
        emit PaymentProcessed(messageId, msg.sender, params.destinationChain);
    }

    function _convertToUSDC(address tokenIn, uint256 amountIn) internal returns (uint256 usdcAmount) {
        // Check if we should force mock swap (for testing)
        if (forceMockSwap) {
            usdcAmount = _performMockSwap(tokenIn, amountIn);
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "MockSwap");
            return usdcAmount;
        } else {
            // Try real swap first, fallback to mock swap
        try this._attemptRealSwap(tokenIn, amountIn) returns (uint256 swapResult) {
            usdcAmount = swapResult;
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "RealSwap");
        } catch {
            usdcAmount = _performMockSwap(tokenIn, amountIn);
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "MockSwap");
        }
        }
    }
    
    function setForceMockSwap(bool _force) external onlyOwner {
        forceMockSwap = _force;
    }

   /**
    * @dev Attempts to swap tokens to USDC using the configured DEX router
    * @param tokenIn Input token address (address(0) for native tokens)
    * @param amountIn Amount of input tokens to swap
    * @return Amount of USDC received from the swap
    * 
    * @notice This function can only be called internally via try/catch pattern
    * @notice Uses 0.3% fee tier and 5-minute deadline for swaps
    * @notice For native tokens, automatically wraps to WETH/WAVAX format
    * @notice If no liquidity in pool will throw a gas error
    */
    function _attemptRealSwap(address tokenIn, uint256 amountIn) external returns (uint256) {
        require(msg.sender == address(this), "Only self-call allowed");
        
        uint256 balanceBefore = IERC20(USDC_ADDRESS).balanceOf(address(this));
        
        if (tokenIn == address(0)) {
            // Native token → USDC (works for ETH, AVAX, etc.)
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: NATIVE_WRAPPER,    
                tokenOut: USDC_ADDRESS,
                fee: 3000,                  
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            
            dexRouter.exactInputSingle{value: amountIn}(params);
            
        } else {
            // ERC20 → USDC
            IERC20(tokenIn).safeApprove(address(dexRouter), amountIn);
            
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: USDC_ADDRESS,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            
            dexRouter.exactInputSingle(params);
        }
        
        uint256 balanceAfter = IERC20(USDC_ADDRESS).balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

       /**
    * @dev Uses CL feeds to mock a swap. Contract must have USDC! 
    */

    function _performMockSwap(address tokenIn, uint256 amountIn) internal returns (uint256 usdcAmount) {
        if (tokenIn == address(0) || tokenIn == NATIVE_WRAPPER) {
            // Use price feed for native token conversion
            usdcAmount = _getNativeToUSDCAmount(amountIn);
        } else {
            // For other tokens, use 1:1 ratio as fallback (can be enhanced)
            usdcAmount = amountIn; // Assumes token has similar decimals to USDC
        }
        
        // Ensure contract has enough USDC for mock swap
        uint256 contractUSDCBalance = IERC20(USDC_ADDRESS).balanceOf(address(this));
        require(contractUSDCBalance >= usdcAmount, "Insufficient USDC in contract");
    }

    function _getNativeToUSDCAmount(uint256 nativeAmount) internal view returns (uint256) {
        if (ETH_USD_FEED == address(0)) {
            // No price feed configured, use fallback rate (e.g., $2000 per token)
            return (nativeAmount * 2000) / 1e12; 
        }

        try AggregatorV3Interface(ETH_USD_FEED).latestRoundData() returns (
            uint80, int256 price, uint256, uint256 updatedAt, uint80
        ) {
            if (price <= 0 || updatedAt == 0) {
                return (nativeAmount * 2000) / 1e12;
            }
            
            return (nativeAmount * uint256(price)) / 1e20; 
        } catch {
            // Fallback rate
            return (nativeAmount * 2000) / 1e12;
        }
    }

    function _sendCCIP(uint64 destinationChain, uint256 usdcAmount, address tokenOut, address receiver, uint256 minOut) 
        internal returns (bytes32) {
        
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: USDC_ADDRESS, amount: usdcAmount});

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(tokenOut, receiver, minOut),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 500_000})),
            feeToken: address(linkToken)
        });

        uint256 fee = ccipRouter.getFee(destinationChain, message);
        if (fee > linkToken.balanceOf(address(this))) 
            revert NotEnoughBalance(linkToken.balanceOf(address(this)), fee);
        
        linkToken.approve(address(ccipRouter), fee);
        usdcToken.approve(address(ccipRouter), usdcAmount);
        
        return ccipRouter.ccipSend(destinationChain, message);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        (address tokenOut, address receiver, uint256 minOut) = abi.decode(message.data, (address, address, uint256));
        uint256 usdcAmount = message.destTokenAmounts[0].amount;

        if (tokenOut == USDC_ADDRESS) {
            usdcToken.safeTransfer(receiver, usdcAmount);
        } else {
            usdcToken.safeTransfer(receiver, usdcAmount);
        }
    }

    // Owner functions
    function fundMockSwap(uint256 usdcAmount) external onlyOwner {
        IERC20(USDC_ADDRESS).transferFrom(msg.sender, address(this), usdcAmount);
    }

     function withdrawAll() external onlyOwner {
        // Withdraw LINK
        uint256 linkBalance = linkToken.balanceOf(address(this));
        if (linkBalance > 0) {
            linkToken.transfer(owner, linkBalance);
        }
        
        // Withdraw USDC  
        uint256 usdcBalance = IERC20(USDC_ADDRESS).balanceOf(address(this));
        if (usdcBalance > 0) {
            IERC20(USDC_ADDRESS).transfer(owner, usdcBalance);
        }
        
        // Withdraw native tokens (ETH/AVAX)
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            payable(owner).transfer(nativeBalance);
        }
    }

    //=================================== DEBUG FUNCTIONS ================================================= //

    function debugMockSwap(address tokenIn, uint256 amountIn) external view returns (
        uint256 calculatedUSDC,
        uint256 contractUSDCBalance,
        uint256 ethPrice,
        bool hasEnoughUSDC
    ) {
        if (tokenIn == address(0) || tokenIn == NATIVE_WRAPPER) {
            calculatedUSDC = _getNativeToUSDCAmount(amountIn);
            ethPrice = _getNativeToUSDCAmount(1e18); // Price for 1 ETH
        } else {
            calculatedUSDC = amountIn;
            ethPrice = 0;
        }
        
        contractUSDCBalance = IERC20(USDC_ADDRESS).balanceOf(address(this));
        hasEnoughUSDC = contractUSDCBalance >= calculatedUSDC;
    }


    function getEstimatedFee(uint64 destinationChain, uint256 usdcAmount) external view returns (uint256) {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: USDC_ADDRESS, amount: usdcAmount});
        
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(address(this)),
            data: abi.encode(address(0), address(0), 0),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 500_000})),
            feeToken: address(linkToken)
        });
        
        return ccipRouter.getFee(destinationChain, message);
    }

    // Debug functions to check balances and calculations
    function debugBalances() external view returns (uint256 linkBalance, uint256 usdcBalance, uint256 ethBalance) {
        linkBalance = linkToken.balanceOf(address(this));
        usdcBalance = IERC20(USDC_ADDRESS).balanceOf(address(this));
        ethBalance = address(this).balance;
    }
    
    function debugConvertETHToUSDC(uint256 ethAmount) external view returns (uint256 usdcAmount, uint256 ethPrice) {
        ethPrice = _getNativeToUSDCAmount(1e18); // Price for 1 ETH
        usdcAmount = _getNativeToUSDCAmount(ethAmount);
    }
    

    receive() external payable {}
}