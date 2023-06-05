// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./utils/TransferHelper.sol";

import "./interface/IWETH.sol";
import "./interface/IPair.sol";
import "./interface/IPairRouter.sol";
import "./interface/IPairFactory.sol";

/**
 * @title Router contract
 * @dev This contract handles the routing of tokens in the dForce AMM ecosystem
 */
contract Router is Initializable {
    using Address for address;
    using TransferHelper for address;

    /**
     * @dev Struct to represent a route between two tokens
     */
    struct Route {
        address from; // Address of the token to convert from
        address to; // Address of the token to convert to
        address pair; // Address of the pair contract that connects the two tokens
    }

    /**
     * @dev Address of the factory contract
     */
    address public factory;

    /**
     * @dev Address of the WETH contract
     */
    IWETH internal weth_;

    /**
     * @dev Mapping of pair types to their respective router contracts
     */
    mapping(uint8 => address) internal pairTypes_;

    /**
     * @dev Event emitted when a pair type is set
     */
    event SetPairTypes(uint8 pairType, address router);

    /**
     * @dev Constructor function for the Router contract
     * @param _factory Address of the factory contract
     * @param _weth Address of the WETH contract
     */
    constructor(address _factory, address _weth) public {
        initialize(_factory, _weth);
    }

    /**
     * @dev Initializes the Router contract
     * @param _factory Address of the factory contract
     * @param _weth Address of the WETH contract
     */
    function initialize(address _factory, address _weth) public initializer {
        factory = _factory;
        weth_ = IWETH(_weth);
    }

    /**
     * @dev Fallback function to receive ETH from WETH contract
     */
    receive() external payable {
        assert(msg.sender == address(weth_)); // only accept ETH via fallback from the WETH contract
    }

    /**
     * @dev Modifier to restrict access to only the manager
     */
    modifier onlyManager() {
        require(msg.sender == IPairFactory(factory).manager(), "Router: not manager");
        _;
    }

    /**
     * @dev Modifier to check if the given pair type is valid
     * @param _pairType The pair type to check
     */
    modifier checkPairType(uint8 _pairType) {
        require(pairTypes_[_pairType] != address(0), "Router: invalid pair type");
        _;
    }

    /**
     * @dev Returns the address of the WETH contract
     */
    function weth() external view returns (address) {
        return address(weth_);
    }

    /**
     * @dev Returns the address of the router contract for a given pair type
     * @param _pairType The pair type
     */
    function pairTypes(uint8 _pairType) external view returns (address) {
        return pairTypes_[_pairType];
    }

    /**
     * @dev Returns the amount of tokens that will be received for a given input amount and route
     * @param _amountIn The input amount
     * @param _routes The route to take
     * @return _amounts The amounts of tokens that will be received
     */
    function _getAmountsOut(uint256 _amountIn, Route[] memory _routes)
        internal
        view
        returns (uint256[] memory _amounts)
    {
        _amounts = new uint256[](_routes.length + 1);
        _amounts[0] = _amountIn;

        for (uint256 i = 0; i < _routes.length; i++)
            _amounts[i + 1] = IPair(_routes[i].pair).getAmountOut(_routes[i].from, _routes[i].to, _amounts[i]);
    }

    /**
     * @dev Returns the amount of tokens that will be received for a given input amount and route
     * @param _amountIn The input amount
     * @param _routes The route to take
     */
    function getAmountsOutPath(uint256 _amountIn, Route[] memory _routes)
        external
        view
        returns (uint256[] memory _amounts)
    {
        _amounts = _getAmountsOut(_amountIn, _routes);
    }

    /**
     * @dev Returns the amount of tokens that will be received for a given input amount and route
     * @param _amountIn The input amount
     * @param _routes The route to take
     */
    function getAmountsOut(uint256 _amountIn, Route[] memory _routes) external view returns (uint256) {
        require(_routes.length >= 1, "Router: INVALID_PATH");
        uint256[] memory _amounts = _getAmountsOut(_amountIn, _routes);
        return _amounts[_amounts.length - 1];
    }

    /**
     * @dev Returns the address of the pair for the given tokens and pair type
     * @param _tokens The tokens to get the pair address for
     * @param _type The pair type
     * @return _pair The address of the pair
     * @return _has Whether or not the pair exists
     */
    function pairFor(address[] memory _tokens, uint8 _type) external view returns (address _pair, bool _has) {
        _pair = IPairFactory(factory).getPairAddress(_tokens, _type);
        _has = IPairFactory(factory).isPair(_pair);
    }

    /**
     * @dev Returns the reserves of the volatile pair for the given tokens
     * @param _tokens The tokens to get the reserves for
     * @return _reserveA The reserve of token A
     * @return _reserveB The reserve of token B
     */
    function getReserves(address[] memory _tokens) external view returns (uint256 _reserveA, uint256 _reserveB) {
        address _pair = IPairFactory(factory).getPairAddress(_tokens, 1);
        if (IPairFactory(factory).isPair(_pair))
            (_reserveA, _reserveB) = IVolatileRouter(pairTypes_[1]).getReserves(_pair, _tokens);
    }

    /**
     * @dev Returns the amount of tokens required to add liquidity to a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token to add liquidity for
     */
    function quoteAddLiquidity(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amountDesireds
    ) external view returns (uint256[] memory _amountIn, uint256 liquidity) {
        address _router = pairTypes_[_pairType];
        bytes memory _returns = _router.functionStaticCall(
            abi.encodeWithSelector(IPairRouter.quoteAddLiquidity.selector, _tokens, _amountDesireds)
        );
        (_amountIn, liquidity) = abi.decode(_returns, (uint256[], uint256));
    }

    /**
     * @dev Returns the amount of tokens that will be received when removing liquidity from a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     */
    function quoteRemoveLiquidity(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity
    ) external view returns (uint256[] memory _amounts) {
        address _router = pairTypes_[_pairType];
        bytes memory _returns = _router.functionStaticCall(
            abi.encodeWithSelector(IPairRouter.quoteRemoveLiquidity.selector, _tokens, _liquidity)
        );
        _amounts = abi.decode(_returns, (uint256[]));
    }

    /**
     * @dev Returns the amount of a specific token that will be received when removing liquidity from a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _token The token to receive
     * @param _liquidity The amount of liquidity to remove
     */
    function quoteRemoveLiquidityOneToken(
        uint8 _pairType,
        address[] calldata _tokens,
        address _token,
        uint256 _liquidity
    ) external view returns (uint256 _amount) {
        address _router = pairTypes_[_pairType];
        bytes memory _returns = _router.functionStaticCall(
            abi.encodeWithSelector(IStablPairRouter.quoteRemoveLiquidityOneToken.selector, _tokens, _token, _liquidity)
        );
        _amount = abi.decode(_returns, (uint256));
    }

    /**
     * @dev Returns the amount of tokens that will be removed when removing liquidity from a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The desired amounts of each token to remove liquidity for
     */
    function quoteRemoveLiquidityImbalance(
        uint8 _pairType,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external view returns (uint256 _amount) {
        address _router = pairTypes_[_pairType];
        bytes memory _returns = _router.functionStaticCall(
            abi.encodeWithSelector(IStablPairRouter.quoteRemoveLiquidityImbalance.selector, _tokens, _amounts)
        );
        _amount = abi.decode(_returns, (uint256));
    }

    /**
     * @dev Adds liquidity to a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token to add liquidity for
     * @param _amountsMin The minimum amounts of each token to add liquidity for
     * @param _minLiquidity The minimum liquidity to add
     * @param _to The address to send the liquidity to
     * @param _deadline The deadline for the transaction
     * @return _amounts The amounts of tokens added
     * @return _liquidity The amount of liquidity added
     */
    function addLiquidity(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256[] memory _amounts, uint256 _liquidity) {
        (_amounts, _liquidity) = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.addLiquidity.selector,
                    _tokens,
                    _amountDesireds,
                    _amountsMin,
                    _minLiquidity,
                    _to,
                    _deadline
                )
            ),
            (uint256[], uint256)
        );
    }

    /**
     * @dev Adds liquidity to a given pair with ETH
     * @param _pairType The pair type
     * @param _tokens The tokens to add liquidity for
     * @param _amountDesireds The desired amounts of each token to add liquidity for
     * @param _amountsMin The minimum amounts of each token to add liquidity for
     * @param _minLiquidity The minimum liquidity to add
     * @param _to The address to send the liquidity to
     * @param _deadline The deadline for the transaction
     * @return _amounts The amounts of tokens added
     * @return _liquidity The amount of liquidity added
     */
    function addLiquidityETH(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external payable checkPairType(_pairType) returns (uint256[] memory _amounts, uint256 _liquidity) {
        (_amounts, _liquidity) = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.addLiquidityETH.selector,
                    _tokens,
                    _amountDesireds,
                    _amountsMin,
                    _minLiquidity,
                    _to,
                    _deadline
                )
            ),
            (uint256[], uint256)
        );
    }

    /**
     * @dev Removes liquidity from a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @return _amounts The amounts of tokens received
     */
    function removeLiquidity(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256[] memory _amounts) {
        _amounts = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.removeLiquidity.selector,
                    _tokens,
                    _liquidity,
                    _amountsMin,
                    _to,
                    _deadline
                )
            ),
            (uint256[])
        );
    }

    /**
     * @dev Removes liquidity from a given pair with ETH
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to receive
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @return _amounts The amounts of tokens received
     */
    function removeLiquidityETH(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256[] memory _amounts) {
        _amounts = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.removeLiquidityETH.selector,
                    _tokens,
                    _liquidity,
                    _amountsMin,
                    _to,
                    _deadline
                )
            ),
            (uint256[])
        );
    }

    /**
     * @dev Removes liquidity for a single token from a given pair
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of token to receive
     * @param _to The address to send the token to
     * @param _deadline The deadline for the transaction
     * @return _amount The amount of token received
     */
    function removeLiquidityOneToken(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256 _amount) {
        _amount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityOneToken.selector,
                    _tokens,
                    _liquidity,
                    _token,
                    _minAmount,
                    _to,
                    _deadline
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity for a single token from a given pair with ETH
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to receive
     * @param _minAmount The minimum amount of token to receive
     * @param _to The address to send the token to
     * @param _deadline The deadline for the transaction
     * @return _amount The amount of token received
     */
    function removeLiquidityOneTokenETH(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256 _amount) {
        _amount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityOneTokenETH.selector,
                    _tokens,
                    _liquidity,
                    _token,
                    _minAmount,
                    _to,
                    _deadline
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity from a given pair with an imbalance of tokens
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of each token to remove
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @return _amount The amount of liquidity removed
     */
    function removeLiquidityImbalance(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] calldata _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256 _amount) {
        _amount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityImbalance.selector,
                    _tokens,
                    _amounts,
                    _maxBurnAmount,
                    _to,
                    _deadline
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity from a given pair with an imbalance of ETH and tokens
     * @param _pairType The type of pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of each token to remove
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @return _amount The amount of liquidity removed
     */
    function removeLiquidityImbalanceETH(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] calldata _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) external checkPairType(_pairType) returns (uint256 _amount) {
        _amount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityImbalanceETH.selector,
                    _tokens,
                    _amounts,
                    _maxBurnAmount,
                    _to,
                    _deadline
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity from a given pair with a permit
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _amounts The amounts of tokens removed
     */
    function removeLiquidityWithPermit(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external checkPairType(_pairType) returns (uint256[] memory _amounts) {
        _amounts = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.removeLiquidityWithPermit.selector,
                    _tokens,
                    _liquidity,
                    _amountsMin,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256[])
        );
    }

    /**
     * @dev Removes liquidity from a given pair with a permit
     * @param _pairType The pair type
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _amountsMin The minimum amounts of each token to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _amounts The amounts of tokens removed
     */
    function removeLiquidityETHWithPermit(
        uint8 _pairType,
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external checkPairType(_pairType) returns (uint256[] memory _amounts) {
        _amounts = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.removeLiquidityETHWithPermit.selector,
                    _tokens,
                    _liquidity,
                    _amountsMin,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256[])
        );
    }

    /**
     * @dev Removes liquidity for a single token with a permit
     * @param _pairType The type of pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to remove liquidity for
     * @param _minAmount The minimum amount of tokens to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _tokenAmount The amount of tokens removed
     */
    function removeLiquidityOneTokenWithPermit(
        uint8 _pairType,
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
    ) external returns (uint256 _tokenAmount) {
        require(pairTypes_[_pairType] != address(0), "Router: invalid pair type");
        _tokenAmount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityOneTokenWithPermit.selector,
                    _tokens,
                    _liquidity,
                    _token,
                    _minAmount,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity for a single token with a permit
     * @param _pairType The type of pair
     * @param _tokens The tokens to remove liquidity for
     * @param _liquidity The amount of liquidity to remove
     * @param _token The token to remove liquidity for
     * @param _minAmount The minimum amount of tokens to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _tokenAmount The amount of tokens removed
     */
    function removeLiquidityOneTokenETHWithPermit(
        uint8 _pairType,
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
    ) external returns (uint256 _tokenAmount) {
        require(pairTypes_[_pairType] != address(0), "Router: invalid pair type");
        _tokenAmount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityOneTokenETHWithPermit.selector,
                    _tokens,
                    _liquidity,
                    _token,
                    _minAmount,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity imbalance for multiple tokens with a permit
     * @param _pairType The type of pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _actualBurnAmount The actual amount of liquidity removed
     */
    function removeLiquidityImbalanceWithPermit(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external checkPairType(_pairType) returns (uint256 _actualBurnAmount) {
        _actualBurnAmount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityImbalanceWithPermit.selector,
                    _tokens,
                    _amounts,
                    _maxBurnAmount,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Removes liquidity imbalance for multiple tokens with a permit
     * @param _pairType The type of pair
     * @param _tokens The tokens to remove liquidity for
     * @param _amounts The amounts of tokens to remove
     * @param _maxBurnAmount The maximum amount of liquidity to remove
     * @param _to The address to send the tokens to
     * @param _deadline The deadline for the transaction
     * @param _approveMax Whether to approve the maximum amount
     * @param _v The v value of the permit signature
     * @param _r The r value of the permit signature
     * @param _s The s value of the permit signature
     * @return _actualBurnAmount The actual amount of liquidity removed
     */
    function removeLiquidityImbalanceETHWithPermit(
        uint8 _pairType,
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline,
        bool _approveMax,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external checkPairType(_pairType) returns (uint256 _actualBurnAmount) {
        _actualBurnAmount = abi.decode(
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IStablPairRouter.removeLiquidityImbalanceETHWithPermit.selector,
                    _tokens,
                    _amounts,
                    _maxBurnAmount,
                    _to,
                    _deadline,
                    _approveMax,
                    _v,
                    _r,
                    _s
                )
            ),
            (uint256)
        );
    }

    /**
     * @dev Swaps tokens through multiple pairs
     * @param _routes The routes to swap through
     * @param _amountIn The amount of tokens to swap
     * @param _amountOutMin The minimum amount of tokens to receive
     * @param _to The address to send the swapped tokens to
     * @param _deadline The deadline for the transaction
     * @return _amountOut The amount of tokens received
     */
    function swap(
        Route[] memory _routes,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 _deadline
    ) external returns (uint256 _amountOut) {
        // Get the amounts of tokens to receive for each pair in the route
        uint256[] memory _amounts = _getAmountsOut(_amountIn, _routes);
        // Ensure that the amount of tokens received is greater than or equal to the minimum amount specified
        require(_amounts[_amounts.length - 1] >= _amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");
        // Transfer the input tokens from the sender to this contract
        _routes[0].from.safeTransferFrom(msg.sender, address(this), _amountIn);
        // Swap the tokens through each pair in the route
        for (uint256 i = 0; i < _routes.length; i++) {
            // Get the pair type for the current pair in the route
            uint8 _pairType = IPair(_routes[i].pair).PAIR_TYPE();
            // Set the receiver address for the current pair in the route
            address _receiver = address(this);
            if (i == _routes.length - 1) _receiver = _to;

            // Call the swap function on the router contract for the current pair in the route
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.swap.selector,
                    _routes[i],
                    _amounts[i],
                    _amounts[i + 1],
                    _receiver,
                    _deadline
                )
            );
        }
        // Set the amount of tokens received to the output amount
        _amountOut = _amounts[_amounts.length - 1];
    }

    /**
     * @dev Swaps ETH for tokens through multiple pairs
     * @param _routes The routes to swap through
     * @param _amountIn The amount of ETH to swap
     * @param _amountOutMin The minimum amount of tokens to receive
     * @param _to The address to send the swapped tokens to
     * @param _deadline The deadline for the transaction
     * @return _amountOut The amount of tokens received
     */
    function swapETH(
        Route[] memory _routes,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 _deadline
    ) external payable returns (uint256 _amountOut) {
        // Get the amounts of tokens to receive for each pair in the route
        uint256[] memory _amounts = _getAmountsOut(_amountIn, _routes);
        // Ensure that the amount of tokens received is greater than or equal to the minimum amount specified
        require(_amounts[_amounts.length - 1] >= _amountOutMin, "Router: INSUFFICIENT_OUTPUT_AMOUNT");

        // If the input token is WETH, ensure that the amount of ETH sent is equal to the amount to swap
        if (_routes[0].from == address(weth_)) {
            require(msg.value == _amountIn, "Router: msg.value is not equal to _amountIn");
            // Deposit the ETH into WETH
            weth_.deposit{ value: msg.value }();
        } else {
            require(msg.value == 0, "Router: msg.value is not equal to 0");
            // Transfer the input tokens from the sender to this contract
            _routes[0].from.safeTransferFrom(msg.sender, address(this), _amountIn);
        }

        // Swap the tokens through each pair in the route
        for (uint256 i = 0; i < _routes.length; i++) {
            // Get the pair type for the current pair in the route
            uint8 _pairType = IPair(_routes[i].pair).PAIR_TYPE();
            // Set the receiver address for the current pair in the route
            address _receiver = address(this);
            if (i == _routes.length - 1 && _routes[i].to != address(weth_)) _receiver = _to;

            // Call the swap function on the router contract for the current pair in the route
            pairTypes_[_pairType].functionDelegateCall(
                abi.encodeWithSelector(
                    IPairRouter.swap.selector,
                    _routes[i],
                    _amounts[i],
                    _amounts[i + 1],
                    _receiver,
                    _deadline
                )
            );
        }
        // Set the amount of tokens received to the output amount
        _amountOut = _amounts[_amounts.length - 1];

        // If the output token is WETH, withdraw the WETH and transfer the ETH to the recipient
        if (_routes[_routes.length - 1].to == address(weth_)) {
            weth_.withdraw(_amountOut);
            _to.safeTransferETH(_amountOut);
        }
    }

    /**
     * @dev Sets the pair types for the router contract
     * @param _pairRouter The address of the pair router contract
     */
    function setPairTypes(address _pairRouter) external onlyManager {
        // Get the pair type for the pair router contract
        uint8 _pairType = IPairRouter(_pairRouter).PAIR_TYPE();
        // Set the pair type for the router contract
        pairTypes_[_pairType] = _pairRouter;
        // Emit an event indicating that the pair types have been set
        emit SetPairTypes(_pairType, _pairRouter);
    }
}
