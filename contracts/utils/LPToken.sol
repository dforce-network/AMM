// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../lib/PairERC20.sol";

/**
 * @title Liquidity Provider Token
 * @notice This token is an ERC20 detailed token with added capability to be minted by the owner.
 * It is used to represent user's shares when providing liquidity to swap contracts.
 * @dev Only Swap contracts should initialize and own LPToken contracts.
 */
contract LPToken is OwnableUpgradeable, PairERC20 {
    /**
     * @notice Initializes this LPToken contract with the given name and symbol
     * @dev The caller of this function will become the owner. A Swap contract should call this
     * in its initializer function.
     * @param name name of this token
     * @param symbol symbol of this token
     */
    function initialize(string memory name, string memory symbol) external initializer returns (bool) {
        __Context_init_unchained();
        __Ownable_init_unchained();
        _initialize(name, symbol);
        return true;
    }

    /**
     * @dev Modifier to check if the recipient is not the contract itself
     */
    modifier addressCheck(address recipient) {
        require(recipient != address(this), "LPToken: cannot send to itself");
        _;
    }

    /**
     * @notice Mints the given amount of LPToken to the recipient.
     * @dev only owner can call this mint function
     * @param recipient address of account to receive the tokens
     * @param amount amount of tokens to mint
     */
    function mint(address recipient, uint256 amount) external onlyOwner addressCheck(recipient) {
        require(amount != 0, "LPToken: cannot mint 0");
        _mint(recipient, amount);
    }

    /**
     * @dev Overrides the _transfer function to check if the recipient is not the contract itself
     */
    function _transfer(address from, address to, uint256 value) internal override addressCheck(to) {
        super._transfer(from, to, value);
    }

    /**
     * @notice Burns the given amount of LPToken from the specified account
     * @param from address of account to burn tokens from
     * @param value amount of tokens to burn
     */
    function burnFrom(address from, uint256 value) external {
        if (allowance[from][msg.sender] != uint256(-1)) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _burn(from, value);
    }
}
