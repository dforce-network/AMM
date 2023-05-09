//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interface/IPairERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title PairERC20
 * @dev Abstract contract that implements the IPairERC20 interface and provides basic ERC20 functionality.
 */
abstract contract PairERC20 is IPairERC20 {
    using SafeMath for uint256;

    string public override name;
    string public override symbol;
    uint8 public constant override decimals = 18;

    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    bytes32 public override DOMAIN_SEPARATOR;

    // keccak256("Permit(address owner,address spender,uint256 chainId, uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant override PERMIT_TYPEHASH =
        0x576144ed657c8304561e56ca632e17751956250114636e8c01f64a7f2c6d98cf;

    mapping(address => uint256) public override nonces;

    /**
     * @dev Initializes the contract by setting the name and symbol of the token, as well as the domain separator for the permit function.
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     */
    function _initialize(string memory _name, string memory _symbol) internal {
        name = _name;
        symbol = _symbol;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                _getChainId(),
                address(this)
            )
        );
    }

    function _getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    /**
     * @dev Mints new tokens and adds them to the total supply.
     * @param to The address to which the new tokens will be minted.
     * @param value The amount of tokens to be minted.
     */
    function _mint(address to, uint256 value) internal {
        totalSupply = totalSupply.add(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(address(0), to, value);
    }

    /**
     * @dev Burns tokens and removes them from the total supply.
     * @param from The address from which the tokens will be burned.
     * @param value The amount of tokens to be burned.
     */
    function _burn(address from, uint256 value) internal {
        balanceOf[from] = balanceOf[from].sub(value);
        totalSupply = totalSupply.sub(value);
        emit Transfer(from, address(0), value);
    }

    /**
     * @dev Approves a spender to transfer tokens on behalf of the owner.
     * @param owner The address of the owner of the tokens.
     * @param spender The address of the spender to be approved.
     * @param value The amount of tokens to be approved for transfer.
     */
    function _approve(address owner, address spender, uint256 value) private {
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /**
     * @dev Transfers tokens from one address to another.
     * @param from The address from which the tokens will be transferred.
     * @param to The address to which the tokens will be transferred.
     * @param value The amount of tokens to be transferred.
     */
    function _transfer(address from, address to, uint256 value) internal virtual {
        balanceOf[from] = balanceOf[from].sub(value);
        balanceOf[to] = balanceOf[to].add(value);
        emit Transfer(from, to, value);
    }

    /**
     * @dev Approves a spender to transfer tokens on behalf of the owner.
     * @param spender The address of the spender to be approved.
     * @param value The amount of tokens to be approved for transfer.
     * @return A boolean indicating whether the approval was successful or not.
     */
    function approve(address spender, uint256 value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /**
     * @dev Transfers tokens from the caller's address to another address.
     * @param to The address to which the tokens will be transferred.
     * @param value The amount of tokens to be transferred.
     * @return A boolean indicating whether the transfer was successful or not.
     */
    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @dev Transfers tokens from one address to another, on behalf of the owner.
     * @param from The address from which the tokens will be transferred.
     * @param to The address to which the tokens will be transferred.
     * @param value The amount of tokens to be transferred.
     * @return A boolean indicating whether the transfer was successful or not.
     */
    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        if (allowance[from][msg.sender] != uint256(-1)) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev Approves a spender to transfer tokens on behalf of the owner, using a permit signature.
     * @param owner The address of the owner of the tokens.
     * @param spender The address of the spender to be approved.
     * @param value The amount of tokens to be approved for transfer.
     * @param deadline The deadline by which the permit must be used.
     * @param v The recovery byte of the permit signature.
     * @param r The R component of the permit signature.
     * @param s The S component of the permit signature.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(deadline >= block.timestamp, "PairERC20: EXPIRED");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, _getChainId(), value, nonces[owner]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, "PairERC20: INVALID_SIGNATURE");
        _approve(owner, spender, value);
    }
}
