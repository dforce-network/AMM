// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interface/IPairCallee.sol";
import "../interface/IPair.sol";
import "../interface/IPairFactory.sol";
import "../interface/IPairERC20.sol";
import "hardhat/console.sol";

contract MockRouter is IPairCallee {
    address private immutable factory;

    constructor(address _factory) public {
        factory = _factory;
    }

    function callSwap(
        address _pair,
        bool _order,
        uint256 _amount,
        bytes memory _data
    ) external {
        address _token0 = IVolatilePair(_pair).token0();
        address _token1 = IVolatilePair(_pair).token1();
        address _from = _order ? _token0 : _token1;
        address _to = _order ? _token1 : _token0;

        uint256 _amountOut = IVolatilePair(_pair).getAmountOut(_from, _to, _amount);
        uint256 amountOut0 = _order ? 0 : _amountOut;
        uint256 amountOut1 = _order ? _amountOut : 0;

        IVolatilePair(_pair).swap(amountOut0, amountOut1, address(this), _data);
    }

    function hook(
        address,
        uint256,
        uint256,
        bytes calldata data
    ) external override {
        require(IPairFactory(factory).isPair(msg.sender), "error caller");

        (uint256 _reserve0, uint256 _reserve1, ) = IVolatilePair(msg.sender).getReserves();
        (uint256 _balance0, uint256 _balance1) = IVolatilePair(msg.sender).getRealBalanceOf();

        (uint256 _amount0, uint256 _amount1) = (_balance0 - _reserve0, _balance1 - _reserve1);
        uint256 _action = abi.decode(data, (uint256));
        if (_action == 1) {
            IVolatilePair(msg.sender).mint(address(this));
        }
        if (_action == 2) {
            IVolatilePair(msg.sender).burn(address(this));
        }
        if (_action == 3) {
            IVolatilePair(msg.sender).swap(_amount0, _amount1, address(this), new bytes(0));
        }
        if (_action == 4) {
            IVolatilePair(msg.sender).skim(address(this));
        }
        if (_action == 5) {
            IVolatilePair(msg.sender).sync();
        }
        if (_action == 6) {
            IVolatilePair(msg.sender).claimFees();
        }
    }
}
