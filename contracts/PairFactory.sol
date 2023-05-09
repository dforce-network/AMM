// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./interface/IPairFactory.sol";

import "./utils/Arrays.sol";
import { IPair } from "./interface/IPair.sol";

/**
 * @title PairFactory
 * @dev This contract is responsible for creating and managing pairs.
 */
contract PairFactory is IPairFactory, Initializable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Arrays for address[];

    // Maximum swap fee and admin fee rates
    uint256 public constant MAX_SWAP_FEE = 10 ** 8;
    uint256 public constant MAX_ADMIN_FEE = 10 ** 10;

    // Address of the current manager
    address public override manager;

    // Address of the pending manager
    address public pendingManager;

    // Default swap fee rate
    uint256 public defSwapFeeRate;

    // Default admin fee rate
    uint256 public defAdminFeeRate;

    // Mapping of pair addresses to boolean values indicating whether the pair exists
    mapping(address => bool) public override isPair;

    // Array of all pair addresses
    address[] public allPairs;

    // Set of pair implementation addresses
    EnumerableSet.AddressSet internal pairImpls_;

    //1: volatile pair, 2: stable pair, 3: yeild pair
    // Struct to store pair implementation and authorization status
    struct PairParams {
        address impl; // Address of the pair implementation
        bool auth; // Authorization status of the pair
    }
    // Mapping of pair type to pair implementation and authorization status
    mapping(uint8 => PairParams) public pairParams;

    /**
     * @dev Event emitted when a new pair is created.
     * @param tokens The tokens in the new pair.
     * @param pairType The type of the new pair.
     * @param pair The address of the new pair.
     * @param pairsAmount The total number of pairs.
     */
    event PairCreated(address[] tokens, uint8 pairType, address pair, uint256 pairsAmount);

    /**
     * @dev Event emitted when a new manager is pending.
     * @param manager The current manager.
     * @param pendingManager The new pending manager.
     */
    event SetPendingManager(address manager, address pendingManager);

    /**
     * @dev Event emitted when the manager is changed.
     * @param oldManager The old manager.
     * @param newManager The new manager.
     */
    event ChangeManager(address oldManager, address newManager);

    /**
     * @dev Event emitted when the default swap fee rate is changed.
     * @param oldDefSwapFeeRate The old default swap fee rate.
     * @param newDefSwapFeeRate The new default swap fee rate.
     */
    event SetDefSwapFeeRate(uint256 oldDefSwapFeeRate, uint256 newDefSwapFeeRate);

    /**
     * @dev Event emitted when the default admin fee rate is changed.
     * @param oldDefAdminFeeRate The old default admin fee rate.
     * @param newDefAdminFeeRate The new default admin fee rate.
     */
    event SetDefAdminFeeRate(uint256 oldDefAdminFeeRate, uint256 newDefAdminFeeRate);

    /**
     * @dev Event emitted when a new pair type is added.
     * @param impl The address of the pair implementation.
     * @param pairType The type of the new pair.
     * @param auth The authorization status of the new pair.
     * @param oldImpl The address of the old pair implementation.
     */
    event SetPairType(address impl, uint8 pairType, bool auth, address oldImpl);

    /**
     * @dev Event emitted when a pair type is removed.
     * @param impl The address of the pair implementation.
     * @param pairType The type of the pair to be removed.
     * @param auth The authorization status of the pair to be removed.
     */
    event RemovePairType(address impl, uint8 pairType, bool auth);

    /**
     * @dev Constructor function that initializes the default swap fee rate and default admin fee rate.
     * @param _defSwapFeeRate The default swap fee rate.
     * @param _defAdminFeeRate The default admin fee rate.
     */
    constructor(uint256 _defSwapFeeRate, uint256 _defAdminFeeRate) public {
        initialize(_defSwapFeeRate, _defAdminFeeRate);
    }

    /**
     * @dev Function that initializes the default swap fee rate, default admin fee rate, and manager.
     * @param _defSwapFeeRate The default swap fee rate.
     * @param _defAdminFeeRate The default admin fee rate.
     */
    function initialize(uint256 _defSwapFeeRate, uint256 _defAdminFeeRate) public initializer {
        manager = msg.sender;
        setDefSwapFeeRate(_defSwapFeeRate);
        setDefAdminFeeRate(_defAdminFeeRate);
    }

    /**
     * @dev Modifier that checks if the caller is the manager.
     */
    modifier onlyManager() {
        require(msg.sender == manager, "PairFactory: not manager");
        _;
    }

    /**
     * @dev Function that returns the length of the allPairs array.
     * @return The length of the allPairs array.
     */
    function allPairsLength() external view override returns (uint256) {
        return allPairs.length;
    }

    /**
     * @dev Function that checks if a pair with the given address exists.
     * @param value The address of the pair to check.
     * @return A boolean indicating whether the pair exists or not.
     */
    function containsPair(address value) external view returns (bool) {
        return pairImpls_.contains(value);
    }

    /**
     * @dev Function that returns an array of all pair implementation addresses.
     * @return _pairImpls An array of all pair implementation addresses.
     */
    function pairTypeValues() external view override returns (address[] memory _pairImpls) {
        uint256 _len = pairImpls_.length();
        _pairImpls = new address[](_len);
        for (uint256 i = 0; i < _len; i++) {
            _pairImpls[i] = pairImpls_.at(i);
        }
        return _pairImpls;
    }

    /**
     * @dev Function that returns the number of pair implementations.
     * @return The number of pair implementations.
     */
    function pairTypeAmount() external view returns (uint256) {
        return pairImpls_.length();
    }

    /**
     * @dev Function that returns the pair implementation address at the given index.
     * @param _index The index of the pair implementation address to return.
     * @return The pair implementation address at the given index.
     */
    function atPairType(uint256 _index) external view override returns (address) {
        return pairImpls_.at(_index);
    }

    /**
     * @dev Function that returns the pair address for the given tokens and pair type.
     * @param _tokens The tokens to create the pair with.
     * @param _pairType The type of the pair to create.
     * @return The pair address for the given tokens and pair type.
     */
    function getPairAddress(address[] memory _tokens, uint8 _pairType) public view override returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(_tokens.sortArray(), _pairType));
        return Clones.predictDeterministicAddress(pairParams[_pairType].impl, salt);
    }

    /**
     * @dev Function that creates a new pair with the given tokens and pair type.
     * @param _tokens The tokens to create the pair with.
     * @param _pairType The type of the pair to create.
     * @param _data Additional data to pass to the pair's `initialize` function.
     * @return _pair The address of the newly created pair.
     */
    function createPair(
        address[] memory _tokens,
        uint8 _pairType,
        bytes memory _data
    ) external override returns (address _pair) {
        _tokens = _tokens.sortArray();
        require(pairParams[_pairType].impl != address(0), "PairFactory: No impl of this type");
        require(!isPair[getPairAddress(_tokens, _pairType)], "PairFactory: Pair already exists");

        bytes32 salt = keccak256(abi.encodePacked(_tokens, _pairType));

        PairParams memory _params = pairParams[_pairType];
        if (_pairType == 1) {
            _data = abi.encode(defSwapFeeRate, defAdminFeeRate);
        }
        if (_params.auth) {
            require(manager == msg.sender, "PairFactory: this pair type can only be created by manager");
        }
        _pair = Clones.cloneDeterministic(_params.impl, salt);

        IPair(_pair).initialize(_tokens, _data);

        allPairs.push(_pair);
        isPair[_pair] = true;

        emit PairCreated(_tokens, _pairType, _pair, allPairs.length);
    }

    /**
     * @dev Function that sets the pending manager address.
     * @param _pendingManager The address of the pending manager.
     */
    function setPendingManager(address _pendingManager) external onlyManager {
        require(manager != _pendingManager && pendingManager != _pendingManager, "PairFactory: manager has been set");

        pendingManager = _pendingManager;

        emit SetPendingManager(manager, _pendingManager);
    }

    /**
     * @dev Function that accepts the pending manager address.
     */
    function acceptManager() external {
        require(msg.sender == pendingManager, "PairFactory: not pending fee manager");
        address _oldManager = manager;

        manager = pendingManager;
        pendingManager = address(0);

        emit ChangeManager(_oldManager, manager);
    }

    /**
     * @dev Function that sets the default swap fee rate.
     * @param _defSwapFeeRate The new default swap fee rate.
     */
    function setDefSwapFeeRate(uint256 _defSwapFeeRate) public onlyManager {
        require(_defSwapFeeRate <= MAX_SWAP_FEE, "PairFactory: Over MAX_SWAP_FEE is not allowed");

        uint256 _oldDefSwapFeeRate = defSwapFeeRate;
        require(_defSwapFeeRate != _oldDefSwapFeeRate, "PairFactory: _defSwapFeeRate invalid");

        defSwapFeeRate = _defSwapFeeRate;

        emit SetDefSwapFeeRate(_oldDefSwapFeeRate, _defSwapFeeRate);
    }

    /**
     * @dev Function that sets the default admin fee rate.
     * @param _defAdminFeeRate The new default admin fee rate.
     */
    function setDefAdminFeeRate(uint256 _defAdminFeeRate) public onlyManager {
        require(_defAdminFeeRate <= MAX_ADMIN_FEE, "PairFactory: Over MAX_ADMIN_FEE is not allowed");

        uint256 _oldDefAdminFeeRate = defAdminFeeRate;
        require(_defAdminFeeRate != _oldDefAdminFeeRate, "PairFactory: _defAdminFeeRate invalid");

        defAdminFeeRate = _defAdminFeeRate;

        emit SetDefAdminFeeRate(_oldDefAdminFeeRate, _defAdminFeeRate);
    }

    /**
     * @dev Function that adds a new pair type.
     * @param _impl The address of the pair implementation.
     */
    function addPairType(address _impl) external onlyManager {
        uint8 _type = IPair(_impl).PAIR_TYPE();
        bool _auth = IPair(_impl).AUTH();

        require(pairImpls_.add(_impl), "PairFactory: This pair already exists");

        require(pairParams[_type].impl == address(0), "PairFactory: This pair type already exists");

        pairParams[_type] = PairParams({ impl: _impl, auth: _auth });

        emit SetPairType(_impl, _type, _auth, address(0));
    }

    /**
     * @dev Function that removes a pair type.
     * @param _impl The address of the pair implementation.
     */
    function removePairType(address _impl) external onlyManager {
        require(pairImpls_.contains(_impl), "PairFactory: This pair does not exist");

        uint8 _type = IPair(_impl).PAIR_TYPE();

        pairImpls_.remove(_impl);
        PairParams memory _old = pairParams[_type];
        delete pairParams[_type];

        emit RemovePairType(_impl, _type, _old.auth);
    }
}
