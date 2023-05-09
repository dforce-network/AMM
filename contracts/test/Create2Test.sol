// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../VolatilePair.sol";

contract Create2Test {
    function getCreate2Address(
        address _factory,
        address[] memory _tokens,
        bool _stable,
        uint256 _fee
    ) public pure returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_tokens, _stable, _fee));

        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                _factory,
                                salt,
                                keccak256(abi.encodePacked(type(VolatilePair).creationCode))
                            )
                        )
                    )
                )
            );
    }
}
