// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IPair {
    function initialize(address[] memory _tokens, bytes memory _data) external;

    function PAIR_TYPE() external view returns (uint8);

    function AUTH() external view returns (bool);

    function tokens() external view returns (address[] memory);

    function getAmountOut(address _from, address _to, uint256 _amount) external view returns (uint256);
}

interface IVolatilePair is IPair {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast);

    function mint(address _to) external returns (uint256 _liquidity);

    function burn(address _to) external returns (uint256 _amount0, uint256 _amount1);

    function swap(uint256 _amount0Out, uint256 _amount1Out, address _to, bytes calldata _data) external;

    function getRealBalanceOf() external view returns (uint256, uint256);

    function skim(address _to) external;

    function sync() external;

    function claimFees() external returns (uint256[] memory _adminFees);
}

interface IStablePair is IPair {
    function lpToken() external view returns (address);

    function calculateTokenAmount(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        bool _deposit
    ) external view returns (uint256);

    function calculateRemoveLiquidityOneToken(address _token, uint256 _liquidity) external view returns (uint256);

    function calculateRemoveLiquidity(
        address[] calldata _tokens,
        uint256 _amount
    ) external view returns (uint256[] memory);

    function addLiquidity(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        uint256 _minToMint,
        address _receiver,
        uint256 _deadline
    ) external returns (uint256);

    function removeLiquidity(
        uint256 _amount,
        address[] calldata _tokens,
        uint256[] calldata _minAmounts,
        address _receiver,
        uint256 _deadline
    ) external returns (uint256[] memory);

    function removeLiquidityOneToken(
        uint256 _tokenAmount,
        address _token,
        uint256 _minAmount,
        address _receiver,
        uint256 _deadline
    ) external returns (uint256);

    function removeLiquidityImbalance(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        uint256 _maxBurnAmount,
        address _receiver,
        uint256 _deadline
    ) external returns (uint256);

    function swap(
        address _tokenFrom,
        address _tokenTo,
        uint256 _dx,
        uint256 _minDy,
        address _receiver,
        uint256 _deadline
    ) external returns (uint256);
}
