// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/// @title Interface for WETH9
interface IWETH {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;

    function transfer(address to, uint256 value) external returns (bool);
}
