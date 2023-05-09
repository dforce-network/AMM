// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../utils/TransferHelper.sol";
import "../utils/Math.sol";

import "../interface/IPairRouter.sol";
import "../interface/IPairFactory.sol";
import "../interface/IPair.sol";
import "../interface/IWETH.sol";
import "../interface/IPairERC20.sol";

/**
 * @title VolatileRouter
 * @notice Router contract for volatile pairs
 */

contract VolatileRouter is IVolatileRouter {
    using SafeMath for uint256;
    using TransferHelper for address;

    // Pair type for volatile pairs
    uint8 internal constant PAIR_TYPE_ = 1;
    // Minimum liquidity for volatile pairs
    uint256 internal constant MINIMUM_LIQUIDITY = 10 ** 3;

    // Address of the factory contract
    address internal immutable factory_;
    // Wrapped Ether contract
    IWETH internal immutable weth_;

    /**
     * @dev Constructor function for VolatileRouter
     * @param _factory Address of the factory contract
     * @param _weth Address of the Wrapped Ether contract
     */
    constructor(address _factory, address _weth) public {
        factory_ = _factory;
        weth_ = IWETH(_weth);
    }

    /**
     * @dev Modifier to ensure that the deadline has not passed
     * @param _deadline Deadline timestamp
     */
    modifier ensure(uint256 _deadline) {
        require(_deadline >= block.timestamp, "VolatileRouter: EXPIRED");
        _;
    }

    /**
     * @dev Returns the pair type for volatile pairs
     * @return Pair type
     */
    function PAIR_TYPE() external view override returns (uint8) {
        return PAIR_TYPE_;
    }

    /**
     * @dev Returns the address of the factory contract
     * @return Factory contract address
     */
    function factory() external view returns (address) {
        return factory_;
    }

    /**
     * @dev Returns the address of the Wrapped Ether contract
     * @return Wrapped Ether contract address
     */
    function weth() external view returns (address) {
        return address(weth_);
    }

    /**
     * @dev Returns the reserves of the given pair and tokens
     * @param _pair Address of the pair contract
     * @param _tokens Array of token addresses
     * @return _reserveA Reserve of token A
     * @return _reserveB Reserve of token B
     */
    function getReserves(
        address _pair,
        address[] memory _tokens
    ) external view override returns (uint256 _reserveA, uint256 _reserveB) {
        (_reserveA, _reserveB) = _getReserves(_pair, _tokens);
    }

    /**
     * @dev Returns the reserves of the given pair and tokens
     * @param _pair Address of the pair contract
     * @param _tokens Array of token addresses
     * @return _reserveA Reserve of token A
     * @return _reserveB Reserve of token B
     */
    function _getReserves(
        address _pair,
        address[] memory _tokens
    ) internal view returns (uint256 _reserveA, uint256 _reserveB) {
        address _token0 = IVolatilePair(_pair).token0();
        (uint112 _reserve0, uint112 _reserve1, ) = IVolatilePair(_pair).getReserves();
        (_reserveA, _reserveB) = _tokens[0] == _token0
            ? (uint256(_reserve0), uint256(_reserve1))
            : (uint256(_reserve1), uint256(_reserve0));
    }

    /**
     * @dev Calculates the optimal amount of token B to add to a pair given an amount of token A
     * @param _amountA Amount of token A to add
     * @param _reserveA Reserve of token A in the pair
     * @param _reserveB Reserve of token B in the pair
     * @return _amountB Amount of token B to add
     */
    function _quoteLiquidity(
        uint256 _amountA,
        uint256 _reserveA,
        uint256 _reserveB
    ) internal pure returns (uint256 _amountB) {
        require(_amountA > 0, "VolatileRouter: INSUFFICIENT_AMOUNT");
        require(_reserveA > 0 && _reserveB > 0, "VolatileRouter: INSUFFICIENT_LIQUIDITY");
        _amountB = _amountA.mul(_reserveB) / _reserveA;
    }

    /**
     * @dev Calculates the optimal amount of token A and token B to add to a pair given desired amounts of each
     * @param _tokens Array of token addresses
     * @param _amountDesireds Array of desired amounts of each token
     * @return _amountsIn Array of amounts of each token to add
     * @return _liquidity Amount of liquidity to add
     */
    function quoteAddLiquidity(
        address[] calldata _tokens,
        uint256[] calldata _amountDesireds
    ) external view override returns (uint256[] memory _amountsIn, uint256 _liquidity) {
        _amountsIn = new uint256[](_amountDesireds.length);
        // create the pair if it doesn't exist yet
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        if (!IPairFactory(factory_).isPair(_pair)) return (_amountsIn, _liquidity);

        (uint256 _reserveA, uint256 _reserveB) = (0, 0);
        uint256 _totalSupply = 0;
        if (_pair != address(0)) {
            _totalSupply = IPairERC20(_pair).totalSupply();
            (_reserveA, _reserveB) = _getReserves(_pair, _tokens);
        }

        if (_reserveA == 0 && _reserveB == 0) {
            _amountsIn = _amountDesireds;
            _liquidity = Math.sqrt(_amountsIn[0].mul(_amountsIn[1])).sub(MINIMUM_LIQUIDITY);
        } else {
            uint256 amountBOptimal = _quoteLiquidity(_amountDesireds[0], _reserveA, _reserveB);
            if (amountBOptimal <= _amountDesireds[1]) {
                (_amountsIn[0], _amountsIn[1]) = (_amountDesireds[0], amountBOptimal);
                _liquidity = Math.min(
                    _amountsIn[0].mul(_totalSupply).div(_reserveA),
                    _amountsIn[1].mul(_totalSupply).div(_reserveB)
                );
            } else {
                uint256 amountAOptimal = _quoteLiquidity(_amountDesireds[1], _reserveB, _reserveA);
                (_amountsIn[0], _amountsIn[1]) = (amountAOptimal, _amountDesireds[1]);
                _liquidity = Math.min(
                    _amountsIn[0].mul(_totalSupply).div(_reserveA),
                    _amountsIn[1].mul(_totalSupply).div(_reserveB)
                );
            }
        }
    }

    /**
     * @dev Calculates the amount of tokens to receive upon removing liquidity from a pair
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @return _amounts Array of amounts of each token to receive
     */
    function quoteRemoveLiquidity(
        address[] calldata _tokens,
        uint256 _liquidity
    ) external view override returns (uint256[] memory _amounts) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        _amounts = new uint256[](2);
        if (!IPairFactory(factory_).isPair(_pair)) {
            return _amounts;
        }

        (uint256 _reserveA, uint256 _reserveB) = _getReserves(_pair, _tokens);
        uint256 _totalSupply = IPairERC20(_pair).totalSupply();
        if (_totalSupply > 0) {
            _amounts[0] = _liquidity.mul(_reserveA) / _totalSupply; // calculate the amount of token A to receive
            _amounts[1] = _liquidity.mul(_reserveB) / _totalSupply; // calculate the amount of token B to receive
        }
    }

    /**
     * @dev Adds liquidity to a pair of tokens
     * @param _tokens Array of token addresses
     * @param _amountDesireds Array of desired amounts of each token
     * @param _amountsMin Array of minimum amounts of each token
     * @return _amountA Amount of token A added to the liquidity pool
     * @return _amountB Amount of token B added to the liquidity pool
     */
    function _addLiquidity(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin
    ) internal returns (uint256 _amountA, uint256 _amountB) {
        require(_amountDesireds[0] >= _amountsMin[0], "VolatileRouter: token[0] desired invalid");
        require(_amountDesireds[1] >= _amountsMin[1], "VolatileRouter: token[1] desired invalid");

        // create the pair if it doesn't exist yet
        (uint256 _reserveA, uint256 _reserveB) = (0, 0);
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        if (!IPairFactory(factory_).isPair(_pair)) {
            _pair = IPairFactory(factory_).createPair(_tokens, PAIR_TYPE_, new bytes(0));
        } else {
            (_reserveA, _reserveB) = _getReserves(_pair, _tokens);
        }

        require(_pair != address(0), "VolatileRouter: pair does not exist");
        if (_reserveA == 0 && _reserveB == 0) {
            (_amountA, _amountB) = (_amountDesireds[0], _amountDesireds[1]);
        } else {
            uint256 _amountBOptimal = _quoteLiquidity(_amountDesireds[0], _reserveA, _reserveB);
            if (_amountBOptimal <= _amountDesireds[1]) {
                require(_amountBOptimal >= _amountsMin[1], "VolatileRouter: INSUFFICIENT_B_AMOUNT");
                (_amountA, _amountB) = (_amountDesireds[0], _amountBOptimal);
            } else {
                uint256 _amountAOptimal = _quoteLiquidity(_amountDesireds[1], _reserveB, _reserveA);
                assert(_amountAOptimal <= _amountDesireds[0]);
                require(_amountAOptimal >= _amountsMin[0], "VolatileRouter: INSUFFICIENT_A_AMOUNT");
                (_amountA, _amountB) = (_amountAOptimal, _amountDesireds[1]);
            }
        }
    }

    /**
     * @dev Adds liquidity to a pair of tokens
     * @param _tokens Array of token addresses
     * @param _amountDesireds Array of desired amounts of each token
     * @param _amountsMin Array of minimum amounts of each token
     * @param _minLiquidity Minimum amount of liquidity to mint
     * @param _to Address to receive the minted liquidity
     * @param _deadline Timestamp after which the transaction will revert
     * @return _amounts Amounts of tokens added to the liquidity pool
     * @return _liquidity Amount of liquidity minted
     */
    function addLiquidity(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external override ensure(_deadline) returns (uint256[] memory _amounts, uint256 _liquidity) {
        _amounts = _amountDesireds;
        (_amounts[0], _amounts[1]) = _addLiquidity(_tokens, _amountDesireds, _amountsMin);
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        for (uint256 i = 0; i < _tokens.length; i++) {
            // Transfer tokens from sender to pair
            _tokens[i].safeTransferFrom(msg.sender, _pair, _amounts[i]);
        }
        // Mint liquidity and transfer to recipient
        _liquidity = IVolatilePair(_pair).mint(_to);
        require(_liquidity >= _minLiquidity, "VolatileRouter: Couldn't mint min requested");
    }

    /**
     * @dev Adds liquidity to a pair of tokens
     * @param _tokens Array of token addresses
     * @param _amountDesireds Array of desired amounts of each token
     * @param _amountsMin Array of minimum amounts of each token
     * @param _minLiquidity Minimum amount of liquidity to mint
     * @param _to Address to receive the minted liquidity
     * @param _deadline Timestamp after which the transaction will revert
     * @return _amounts Amounts of tokens added to the liquidity pool
     * @return _liquidity Amount of liquidity minted
     */
    function addLiquidityETH(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external payable override ensure(_deadline) returns (uint256[] memory _amounts, uint256 _liquidity) {
        _amounts = _amountDesireds;
        (_amounts[0], _amounts[1]) = _addLiquidity(_tokens, _amountDesireds, _amountsMin);
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        uint256 _amountETH;
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == address(weth_)) {
                _amountETH = _amounts[i];
                weth_.deposit{ value: _amounts[i] }();
                assert(weth_.transfer(_pair, _amounts[i]));
                continue;
            }

            _tokens[i].safeTransferFrom(msg.sender, _pair, _amounts[i]);
        }
        _liquidity = IVolatilePair(_pair).mint(_to);
        require(_liquidity >= _minLiquidity, "VolatileRouter: Couldn't mint min requested");

        if (msg.value > _amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - _amountETH);
    }

    /**
     * @dev Removes liquidity from a pair of tokens
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @param _amountsMin Array of minimum amounts of each token to receive
     * @param _to Address to receive the tokens
     * @return _amounts Amounts of tokens received
     */
    function _removeLiquidity(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to
    ) internal returns (uint256[] memory _amounts) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        require(IPairFactory(factory_).isPair(_pair), "VolatileRouter: is not pair");

        IPairERC20(_pair).transferFrom(msg.sender, _pair, _liquidity);
        (uint256 _amount0, uint256 _amount1) = IVolatilePair(_pair).burn(_to);

        address _token0 = IVolatilePair(_pair).token0();
        _amounts = new uint256[](_amountsMin.length);
        (_amounts[0], _amounts[1]) = _token0 == _tokens[0] ? (_amount0, _amount1) : (_amount1, _amount0);

        for (uint256 i = 0; i < _amounts.length; i++) {
            require(_amounts[i] >= _amountsMin[i], "VolatileRouter: _amount < _amountsMin");
        }
    }

    /**
     * @dev Removes liquidity from a pair of tokens
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @param _amountsMin Array of minimum amounts of each token to receive
     * @param _to Address to receive the tokens
     * @param _deadline Timestamp after which the transaction will revert
     * @return _amounts Amounts of tokens received
     */
    function removeLiquidity(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) public override ensure(_deadline) returns (uint256[] memory _amounts) {
        _amounts = _removeLiquidity(_tokens, _liquidity, _amountsMin, _to);
    }

    /**
     * @dev Removes liquidity from a pair of tokens with ETH
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @param _amountsMin Array of minimum amounts of each token to receive
     * @param _to Address to receive the tokens
     * @param _deadline Timestamp after which the transaction will revert
     * @return _amounts Amounts of tokens received
     */
    function removeLiquidityETH(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) public override ensure(_deadline) returns (uint256[] memory _amounts) {
        _amounts = _removeLiquidity(_tokens, _liquidity, _amountsMin, address(this));
        uint256 _amountETH;
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == address(weth_)) {
                _amountETH = _amounts[i];
                weth_.withdraw(_amountETH);
                // _to.safeTransferETH(_amounts[i]);
                continue;
            }
            _tokens[i].safeTransfer(_to, _amounts[i]);
        }
        _to.safeTransferETH(_amountETH);
    }

    /**
     * @dev Adds permit functionality to removeLiquidity and removeLiquidityETH functions
     * @param _pair Address of the pair
     * @param _liquidity Amount of liquidity to remove
     * @param _deadline Timestamp after which the transaction will revert
     * @param _approveMax Whether to approve the maximum amount or not
     * @param _v ECDSA signature parameter v
     * @param _r ECDSA signature parameter r
     * @param _s ECDSA signature parameter s
     */
    function _withPermit(
        address _pair,
        uint256 _liquidity,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal {
        uint256 _value = _approveMax ? uint256(-1) : _liquidity;
        IPairERC20(_pair).permit(msg.sender, address(this), _value, _deadline, _v, _r, _s);
    }

    /**
     * @dev Removes liquidity from a pair of tokens with permit functionality
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @param _amountMin Array of minimum amounts of each token to receive
     * @param _to Address to receive the tokens
     * @param _deadline Timestamp after which the transaction will revert
     * @param _approveMax Whether to approve the maximum amount or not
     * @param _v ECDSA signature parameter v
     * @param _r ECDSA signature parameter r
     * @param _s ECDSA signature parameter s
     * @return _amounts Amounts of tokens received
     */
    function removeLiquidityWithPermit(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountMin,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256[] memory _amounts) {
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );
        _amounts = removeLiquidity(_tokens, _liquidity, _amountMin, _to, _deadline);
        return _amounts;
    }

    /**
     * @dev Removes liquidity from a pair of tokens with ETH and permit functionality
     * @param _tokens Array of token addresses
     * @param _liquidity Amount of liquidity to remove
     * @param _amountsMin Array of minimum amounts of each token to receive
     * @param _to Address to receive the tokens
     * @param _deadline Timestamp after which the transaction will revert
     * @param _approveMax Whether to approve the maximum amount or not
     * @param _v ECDSA signature parameter v
     * @param _r ECDSA signature parameter r
     * @param _s ECDSA signature parameter s
     * @return _amounts Amounts of tokens received
     */
    function removeLiquidityETHWithPermit(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256[] memory _amounts) {
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );
        _amounts = removeLiquidityETH(_tokens, _liquidity, _amountsMin, _to, _deadline);
        return _amounts;
    }

    /**
     * @dev Swaps tokens according to the given route
     * @param _route Route containing the pair and the token to swap from
     * @param _amountIn Amount of tokens to swap
     * @param _amountOut Expected amount of tokens to receive
     * @param _to Address to receive the swapped tokens
     */
    function _swap(Route memory _route, uint256 _amountIn, uint256 _amountOut, address _to) internal {
        require(IPairFactory(factory_).isPair(_route.pair), "VolatileRouter: is not pair");
        address _token0 = IVolatilePair(_route.pair).token0();
        (uint256 _amount0Out, uint256 _amount1Out) = _route.from == _token0
            ? (uint256(0), _amountOut)
            : (_amountOut, uint256(0));

        _route.from.safeTransfer(_route.pair, _amountIn);

        IVolatilePair(_route.pair).swap(_amount0Out, _amount1Out, _to, new bytes(0));
    }

    /**
     * @dev Swaps tokens according to the given route
     * @param _route Route containing the pair and the token to swap from
     * @param _amountIn Amount of tokens to swap
     * @param _amountOut Expected amount of tokens to receive
     * @param _to Address to receive the swapped tokens
     * @param _deadline Timestamp after which the transaction will revert
     * @return Amount of tokens received
     */
    function swap(
        Route memory _route,
        uint256 _amountIn,
        uint256 _amountOut,
        address _to,
        uint256 _deadline
    ) external payable override ensure(_deadline) returns (uint256) {
        _swap(_route, _amountIn, _amountOut, _to);

        return _amountOut;
    }
}
