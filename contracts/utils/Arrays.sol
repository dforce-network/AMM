//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @title Arrays
 * @dev Utility library of inline functions on arrays.
 */
library Arrays {
    /**
     * @dev Sorts an array of addresses in ascending order.
     * @param arr The input array.
     * @return The sorted array.
     */
    function sortArray(address[] memory arr) internal pure returns (address[] memory) {
        uint256 l = arr.length;
        for (uint256 i = 0; i < l; i++) {
            for (uint256 j = i + 1; j < l; j++) {
                if (arr[i] > arr[j]) {
                    address temp = arr[i];
                    arr[i] = arr[j];
                    arr[j] = temp;
                }
            }
        }
        return arr;
    }

    /**
     * @dev Copies an array of addresses and adds a new address to the end.
     * @param arr The input array.
     * @param add The address to add to the end of the array.
     * @return result The new array with the added address.
     */
    function copyAndAddOne(address[] memory arr, address add) internal pure returns (address[] memory result) {
        result = new address[](arr.length + 1);
        for (uint256 i = 0; i < arr.length; i++) {
            result[i] = arr[i];
        }
        result[arr.length] = add;
    }

    /**
     * @dev Removes any empty addresses from an array.
     * @param arr The input array.
     * @return newArr The new array with empty addresses removed.
     */
    function removeEmpty(address[] memory arr) internal pure returns (address[] memory newArr) {
        uint256 count;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] != address(0)) {
                count++;
            }
        }
        newArr = new address[](count);
        uint256 j;
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == address(0)) {
                continue;
            }
            newArr[j] = arr[i];
            j++;
        }
    }
}
