//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

library ERC20Call {
    /**
     * @dev Get the symbol of the ERC20 token
     * @param _token The address of the ERC20 token
     * @return _symbol The symbol of the ERC20 token
     */
    function callSymbol(address _token) internal view returns (string memory _symbol) {
        if (_token != address(0)) {
            (bool _success, bytes memory _res) = _token.staticcall(abi.encodeWithSignature("symbol()"));
            if (_success)
                _symbol = _res.length == 32 ? bytes32ToString(abi.decode(_res, (bytes32))) : abi.decode(_res, (string));
        }
    }

    /**
     * @dev Convert bytes32 to string
     * @param _bytes32 The bytes32 to be converted
     * @return _result The converted string
     */
    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory _result) {
        uint8 _length = 0;
        while (_bytes32[_length] != 0 && _length < 32) {
            _length++;
        }
        assembly {
            _result := mload(0x40)
            // new "memory end" including padding (the string isn't larger than 32 bytes)
            mstore(0x40, add(_result, 0x40))
            // store length in memory
            mstore(_result, _length)
            // write actual data
            mstore(add(_result, 0x20), _bytes32)
        }
    }
}
