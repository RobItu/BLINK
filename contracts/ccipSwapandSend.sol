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
    ISwapRouter public immutable uniswapRouter;
    
    // Configuration - set per deployment
    address public immutable USDC_ADDRESS;
    address public immutable NATIVE_WRAPPER; // WETH/WAVAX/etc
    address public immutable ETH_USD_FEED;
    
    // Testing toggle - set to true to force mock swaps  
    bool public forceMockSwap = true; // Start with true by default
    
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
        address _uniswapRouter,
        address _nativeWrapper,
        address _ethUsdFeed
    ) CCIPReceiver(_ccipRouter) {
        owner = msg.sender;
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = IERC20(_linkToken);
        usdcToken = IERC20(_usdcToken);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        USDC_ADDRESS = _usdcToken;
        NATIVE_WRAPPER = _nativeWrapper;
        ETH_USD_FEED = _ethUsdFeed;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function processPayment(PaymentParams calldata params) external payable returns (bytes32 messageId) {
        if (params.amountIn == 0) revert InvalidAmount();
        
        // Transfer input token to contract
        if (params.tokenIn == address(0)) {
            require(msg.value >= params.amountIn, "Insufficient native token");
        } else {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        // Convert to USDC if needed - check forceMockSwap first
        uint256 usdcAmount;
        if (params.tokenIn == USDC_ADDRESS) {
            // No conversion needed
            usdcAmount = params.amountIn;
        } else if (forceMockSwap) {
            // Force mock swap path (bypasses all complex logic)
            usdcAmount = _performMockSwap(params.tokenIn, params.amountIn);
            emit SwapExecuted(params.tokenIn, USDC_ADDRESS, params.amountIn, usdcAmount, "MockSwap");
        } else {
            // Normal conversion logic
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
        }
        
        // Try real swap first, fallback to mock swap
        try this._attemptRealSwap(tokenIn, amountIn) returns (uint256 swapResult) {
            usdcAmount = swapResult;
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "RealSwap");
        } catch {
            usdcAmount = _performMockSwap(tokenIn, amountIn);
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "MockSwap");
        }
    }
    
    // Owner function to toggle mock swap for testing
    function setForceMockSwap(bool _force) external onlyOwner {
        forceMockSwap = _force;
    }

    function _attemptRealSwap(address tokenIn, uint256 amountIn) external returns (uint256) {
        require(msg.sender == address(this), "Only self-call allowed");
        
        uint256 balanceBefore = IERC20(USDC_ADDRESS).balanceOf(address(this));
        
        if (tokenIn == address(0)) {
            // Native token → USDC (works for ETH, AVAX, etc.)
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: NATIVE_WRAPPER,    // WETH/WAVAX
                tokenOut: USDC_ADDRESS,
                fee: 3000,                  // 0.3%
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            
            uniswapRouter.exactInputSingle{value: amountIn}(params);
            
        } else {
            // ERC20 → USDC
            IERC20(tokenIn).safeApprove(address(uniswapRouter), amountIn);
            
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
            
            uniswapRouter.exactInputSingle(params);
        }
        
        uint256 balanceAfter = IERC20(USDC_ADDRESS).balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

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
            return (nativeAmount * 2000) / 1e12; // Assumes native token worth $2000, convert to 6 decimals
        }
        
        try AggregatorV3Interface(ETH_USD_FEED).latestRoundData() returns (
            uint80, int256 price, uint256, uint256 updatedAt, uint80
        ) {
            if (price <= 0 || updatedAt == 0) {
                // Fallback rate
                return (nativeAmount * 2000) / 1e12;
            }
            
            // Convert: nativeAmount * price (8 decimals) / 1e12 = USDC (6 decimals)
            return (nativeAmount * uint256(price)) / 1e20; // 1e18 + 1e8 - 1e6 = 1e20
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
            // For simplicity, just send USDC (can be enhanced to swap back)
            usdcToken.safeTransfer(receiver, usdcAmount);
        }
    }

    // Owner functions
    function fundMockSwap(uint256 usdcAmount) external onlyOwner {
        IERC20(USDC_ADDRESS).transferFrom(msg.sender, address(this), usdcAmount);
    }


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