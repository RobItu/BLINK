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
    error SwapFailed();

    address public owner;
    IRouterClient private immutable ccipRouter;
    IERC20 private immutable linkToken;
    IERC20 private immutable usdcToken;
    ISwapRouter public immutable swapRouter;
    AggregatorV3Interface private immutable priceFeed;
    
    // Config
    address public immutable USDC_ADDRESS;
    address public immutable NATIVE_WRAPPER;
    
    // Swap settings
    bool public useRealSwaps = false;
    uint24 public constant POOL_FEE = 3000; // 0.3% - most liquid fee tier

     struct PaymentParams {
        address tokenIn;
        uint256 amountIn;
        address tokenOut;
        address receiver;
        address receiverContract;
        uint64 destinationChain;
        uint256 minAmountOut;
    }

    event PaymentProcessed(bytes32 messageId, address sender, uint64 destinationChain);
    event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, string swapType, uint24 fee);

    constructor(
        address _ccipRouter,
        address _linkToken,
        address _usdcToken,
        address _swapRouter,
        address _nativeWrapper,
        address _priceFeed
    ) CCIPReceiver(_ccipRouter) {
        owner = msg.sender;
        ccipRouter = IRouterClient(_ccipRouter);
        linkToken = IERC20(_linkToken);
        usdcToken = IERC20(_usdcToken);
        swapRouter = ISwapRouter(_swapRouter);
        priceFeed = AggregatorV3Interface(_priceFeed);
        USDC_ADDRESS = _usdcToken;
        NATIVE_WRAPPER = _nativeWrapper;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice Main payment processing function
     * @param params Payment parameters including tokens, amounts, and destination
     */
    function processPayment(PaymentParams calldata params) external payable returns (bytes32 messageId) {
        if (params.amountIn == 0) revert InvalidAmount();
        
        // Transfer input token to contract
        if (params.tokenIn == address(0)) {
            require(msg.value >= params.amountIn, "Insufficient native token");
        } else {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }

        // Convert to USDC if needed
        uint256 usdcAmount = _convertToUSDC(params.tokenIn, params.amountIn);

        // Send via CCIP
        messageId = _sendCCIP(params.destinationChain, usdcAmount, params.tokenOut, params.receiver, params.minAmountOut, params.receiverContract);
        
        emit PaymentProcessed(messageId, msg.sender, params.destinationChain);
    }

    /**
     * @notice Convert any token to USDC using real swaps or price feeds
     */
    function _convertToUSDC(address tokenIn, uint256 amountIn) internal returns (uint256 usdcAmount) {
        if (tokenIn == USDC_ADDRESS) {
            return amountIn; // No conversion needed
        }

        if (useRealSwaps) {
            // Try real swap with multiple fee tiers
            usdcAmount = _attemptRealSwapToUSDC(tokenIn, amountIn);
            if (usdcAmount > 0) {
                return usdcAmount;
            }
        }

        // Fallback to price feed conversion
        return _mockSwapToUSDC(tokenIn, amountIn);
    }

    /**
     * @notice Attempt real swap with 0.3% fee tier
     */
    function _attemptRealSwapToUSDC(address tokenIn, uint256 amountIn) internal returns (uint256) {
        try this._executeSwapToUSDC(tokenIn, amountIn, 3000) returns (uint256 result) {
            emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, result, "RealSwap", 3000);
            return result;
        } catch {
            return 0; // Swap failed
        }
    }

    /**
     * @notice Execute single swap attempt (external for try/catch)
     */
    function _executeSwapToUSDC(address tokenIn, uint256 amountIn, uint24 fee) external returns (uint256) {
        require(msg.sender == address(this), "Only self call");
        
        uint256 balanceBefore = usdcToken.balanceOf(address(this));
        
        if (tokenIn == address(0)) {
            // Native token swap
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: NATIVE_WRAPPER,
                tokenOut: USDC_ADDRESS,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            
            swapRouter.exactInputSingle{value: amountIn}(params);
        } else {
            // ERC20 token swap
            IERC20(tokenIn).safeApprove(address(swapRouter), amountIn);
            
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: USDC_ADDRESS,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            
            swapRouter.exactInputSingle(params);
        }
        
        uint256 balanceAfter = usdcToken.balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

    /**
     * @notice Convert USDC to target token on destination chain
     */
    function _convertFromUSDC(address tokenOut, uint256 usdcAmount, uint256 minOut) internal returns (uint256) {
        if (tokenOut == USDC_ADDRESS) {
            return usdcAmount; // No conversion needed
        }

        if (useRealSwaps) {
            // Try real swap with multiple fee tiers
            uint256 result = _attemptRealSwapFromUSDC(tokenOut, usdcAmount, minOut);
            if (result > 0) {
                return result;
            }
        }

        // Fallback to price feed conversion
        return _mockSwapFromUSDC(tokenOut, usdcAmount);
    }

    /**
     * @notice Attempt real swap from USDC with 0.3% fee tier
     */
    function _attemptRealSwapFromUSDC(address tokenOut, uint256 usdcAmount, uint256 minOut) internal returns (uint256) {
        try this._executeSwapFromUSDC(tokenOut, usdcAmount, minOut, 3000) returns (uint256 result) {
            emit SwapExecuted(USDC_ADDRESS, tokenOut, usdcAmount, result, "RealSwap", 3000);
            return result;
        } catch {
            return 0; // Swap failed
        }
    }

    /**
     * @notice Execute single swap from USDC (external for try/catch)
     */
    function _executeSwapFromUSDC(address tokenOut, uint256 usdcAmount, uint256 minOut, uint24 fee) external returns (uint256) {
        require(msg.sender == address(this), "Only self call");
        
        usdcToken.safeApprove(address(swapRouter), usdcAmount);
        
        if (tokenOut == address(0)) {
            // Swap to native token
            uint256 balanceBefore = IERC20(NATIVE_WRAPPER).balanceOf(address(this));
            
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: USDC_ADDRESS,
                tokenOut: NATIVE_WRAPPER,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: usdcAmount,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            });
            
            swapRouter.exactInputSingle(params);
            
            uint256 balanceAfter = IERC20(NATIVE_WRAPPER).balanceOf(address(this));
            return balanceAfter - balanceBefore;
        } else {
            // Swap to ERC20 token
            uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
            
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: USDC_ADDRESS,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: usdcAmount,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            });
            
            swapRouter.exactInputSingle(params);
            
            uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
            return balanceAfter - balanceBefore;
        }
    }

    /**
     * @notice Mock swap using Chainlink price feeds
     */
    function _mockSwapToUSDC(address tokenIn, uint256 amountIn) internal returns (uint256 usdcAmount) {
        if (tokenIn == address(0) || tokenIn == NATIVE_WRAPPER) {
            usdcAmount = _getNativeToUSDCAmount(amountIn);
        } else {
            usdcAmount = _getUSDCToNativeAmount(amountIn); // 1:1 fallback for other tokens
        }
        
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        require(contractBalance >= usdcAmount, "Insufficient USDC for mock swap");
        
        emit SwapExecuted(tokenIn, USDC_ADDRESS, amountIn, usdcAmount, "MockSwap", 0);
    }

    /**
     * @notice Mock swap from USDC using Chainlink price feeds
     */
    function _mockSwapFromUSDC(address tokenOut, uint256 usdcAmount) internal returns (uint256 outputAmount) {
        if (tokenOut == address(0) || tokenOut == NATIVE_WRAPPER) {
            outputAmount = _getUSDCToNativeAmount(usdcAmount);
            require(address(this).balance >= outputAmount, "Insufficient native token for mock swap");
        } else {
            outputAmount = usdcAmount; // 1:1 fallback
            require(IERC20(tokenOut).balanceOf(address(this)) >= outputAmount, "Insufficient token for mock swap");
        }
        
        emit SwapExecuted(USDC_ADDRESS, tokenOut, usdcAmount, outputAmount, "MockSwap", 0);
    }

    /**
     * @notice Get native token amount from USDC using Chainlink price feed
     */
    function _getNativeToUSDCAmount(uint256 nativeAmount) internal view returns (uint256) {
        try priceFeed.latestRoundData() returns (uint80, int256 price, uint256, uint256 updatedAt, uint80) {
            if (price > 0 && updatedAt > 0) {
                return (nativeAmount * uint256(price)) / 1e20;
            }
        } catch {}
        
        // Fallback rate: $3300 per ETH
        return (nativeAmount * 3300) / 1e12;
    }

    /**
     * @notice Get USDC amount for native token using Chainlink price feed
     */
    function _getUSDCToNativeAmount(uint256 usdcAmount) internal view returns (uint256) {
        try priceFeed.latestRoundData() returns (uint80, int256 price, uint256, uint256 updatedAt, uint80) {
            if (price > 0 && updatedAt > 0) {
                return (usdcAmount * 1e20) / uint256(price);
            }
        } catch {}
        
        // Fallback rate: $3300 per ETH
        return (usdcAmount * 1e18) / 3300e6;
    }

    /**
     * @notice Send USDC cross-chain via CCIP
     */
    function _sendCCIP(uint64 destinationChain, uint256 usdcAmount, address tokenOut, address receiver, uint256 minOut, address receiverContract) 
        internal returns (bytes32) {
        
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: USDC_ADDRESS, amount: usdcAmount});

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiverContract),
            data: abi.encode(tokenOut, receiver, minOut),
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 500_000})),
            feeToken: address(linkToken)
        });

        uint256 fee = ccipRouter.getFee(destinationChain, message);
        if (fee > linkToken.balanceOf(address(this))) {
            revert NotEnoughBalance(linkToken.balanceOf(address(this)), fee);
        }
        
        linkToken.approve(address(ccipRouter), fee);
        usdcToken.approve(address(ccipRouter), usdcAmount);
        
        return ccipRouter.ccipSend(destinationChain, message);
    }

    /**
     * @notice Handle incoming CCIP messages
     */
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        (address tokenOut, address receiver, uint256 minOut) = abi.decode(message.data, (address, address, uint256));
        uint256 usdcAmount = message.destTokenAmounts[0].amount;

        if (tokenOut == USDC_ADDRESS) {
            usdcToken.safeTransfer(receiver, usdcAmount);
        } else {
            uint256 outputAmount = _convertFromUSDC(tokenOut, usdcAmount, minOut);
            
            if (tokenOut == address(0)) {
                payable(receiver).transfer(outputAmount);
            } else {
                IERC20(tokenOut).safeTransfer(receiver, outputAmount);
            }
        }
    }

    // Owner functions
    function setUseRealSwaps(bool _useReal) external onlyOwner {
        useRealSwaps = _useReal;
    }

    function fundContract() external payable onlyOwner {}

    function fundUSDC(uint256 amount) external onlyOwner {
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawAll() external onlyOwner {
        // Withdraw LINK
        uint256 linkBalance = linkToken.balanceOf(address(this));
        if (linkBalance > 0) {
            linkToken.transfer(owner, linkBalance);
        }
        
        // Withdraw USDC
        uint256 usdcBalance = usdcToken.balanceOf(address(this));
        if (usdcBalance > 0) {
            usdcToken.transfer(owner, usdcBalance);
        }
        
        // Withdraw native tokens
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            payable(owner).transfer(nativeBalance);
        }
    }

    // View functions
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

    function getCurrentETHPrice() external view returns (uint256) {
        return _getNativeToUSDCAmount(1e18);
    }

    function previewUSDCToETH(uint256 usdcAmount) external view returns (uint256) {
        return _getUSDCToNativeAmount(usdcAmount);
    }

    receive() external payable {}
}