// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) public ERC20(name_, symbol_) {}

    function allocateTo(address _usr, uint256 _value) public {
        _mint(_usr, _value);
    }
}
