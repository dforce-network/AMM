//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IPairFactory {
    function allPairsLength() external view returns (uint256);

    function isPair(address _pair) external view returns (bool);

    function manager() external view returns (address);

    function getPairAddress(address[] memory _tokens, uint8 _type) external view returns (address);

    function pairTypeValues() external view returns (address[] memory);

    function atPairType(uint256 _index) external view returns (address);

    function createPair(address[] memory _tokens, uint8 _pairType, bytes memory _data) external returns (address _pair);
}
