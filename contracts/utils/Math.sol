// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    /**
     * @dev Returns the minimum value between two uints.
     */
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    /**
     * @dev Babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
     * for computing the square root of a given uint.
     */
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
