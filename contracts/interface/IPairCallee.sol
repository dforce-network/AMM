// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IPairCallee {
    function hook(address sender, uint256 amountOut0, uint256 amountOut1, bytes calldata data) external;
}
