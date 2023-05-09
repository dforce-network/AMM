// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IPairRouter {
    /**
     * @dev Struct representing a route between two tokens through a pair contract
     */
    struct Route {
        address from; // Address of the token to swap from
        address to; // Address of the token to swap to
        address pair; // Address of the pair contract to use for the swap
    }

    function PAIR_TYPE() external view returns (uint8);

    function quoteAddLiquidity(
        address[] calldata _tokens,
        uint256[] calldata _amountDesireds
    ) external view returns (uint256[] memory _amountIn, uint256 _liquidity);

    function quoteRemoveLiquidity(
        address[] calldata _tokens,
        uint256 _liquidity
    ) external view returns (uint256[] memory _amounts);

    function addLiquidity(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountsMin,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external returns (uint256[] memory _amounts, uint256 _liquidity);

    function addLiquidityETH(
        address[] memory _tokens,
        uint256[] memory _amountDesireds,
        uint256[] memory _amountMins,
        uint256 _minLiquidity,
        address _to,
        uint256 _deadline
    ) external payable returns (uint256[] memory _amounts, uint256 _liquidity);

    function removeLiquidity(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) external returns (uint256[] memory _amounts);

    function removeLiquidityETH(
        address[] memory _tokens,
        uint256 _liquidity,
        uint256[] memory _amountsMin,
        address _to,
        uint256 _deadline
    ) external returns (uint256[] memory _returns);

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
    ) external returns (uint256[] memory _amounts);

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
    ) external returns (uint256[] memory);

    function swap(
        Route memory _route,
        uint256 _amountIn,
        uint256 _amountOutMin,
        address _to,
        uint256 _deadline
    ) external payable returns (uint256 _amountOut);
}

interface IVolatileRouter is IPairRouter {
    function getReserves(
        address _pair,
        address[] calldata _tokens
    ) external view returns (uint256 _reserveA, uint256 _reserveB);
}

interface IStablPairRouter is IPairRouter {
    function quoteRemoveLiquidityOneToken(
        address[] calldata _tokens,
        address _token,
        uint256 _liquidity
    ) external view returns (uint256 _amount);

    function quoteRemoveLiquidityImbalance(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external view returns (uint256 _liquidity);

    function removeLiquidityOneToken(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) external returns (uint256 _tokenAmount);

    function removeLiquidityOneTokenETH(
        address[] memory _tokens,
        uint256 _liquidity,
        address _token,
        uint256 _minAmount,
        address _to,
        uint256 _deadline
    ) external returns (uint256 _tokenAmount);

    function removeLiquidityImbalance(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) external returns (uint256 _amount);

    function removeLiquidityImbalanceETH(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _maxBurnAmount,
        address _to,
        uint256 _deadline
    ) external returns (uint256 _amount);

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
    ) external returns (uint256 _tokenAmount);

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
    ) external returns (uint256 _tokenAmount);

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
    ) external returns (uint256 _actualBurnAmount);

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
    ) external returns (uint256 _actualBurnAmount);
}
