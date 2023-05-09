// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../utils/TransferHelper.sol";

import "../interface/IPairRouter.sol";
import "../interface/IPairFactory.sol";
import "../interface/IPair.sol";
import "../interface/IWETH.sol";
import "../interface/IPairERC20.sol";

/**
 * @title StableRouter
 * @notice Router for stablecoin pairs
 * @dev This contract implements the IStablPairRouter interface
 */
contract StableRouter is IStablPairRouter {
    using TransferHelper for address;

    // The type of pair
    uint8 internal constant PAIR_TYPE_ = 2;

    // The address of the factory contract
    address internal immutable factory_;
    // The WETH contract
    IWETH internal immutable weth_;

    constructor(address _factory, address _weth) public {
        factory_ = _factory;
        weth_ = IWETH(_weth);
    }

    // Get the type of pair
    function PAIR_TYPE() external view override returns (uint8) {
        return PAIR_TYPE_;
    }

    // Get the address of the factory contract
    function factory() external view returns (address) {
        return factory_;
    }

    // Get the address of the WETH contract
    function weth() external view returns (address) {
        return address(weth_);
    }

    /**
     * @dev Calculates the amount of tokens needed to add liquidity to a pair
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token
     * @return _amountIn The amounts of each token needed to add liquidity
     * @return _liquidity The amount of liquidity that will be added
     */
    function quoteAddLiquidity(
        address[] calldata _tokens,
        uint256[] calldata _amountDesireds
    ) external view override returns (uint256[] memory _amountIn, uint256 _liquidity) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        bool _isPair = IPairFactory(factory_).isPair(_pair);
        if (_isPair) {
            _amountIn = _amountDesireds;
            (bool _success, bytes memory _res) = _pair.staticcall(
                abi.encodeWithSignature(
                    "calculateTokenAmount(address[],uint256[],bool)",
                    _tokens,
                    _amountDesireds,
                    true
                )
            );
            if (_success) _liquidity = abi.decode(_res, (uint256));
        }
    }

    /**
     * @dev Calculates the amount of tokens that will be received upon removing liquidity from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @return _amounts The amounts of each token that will be received
     */
    function quoteRemoveLiquidity(
        address[] calldata _tokens,
        uint256 _liquidity
    ) external view override returns (uint256[] memory _amounts) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        if (IPairFactory(factory_).isPair(_pair))
            _amounts = IStablePair(_pair).calculateRemoveLiquidity(_tokens, _liquidity);
    }

    /**
     * @dev Calculates the amount of a specific token that will be received upon removing liquidity from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _token The token to calculate the amount for
     * @param _liquidity The amount of liquidity to remove
     * @return _amount The amount of the specified token that will be received
     */
    function quoteRemoveLiquidityOneToken(
        address[] calldata _tokens,
        address _token,
        uint256 _liquidity
    ) external view override returns (uint256 _amount) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        if (IPairFactory(factory_).isPair(_pair))
            _amount = IStablePair(_pair).calculateRemoveLiquidityOneToken(_token, _liquidity);
    }

    /**
     * @dev Calculates the amount of liquidity that will be removed when removing an imbalanced amount of tokens from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of each token to remove
     * @return _liquidity The amount of liquidity that will be removed
     */
    function quoteRemoveLiquidityImbalance(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external view override returns (uint256 _liquidity) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        if (IPairFactory(factory_).isPair(_pair))
            _liquidity = IStablePair(_pair).calculateTokenAmount(_tokens, _amounts, false) + 1;
    }

    /**
     * @dev Adds liquidity to a pair
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token to add
     * @param _amountMin Unused
     * @param _minLiquidity The minimum amount of liquidity to add
     * @param _to The address to send the liquidity to
     * @param _deadline The deadline to add liquidity by
     * @return _amounts The actual amounts of each token added
     * @return _liquidity The amount of liquidity added
     */
    function addLiquidity(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountMin, // Unused
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external override returns (uint256[] memory _amounts, uint256 _liquidity) {
        _amountMin;
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        require(IPairFactory(factory_).isPair(_pair), "StableRouter: is not pair");

        // Transfer tokens from sender to contract and approve for pair
        _amounts = _amountDesireds;
        for (uint256 i = 0; i < _tokens.length; i++) {
            _tokens[i].safeTransferFrom(msg.sender, address(this), _amounts[i]);
            _tokens[i].safeApprove(_pair, _amounts[i]);
        }

        // Add liquidity to pair
        _liquidity = IStablePair(_pair).addLiquidity(_tokens, _amounts, _minLiquidity, _to, _deadline);
    }

    /**
     * @dev Adds liquidity to a pair with ETH
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token to add
     * @param _amountMin Unused
     * @param _minLiquidity The minimum amount of liquidity to add
     * @param _to The address to send the liquidity to
     * @param _deadline The deadline to add liquidity by
     * @return _amounts The actual amounts of each token added
     * @return _liquidity The amount of liquidity added
     */
    function addLiquidityETH(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountMin, // Unused
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external payable override returns (uint256[] memory _amounts, uint256 _liquidity) {
        _amountMin;
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        require(IPairFactory(factory_).isPair(_pair), "StableRouter: is not pair");

        // Transfer tokens from sender to contract and approve for pair
        _amounts = _amountDesireds;
        uint256 _amountETH;
        for (uint256 i = 0; i < _tokens.length; i++) {
            _tokens[i].safeApprove(_pair, _amounts[i]);
            if (_tokens[i] == address(weth_)) {
                _amountETH = _amounts[i];
                weth_.deposit{ value: _amounts[i] }();
                continue;
            }
            _tokens[i].safeTransferFrom(msg.sender, address(this), _amounts[i]);
        }

        // Add liquidity to pair
        _liquidity = IStablePair(_pair).addLiquidity(_tokens, _amounts, _minLiquidity, _to, _deadline);

        if (msg.value > _amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - _amountETH);
    }

    /**
     * @dev Remove liquidity from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _pairTokens The tokens in the pair
     * @return _amounts The actual amounts of each token received
     */
    function _removeLiquidity(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) internal returns (address[] memory _pairTokens, uint256[] memory _amounts) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        require(IPairFactory(factory_).isPair(_pair), "StableRouter: is not pair"); // send liquidity to pair

        address _lpToken = IStablePair(_pair).lpToken();
        _lpToken.safeTransferFrom(msg.sender, address(this), _liquidity);
        _lpToken.safeApprove(_pair, _liquidity);

        _amounts = IStablePair(_pair).removeLiquidity(_liquidity, _tokens, _amountsMin, _to, _deadline);
        _pairTokens = IPair(_pair).tokens();
    }

    /**
     * @dev Transfer tokens out of the contract with ETH
     * @param _tokens The tokens to transfer out
     * @param _amounts The amounts of each token to transfer out
     * @param _to The address to send the tokens to
     */
    function _transferOutWithETH(address[] memory _tokens, uint256[] memory _amounts, address _to) internal {
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
     * @dev Remove liquidity from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _amounts The actual amounts of each token received
     */
    function removeLiquidity(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) public override returns (uint256[] memory _amounts) {
        (, _amounts) = _removeLiquidity(_tokens, _liquidity, _amountsMin, _to, _deadline);
    }

    /**
     * @dev Remove liquidity from a pair with ETH
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _amounts The actual amounts of each token received
     */
    function removeLiquidityETH(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) public override returns (uint256[] memory _amounts) {
        address[] memory _pairTokens;
        (_pairTokens, _amounts) = _removeLiquidity(_tokens, _liquidity, _amountsMin, address(this), _deadline);
        _transferOutWithETH(_pairTokens, _amounts, _to);
    }

    /**
     * @dev Remove liquidity from a pair for a single token
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _tokenAmount The actual amount of token received
     */
    function _removeLiquidityOneToken(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) internal returns (uint256 _tokenAmount) {
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        require(IPairFactory(factory_).isPair(_pair), "StableRouter: is not pair");

        address _lpToken = IStablePair(_pair).lpToken();
        _lpToken.safeTransferFrom(msg.sender, address(this), _liquidity);
        _lpToken.safeApprove(_pair, _liquidity);

        _tokenAmount = IStablePair(_pair).removeLiquidityOneToken(_liquidity, _token, _minAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity for a single token from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _tokenAmount The actual amount of token received
     */
    function removeLiquidityOneToken(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) public override returns (uint256 _tokenAmount) {
        _tokenAmount = _removeLiquidityOneToken(_tokens, _liquidity, _token, _minAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity for a single token from a pair with ETH
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive (must be WETH)
     * @param _minAmount The minimum amount of token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _tokenAmount The actual amount of token received
     */
    function removeLiquidityOneTokenETH(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) public override returns (uint256 _tokenAmount) {
        require(_token == address(weth_), "StableRouter: token must be WETH");

        _tokenAmount = _removeLiquidityOneToken(_tokens, _liquidity, _token, _minAmount, address(this), _deadline);

        weth_.withdraw(_tokenAmount);
        _to.safeTransferETH(_tokenAmount);
    }

    /**
     * @dev Remove liquidity imbalance for multiple tokens from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove liquidity for
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _actualBurnAmount The actual amount of liquidity burned
     */
    function _removeLiquidityImbalance(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) internal returns (uint256 _actualBurnAmount) {
        // Get the pair address from the factory
        address _pair = IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_);
        // Ensure that the pair exists
        require(IPairFactory(factory_).isPair(_pair), "StableRouter: is not pair");

        // Get the LP token address
        address _lpToken = IStablePair(_pair).lpToken();
        // Transfer the LP tokens from the sender to this contract
        _lpToken.safeTransferFrom(msg.sender, address(this), _maxBurnAmount);
        // Approve the LP tokens for the pair
        _lpToken.safeApprove(_pair, _maxBurnAmount);

        // Remove the liquidity imbalance
        _actualBurnAmount = IStablePair(_pair).removeLiquidityImbalance(
            _tokens,
            _amounts,
            _maxBurnAmount,
            _to,
            _deadline
        );

        // If the actual burn amount is less than the maximum burn amount, transfer the remaining LP tokens back to the sender
        if (_maxBurnAmount > _actualBurnAmount) {
            _lpToken.safeApprove(_pair, 0);
            _lpToken.safeTransfer(msg.sender, _maxBurnAmount - _actualBurnAmount);
        }
    }

    /**
     * @dev Remove liquidity imbalance for multiple tokens from a pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove liquidity for
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _actualBurnAmount The actual amount of liquidity burned
     */
    function removeLiquidityImbalance(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) public override returns (uint256 _actualBurnAmount) {
        _actualBurnAmount = _removeLiquidityImbalance(_tokens, _amounts, _maxBurnAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity imbalance for multiple tokens from a pair with ETH
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove liquidity for
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @return _actualBurnAmount The actual amount of liquidity burned
     */
    function removeLiquidityImbalanceETH(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) public override returns (uint256 _actualBurnAmount) {
        // Remove liquidity imbalance for multiple tokens from a pair
        _actualBurnAmount = _removeLiquidityImbalance(_tokens, _amounts, _maxBurnAmount, address(this), _deadline);
        // Transfer tokens out with ETH
        _transferOutWithETH(_tokens, _amounts, _to);
    }

    /**
     * @dev Approve the LP tokens for the pair using permit
     * @param _pair The address of the pair
     * @param _liquidity The amount of liquidity to approve
     * @param _deadline The deadline to approve by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
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
        // Determine the value to approve
        uint256 _value = _approveMax ? uint256(-1) : _liquidity;
        // Get the LP token address
        address _lpToken = IStablePair(_pair).lpToken();
        // Approve the LP tokens using permit
        IPairERC20(_lpToken).permit(msg.sender, address(this), _value, _deadline, _v, _r, _s);
    }

    /**
     * @dev Remove liquidity with permit
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of tokens to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _amounts The actual amounts of tokens received
     */
    function removeLiquidityWithPermit(
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
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity for multiple tokens from a pair
        _amounts = removeLiquidity(_tokens, _liquidity, _amountsMin, _to, _deadline);
    }

    /**
     * @dev Remove liquidity with permit
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of tokens to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _amounts The actual amounts of tokens received
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
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity for ETH from a pair
        _amounts = removeLiquidityETH(_tokens, _liquidity, _amountsMin, _to, _deadline);
    }

    /**
     * @dev Remove liquidity for a single token with permit
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of tokens to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _tokenAmount The actual amount of tokens received
     */
    function removeLiquidityOneTokenWithPermit(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256 _tokenAmount) {
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity for a single token from a pair
        _tokenAmount = removeLiquidityOneToken(_tokens, _liquidity, _token, _minAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity for a single token with permit and receive ETH
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of tokens to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _tokenAmount The actual amount of tokens received
     */
    function removeLiquidityOneTokenETHWithPermit(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256 _tokenAmount) {
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _liquidity,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity for a single token from a pair and receive ETH
        _tokenAmount = removeLiquidityOneTokenETH(_tokens, _liquidity, _token, _minAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity with permit when the amount of tokens to remove is imbalanced
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove
     * @param _maxBurnAmount The maximum amount of liquidity to burn
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _actualBurnAmount The actual amount of liquidity burned
     */
    function removeLiquidityImbalanceWithPermit(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256 _actualBurnAmount) {
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _maxBurnAmount,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity with imbalanced amounts of tokens from a pair
        _actualBurnAmount = removeLiquidityImbalance(_tokens, _amounts, _maxBurnAmount, _to, _deadline);
    }

    /**
     * @dev Remove liquidity with permit when the amount of tokens to remove is imbalanced and receive ETH
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove
     * @param _maxBurnAmount The maximum amount of liquidity to burn
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to remove liquidity by
     * @param _approveMax Whether to approve the maximum amount of liquidity
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _actualBurnAmount The actual amount of liquidity burned
     */
    function removeLiquidityImbalanceETHWithPermit(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external override returns (uint256 _actualBurnAmount) {
        // Approve the LP tokens for the pair using permit
        _withPermit(
            IPairFactory(factory_).getPairAddress(_tokens, PAIR_TYPE_),
            _maxBurnAmount,
            _deadline,
            _approveMax,
            _v,
            _r,
            _s
        );

        // Remove liquidity with imbalanced amounts of tokens from a pair and receive ETH
        _actualBurnAmount = removeLiquidityImbalanceETH(_tokens, _amounts, _maxBurnAmount, _to, _deadline);
    }

    /**
     * @dev Swap tokens through a route
     * @param _route The route to swap through
     * @param _amountIn The amount of tokens to swap in
     * @param _amountOutMin The minimum amount of tokens to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline to swap by
     * @return _amountOut The actual amount of tokens received
     */
    function swap(
        Route memory _route,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 _deadline
    ) external payable override returns (uint256 _amountOut) {
        // Ensure that the pair exists
        require(IPairFactory(factory_).isPair(_route.pair), "StableRouter: is not pair");

        // Approve the pair to spend the input token
        _route.from.safeApprove(_route.pair, _amountIn);

        // Swap the tokens through the route
        _amountOut = IStablePair(_route.pair).swap(_route.from, _route.to, _amountIn, _amountOutMin, _to, _deadline);
    }
}
