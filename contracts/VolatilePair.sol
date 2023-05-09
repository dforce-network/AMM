// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./lib/PairERC20.sol";
import { IVolatilePair } from "./interface/IPair.sol";

import "./utils/UQ112x112.sol";
import "./utils/ERC20Call.sol";
import "./utils/Math.sol";

import "./interface/IPairCallee.sol";
import "./interface/IPairFactory.sol";

/**
 * @title VolatilePair
 * @dev This contract implements the VolatilePair interface and inherits from the PairERC20 contract.
 * It also uses the Initializable contract from the OpenZeppelin library.
 */
contract VolatilePair is Initializable, PairERC20, IVolatilePair {
    using SafeMath for uint256;
    using UQ112x112 for uint224;
    using ERC20Call for address;

    // Minimum liquidity required to add to the pool
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    // Selector for transfer function
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes("transfer(address,uint256)")));

    // Address of the factory that created the pair
    address public factory;
    // Address of token0
    address public override token0;
    // Address of token1
    address public override token1;

    // Reserve of token0
    uint112 private reserve0; // uses single storage slot, accessible via getReserves
    // Reserve of token1
    uint112 private reserve1; // uses single storage slot, accessible via getReserves
    // Block timestamp of the last liquidity event
    uint32 private blockTimestampLast; // uses single storage slot, accessible via getReserves

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint256 public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    // This variable is used to prevent reentrancy attacks
    uint256 private unlocked;

    // The type of the pair, 1 for volatile pair
    uint8 public constant override PAIR_TYPE = 1;

    // Whether or not the pair requires authorization
    bool public constant override AUTH = false;

    // The denominator used for calculating fees
    uint256 public constant FEE_DENOMINATOR = 10**10;

    // The maximum swap fee rate
    uint256 public constant MAX_SWAP_FEE = 10**8;

    // The maximum admin fee rate
    uint256 public constant MAX_ADMIN_FEE = 10**10;

    // The current swap fee rate
    uint256 public swapFeeRate;

    // The current admin fee rate
    uint256 public adminFeeRate;

    // The total admin fee for token0
    uint256 public totalAdminFee0;

    // The total admin fee for token1
    uint256 public totalAdminFee1;

    /**
     * @dev Emitted when liquidity is added to the pool
     * @param sender The address of the sender
     * @param amount0 The amount of token0 added
     * @param amount1 The amount of token1 added
     */
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);

    /**
     * @dev Emitted when liquidity is removed from the pool
     * @param sender The address of the sender
     * @param amount0 The amount of token0 removed
     * @param amount1 The amount of token1 removed
     * @param to The address that receives the tokens
     */
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);

    /**
     * @dev Emitted when a swap occurs
     * @param sender The address of the sender
     * @param amount0In The amount of token0 being swapped in
     * @param amount1In The amount of token1 being swapped in
     * @param amount0Out The amount of token0 being swapped out
     * @param amount1Out The amount of token1 being swapped out
     * @param to The address that receives the swapped tokens
     */
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );

    /**
     * @dev Emitted when the swap fee rate is updated
     * @param tokens The addresses of the tokens in the pair
     * @param swapFees The new swap fee rates for each token
     */
    event SwapFee(address[] tokens, uint256[] swapFees);

    /**
     * @dev Emitted when the reserves are synced
     * @param reserve0 The reserve of token0
     * @param reserve1 The reserve of token1
     */
    event Sync(uint112 reserve0, uint112 reserve1);

    /**
     * @dev Emitted when admin fees are claimed
     * @param token0 The address of token0
     * @param token1 The address of token1
     * @param amount0 The amount of token0 claimed
     * @param amount1 The amount of token1 claimed
     */
    event ClaimFees(address token0, address token1, uint256 amount0, uint256 amount1);

    /**
     * @dev Emitted when the swap fee rate is updated
     * @param oldSwapFeeRate The old swap fee rate
     * @param newSwapFeeRate The new swap fee rate
     */
    event SetSwapFeeRate(uint256 oldSwapFeeRate, uint256 newSwapFeeRate);

    /**
     * @dev Emitted when the admin fee rate is updated
     * @param oldAdminFeeRate The old admin fee rate
     * @param newAdminFeeRate The new admin fee rate
     */
    event SetAdminFeeRate(uint256 oldAdminFeeRate, uint256 newAdminFeeRate);

    /**
     * @dev Initializes the VolatilePair contract
     * @param _tokens The addresses of the tokens in the pair
     * @param _data The encoded swap fee rate and admin fee rate
     */
    function initialize(address[] memory _tokens, bytes memory _data) external override initializer {
        factory = msg.sender;
        unlocked = 1;
        require(_tokens.length == 2, "VolatilePair: This type of pair must have only two tokens when created");
        require(_tokens[0] != _tokens[1], "VolatilePair: Token cannot be the same");
        (token0, token1) = (_tokens[0], _tokens[1]);
        (uint256 _swapfeeRate, uint256 _adminFeeRate) = abi.decode(_data, (uint256, uint256));

        require(_swapfeeRate <= MAX_SWAP_FEE, "VolatilePair: SwapFee is greater than the maximum value");
        require(_adminFeeRate <= MAX_ADMIN_FEE, "VolatilePair: AdminFee is greater than the maximum value");
        (swapFeeRate, adminFeeRate) = (_swapfeeRate, _adminFeeRate);

        _initialize(
            string(abi.encodePacked("dForce AMM Volatile - ", _tokens[0].callSymbol(), "-", _tokens[1].callSymbol())),
            string(abi.encodePacked("vAMM-", _tokens[0].callSymbol(), "-", _tokens[1].callSymbol()))
        );
    }

    /**
     * @dev Modifier to prevent reentrancy
     */
    modifier lock() {
        require(unlocked == 1, "VolatilePair: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    /**
     * @dev Modifier to restrict access to only the manager
     */
    modifier onlyManager() {
        require(msg.sender == IPairFactory(factory).manager(), "VolatilePair: not manager");
        _;
    }

    /**
     * @dev Returns the tokens in the pair
     */
    function tokens() external view override returns (address[] memory) {
        return _tokens();
    }

    /**
     * @dev Returns the reserves and the timestamp of the last block when they were updated
     */
    function getReserves()
        external
        view
        override
        returns (
            uint112,
            uint112,
            uint32
        )
    {
        return _getReserves();
    }

    /**
     * @dev Returns the real balance of each token in the pair, excluding the admin fee
     */
    function getRealBalanceOf() external view override returns (uint256, uint256) {
        return _getRealBalanceOf();
    }

    /**
     * @dev Returns the amount of output tokens given an input amount of a token
     * @param _from The address of the input token
     * @param _to The address of the output token
     * @param _amount The input amount of the token
     */
    function getAmountOut(
        address _from,
        address _to,
        uint256 _amount
    ) external view override returns (uint256) {
        _to;
        (uint256 _reserveA, uint256 _reserveB) = _from == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        return _getAmountOut(_amount, _reserveA, _reserveB);
    }

    /**
     * @dev Returns the tokens in the pair
     */
    function _tokens() internal view returns (address[] memory _tokenList) {
        _tokenList = new address[](2);
        _tokenList[0] = token0;
        _tokenList[1] = token1;
    }

    /**
     * @dev Returns the reserves and the timestamp of the last block when they were updated
     */
    function _getReserves()
        internal
        view
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /**
     * @dev Returns the real balance of each token in the pair, excluding the admin fee
     */
    function _getRealBalanceOf() internal view returns (uint256, uint256) {
        return (
            IERC20(token0).balanceOf(address(this)).sub(totalAdminFee0),
            IERC20(token1).balanceOf(address(this)).sub(totalAdminFee1)
        );
    }

    /**
     * @dev Returns the amount of output tokens given an input amount of a token
     * @param _amountIn The input amount of the token
     * @param _reserveIn The reserve of the input token
     * @param _reserveOut The reserve of the output token
     */
    function _getAmountOut(
        uint256 _amountIn,
        uint256 _reserveIn,
        uint256 _reserveOut
    ) internal view returns (uint256 _amountOut) {
        require(_amountIn > 0, "VolatilePair: INSUFFICIENT_INPUT_AMOUNT");
        require(_reserveIn > 0 && _reserveOut > 0, "VolatilePair: INSUFFICIENT_LIQUIDITY");
        uint256 _amountInWithFee = _amountIn.mul(FEE_DENOMINATOR - swapFeeRate);
        uint256 _numerator = _amountInWithFee.mul(_reserveOut);
        uint256 _denominator = _reserveIn.mul(FEE_DENOMINATOR).add(_amountInWithFee);
        _amountOut = _numerator / _denominator;
    }

    /**
     * @dev Safely transfers tokens
     * @param _token The address of the token to transfer
     * @param _to The address to transfer the tokens to
     * @param _value The amount of tokens to transfer
     */
    function _safeTransfer(
        address _token,
        address _to,
        uint256 _value
    ) private {
        (bool _success, bytes memory _data) = _token.call(abi.encodeWithSelector(SELECTOR, _to, _value));
        require(_success && (_data.length == 0 || abi.decode(_data, (bool))), "VolatilePair: TRANSFER_FAILED");
    }

    /**
     * @dev Updates the reserves and price accumulators for the pair
     * @param _balance0 The current balance of token0 in the pair
     * @param _balance1 The current balance of token1 in the pair
     * @param _reserve0 The current reserve of token0 in the pair
     * @param _reserve1 The current reserve of token1 in the pair
     */
    function _update(
        uint256 _balance0,
        uint256 _balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) private {
        require(_balance0 <= uint112(-1) && _balance1 <= uint112(-1), "VolatilePair: OVERFLOW");
        uint32 _blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 _timeElapsed = _blockTimestamp - blockTimestampLast; // overflow is desired
        if (_timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // Calculate the price accumulators for token0 and token1
            // * never overflows, and + overflow is desired
            price0CumulativeLast += uint256(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * _timeElapsed;
            price1CumulativeLast += uint256(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * _timeElapsed;
        }
        reserve0 = uint112(_balance0);
        reserve1 = uint112(_balance1);
        blockTimestampLast = _blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    /**
     * @dev Updates the admin fee for the pair
     * @param _amountIn0 The input amount of token0
     * @param _amountIn1 The input amount of token1
     * @return _swapFee0 The swap fee for token0
     * @return _swapFee1 The swap fee for token1
     */
    function _updateAdminFee(uint256 _amountIn0, uint256 _amountIn1)
        internal
        returns (uint256 _swapFee0, uint256 _swapFee1)
    {
        uint256 _totalFee0 = _amountIn0.mul(swapFeeRate).div(FEE_DENOMINATOR);
        uint256 _totalFee1 = _amountIn1.mul(swapFeeRate).div(FEE_DENOMINATOR);

        {
            uint256 _adminFee0 = _totalFee0.mul(adminFeeRate).div(FEE_DENOMINATOR);
            uint256 _adminFee1 = _totalFee1.mul(adminFeeRate).div(FEE_DENOMINATOR);

            _swapFee0 = _totalFee0 - _adminFee0;
            _swapFee1 = _totalFee1 - _adminFee1;

            totalAdminFee0 += _adminFee0;
            totalAdminFee1 += _adminFee1;
        }
    }

    /**
     * @dev Mint liquidity tokens to the caller and add corresponding reserves
     * @param _to The address to mint liquidity tokens to
     * @return _liquidity The amount of liquidity tokens minted
     */
    function mint(address _to) external override lock returns (uint256 _liquidity) {
        (uint112 _reserve0, uint112 _reserve1, ) = _getReserves(); // gas savings
        (uint256 _balance0, uint256 _balance1) = _getRealBalanceOf();
        uint256 _amount0 = _balance0.sub(_reserve0);
        uint256 _amount1 = _balance1.sub(_reserve1);

        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        if (_totalSupply == 0) {
            _liquidity = Math.sqrt(_amount0.mul(_amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            _liquidity = Math.min(_amount0.mul(_totalSupply) / _reserve0, _amount1.mul(_totalSupply) / _reserve1);
        }
        require(_liquidity > 0, "VolatilePair: INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(_to, _liquidity);

        _update(_balance0, _balance1, _reserve0, _reserve1);
        emit Mint(msg.sender, _amount0, _amount1); // Emit a Mint event with the amount of token0 and token1 minted
    }

    /**
     * @dev Burn liquidity tokens from the caller and remove corresponding reserves
     * @param _to The address to send the tokens to
     * @return _amount0 The amount of token0 burned
     * @return _amount1 The amount of token1 burned
     */
    function burn(address _to) external override lock returns (uint256 _amount0, uint256 _amount1) {
        (uint112 _reserve0, uint112 _reserve1, ) = _getReserves(); // gas savings
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        (uint256 _balance0, uint256 _balance1) = _getRealBalanceOf();
        uint256 _liquidity = balanceOf[address(this)];

        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        _amount0 = _liquidity.mul(_balance0) / _totalSupply; // using balances ensures pro-rata distribution
        _amount1 = _liquidity.mul(_balance1) / _totalSupply; // using balances ensures pro-rata distribution
        require(_amount0 > 0 && _amount1 > 0, "VolatilePair: INSUFFICIENT_LIQUIDITY_BURNED");
        _burn(address(this), _liquidity);
        _safeTransfer(_token0, _to, _amount0);
        _safeTransfer(_token1, _to, _amount1);

        (_balance0, _balance1) = _getRealBalanceOf();
        _update(_balance0, _balance1, _reserve0, _reserve1);
        emit Burn(msg.sender, _amount0, _amount1, _to); // Emit a Burn event with the amount of token0 and token1 burned and the address they were sent to
    }

    /**
     * @dev Low-level function for swapping tokens
     * @param _amount0Out The amount of token0 to receive
     * @param _amount1Out The amount of token1 to receive
     * @param _to The address to send the tokens to
     * @param _data Additional data with no specified format, sent in call to `_to`
     */
    function swap(
        uint256 _amount0Out,
        uint256 _amount1Out,
        address _to,
        bytes calldata _data
    ) external override lock {
        require(_amount0Out > 0 || _amount1Out > 0, "VolatilePair: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1, ) = _getReserves(); // gas savings
        require(_amount0Out < _reserve0 && _amount1Out < _reserve1, "VolatilePair: INSUFFICIENT_LIQUIDITY");

        uint256 _balance0;
        uint256 _balance1;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            address _token0 = token0;
            address _token1 = token1;
            require(_to != _token0 && _to != _token1, "VolatilePair: INVALID_TO");
            if (_amount0Out > 0) _safeTransfer(_token0, _to, _amount0Out); // optimistically transfer tokens
            if (_amount1Out > 0) _safeTransfer(_token1, _to, _amount1Out); // optimistically transfer tokens
            if (_data.length > 0) IPairCallee(_to).hook(msg.sender, _amount0Out, _amount1Out, _data);
            (_balance0, _balance1) = _getRealBalanceOf();
        }
        uint256 _amount0In = _balance0 > _reserve0 - _amount0Out ? _balance0 - (_reserve0 - _amount0Out) : 0;
        uint256 _amount1In = _balance1 > _reserve1 - _amount1Out ? _balance1 - (_reserve1 - _amount1Out) : 0;
        require(_amount0In > 0 || _amount1In > 0, "VolatilePair: INSUFFICIENT_INPUT_AMOUNT");
        {
            // scope for reserve{0,1}Adjusted, avoids stack too deep errors
            uint256 _balance0Adjusted = _balance0.mul(FEE_DENOMINATOR).sub(_amount0In.mul(swapFeeRate));
            uint256 _balance1Adjusted = _balance1.mul(FEE_DENOMINATOR).sub(_amount1In.mul(swapFeeRate));
            require(
                _balance0Adjusted.mul(_balance1Adjusted) >= uint256(_reserve0).mul(_reserve1).mul(FEE_DENOMINATOR**2),
                "VolatilePair: K"
            );

            //update totalAdminFee and balance
            (uint256 _swapFee0, uint256 _swapFee1) = _updateAdminFee(_amount0In, _amount1In);

            uint256[] memory _swapFees = new uint256[](2);
            (_swapFees[0], _swapFees[1]) = (_swapFee0, _swapFee1);
            emit SwapFee(_tokens(), _swapFees);
        }

        (_balance0, _balance1) = _getRealBalanceOf();
        _update(_balance0, _balance1, _reserve0, _reserve1);

        emit Swap(msg.sender, _amount0In, _amount1In, _amount0Out, _amount1Out, _to);
    }

    /**
     * @dev Skim the excess tokens from the contract and send them to the specified address
     * @param _to The address to send the excess tokens to
     */
    function skim(address _to) external override lock {
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        (uint256 _balance0, uint256 _balance1) = _getRealBalanceOf();
        _safeTransfer(_token0, _to, _balance0.sub(reserve0)); // Transfer the excess token0 balance to the specified address
        _safeTransfer(_token1, _to, _balance1.sub(reserve1)); // Transfer the excess token1 balance to the specified address
    }

    /**
     * @dev Update reserves to match balances
     */
    function sync() external override lock {
        (uint256 _balance0, uint256 _balance1) = _getRealBalanceOf();
        _update(_balance0, _balance1, reserve0, reserve1);
    }

    /**
     * @dev Claim admin fees
     * @return _adminFees An array of admin fees
     */
    function claimFees() external override returns (uint256[] memory _adminFees) {
        address _manager = IPairFactory(factory).manager();
        _adminFees = new uint256[](2);

        (_adminFees[0], _adminFees[1]) = (totalAdminFee0, totalAdminFee1);
        (totalAdminFee0, totalAdminFee1) = (0, 0);

        _safeTransfer(token0, _manager, _adminFees[0]);
        _safeTransfer(token1, _manager, _adminFees[1]);
        emit ClaimFees(token0, token1, _adminFees[0], _adminFees[1]);
    }

    /**
     * @dev Set swap fee rate
     * @param _swapFeeRate The new swap fee rate
     */
    function setSwapFeeRate(uint256 _swapFeeRate) external onlyManager {
        require(_swapFeeRate <= MAX_SWAP_FEE, "VolatilePair: SwapFee is greater than the maximum value");
        uint256 _old = swapFeeRate;
        swapFeeRate = _swapFeeRate;
        emit SetSwapFeeRate(_old, _swapFeeRate);
    }

    /**
     * @dev Set admin fee rate
     * @param _adminFeeRate The new admin fee rate
     */
    function setAdminFeeRate(uint256 _adminFeeRate) external onlyManager {
        require(_adminFeeRate <= MAX_ADMIN_FEE, "VolatilePair: AdminFee is greater than the maximum value");
        uint256 _old = adminFeeRate;
        adminFeeRate = _adminFeeRate;
        emit SetAdminFeeRate(_old, _adminFeeRate);
    }
}
