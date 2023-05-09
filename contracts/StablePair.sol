// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "./utils/SwapUtils.sol";
import "./utils/AmplificationUtils.sol";
import "./utils/ERC20Call.sol";
import "./interface/IPairERC20.sol";
import "./interface/IPairFactory.sol";
import "./interface/IPair.sol";

/**
 * @title Swap - A StableSwap implementation in solidity.
 * @notice This contract is responsible for custody of closely pegged assets (eg. group of stablecoins)
 * and automatic market making system. Users become an LP (Liquidity Provider) by depositing their tokens
 * in desired ratios for an exchange of the pool token that represents their share of the pool.
 * Users can burn pool tokens and withdraw their share of token(s).
 *
 * Each time a swap between the pooled tokens happens, a set fee incurs which effectively gets
 * distributed to the LPs.
 *
 * In case of emergencies, admin can pause additional deposits, swaps, or single-asset withdraws - which
 * stops the ratio of the tokens in the pool from changing.
 * Users can always withdraw their tokens via multi-asset withdraws.
 *
 * @dev Most of the logic is stored as a library `SwapUtils` for the sake of reducing contract's
 * deployment size.
 */
contract StablePair is Initializable, IStablePair {
    using SwapUtils for SwapUtils.Swap;
    using AmplificationUtils for SwapUtils.Swap;
    using ERC20Call for address;

    // The type of the pair
    uint8 public constant override PAIR_TYPE = 2;
    // Whether the pair is authorized
    bool public constant override AUTH = true;

    // The factory that created this pair
    address public factory;

    // A lock to prevent reentrancy
    uint256 private unlocked_;

    // Struct storing data responsible for automatic market maker functionalities. In order to
    // access this data, this contract uses SwapUtils library. For more details, see SwapUtils.sol
    SwapUtils.Swap public swapStorage;

    // Maps token address to an index in the pool. Used to prevent duplicate tokens in the pool.
    // getTokenIndex function also relies on this mapping to retrieve token index.
    mapping(address => uint8) internal tokenIndexes_;

    /*** EVENTS ***/

    // events replicated from SwapUtils to make the ABI easier for dumb
    // clients
    /**
     * @dev Event emitted when a token swap occurs.
     * @param buyer The address of the buyer.
     * @param tokensSold The amount of tokens sold.
     * @param tokensBought The amount of tokens bought.
     * @param soldId The ID of the sold token.
     * @param boughtId The ID of the bought token.
     */
    event TokenSwap(address indexed buyer, uint256 tokensSold, uint256 tokensBought, uint128 soldId, uint128 boughtId);

    /**
     * @dev Event emitted when liquidity is added to the pool.
     * @param provider The address of the liquidity provider.
     * @param tokenAmounts The amounts of tokens added.
     * @param fees The fees paid for adding liquidity.
     * @param invariant The invariant of the pool.
     * @param lpTokenSupply The total supply of LP tokens.
     */
    event AddLiquidity(
        address indexed provider,
        uint256[] tokenAmounts,
        uint256[] fees,
        uint256 invariant,
        uint256 lpTokenSupply
    );

    /**
     * @dev Event emitted when liquidity is removed from the pool.
     * @param provider The address of the liquidity provider.
     * @param tokenAmounts The amounts of tokens removed.
     * @param lpTokenSupply The total supply of LP tokens.
     */
    event RemoveLiquidity(address indexed provider, uint256[] tokenAmounts, uint256 lpTokenSupply);

    /**
     * @dev Event emitted when a single asset is removed from the pool.
     * @param provider The address of the liquidity provider.
     * @param lpTokenAmount The amount of LP tokens burned.
     * @param lpTokenSupply The total supply of LP tokens.
     * @param boughtId The ID of the bought token.
     * @param tokensBought The amount of tokens bought.
     */
    event RemoveLiquidityOne(
        address indexed provider,
        uint256 lpTokenAmount,
        uint256 lpTokenSupply,
        uint256 boughtId,
        uint256 tokensBought
    );

    /**
     * @dev Event emitted when liquidity is removed from the pool in an imbalanced way.
     * @param provider The address of the liquidity provider.
     * @param tokenAmounts The amounts of tokens removed.
     * @param fees The fees paid for removing liquidity.
     * @param invariant The invariant of the pool.
     * @param lpTokenSupply The total supply of LP tokens.
     */
    event RemoveLiquidityImbalance(
        address indexed provider,
        uint256[] tokenAmounts,
        uint256[] fees,
        uint256 invariant,
        uint256 lpTokenSupply
    );

    /**
     * @dev Event emitted when the swap fees are updated.
     * @param tokens The tokens in the pool.
     * @param swapFees The new swap fees.
     */
    event SwapFee(address[] tokens, uint256[] swapFees);

    /**
     * @dev Event emitted when the admin fee is updated.
     * @param newAdminFee The new admin fee.
     */
    event NewAdminFee(uint256 newAdminFee);

    /**
     * @dev Event emitted when the swap fee is updated.
     * @param newSwapFee The new swap fee.
     */
    event NewSwapFee(uint256 newSwapFee);

    /**
     * @dev Event emitted when the withdraw fee is updated.
     * @param newWithdrawFee The new withdraw fee.
     */
    event NewWithdrawFee(uint256 newWithdrawFee);

    /**
     * @dev Event emitted when the amplification coefficient is ramped.
     * @param oldA The old amplification coefficient.
     * @param newA The new amplification coefficient.
     * @param initialTime The initial time.
     * @param futureTime The future time.
     */
    event RampA(uint256 oldA, uint256 newA, uint256 initialTime, uint256 futureTime);

    /**
     * @dev Event emitted when the amplification coefficient ramp is stopped.
     * @param currentA The current amplification coefficient.
     * @param time The time.
     */
    event StopRampA(uint256 currentA, uint256 time);

    /**
     * @dev Initializes this StablePair contract with the given parameters.
     * @param _tokens an array of ERC20s this pool will accept
     * @param _data encoded parameters for the StablePair contract
     */
    function initialize(address[] calldata _tokens, bytes calldata _data) external override initializer {
        factory = msg.sender;
        unlocked_ = 1;
        string memory _lpTokenName = "dForce AMM Stable - ";
        string memory _lpTokenSymbol = "sAMM-";
        string memory _separator = "-";
        uint8[] memory _decimals = new uint8[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _decimals[i] = IPairERC20(_tokens[i]).decimals();
            string memory _tokenSymbol = _tokens[i].callSymbol();
            if (i == _tokens.length - 1) _separator = "";
            _lpTokenName = string(abi.encodePacked(_lpTokenName, _tokenSymbol, _separator));
            _lpTokenSymbol = string(abi.encodePacked(_lpTokenSymbol, _tokenSymbol, _separator));
        }

        (uint256 _swapFee, uint256 _adminFeeRate, uint256 _a, address _lpTokenTargetAddress) = abi.decode(
            _data,
            (uint256, uint256, uint256, address)
        );
        __SwapV2_init(
            _tokens,
            _decimals,
            _lpTokenName,
            _lpTokenSymbol,
            _a,
            _swapFee,
            _adminFeeRate,
            _lpTokenTargetAddress
        );
    }

    /**
     * @notice Initializes this Swap contract with the given parameters.
     * This will also clone a LPToken contract that represents users'
     * LP positions. The owner of LPToken will be this contract - which means
     * only this contract is allowed to mint/burn tokens.
     *
     * @param _pooledTokens an array of ERC20s this pool will accept
     * @param _decimals the decimals to use for each pooled token,
     * eg 8 for WBTC. Cannot be larger than POOL_PRECISION_DECIMALS
     * @param _lpTokenName the long-form name of the token to be deployed
     * @param _lpTokenSymbol the short symbol for the token to be deployed
     * @param _a the amplification coefficient * n * (n - 1). See the
     * StableSwap paper for details
     * @param _fee default swap fee to be initialized with
     * @param _adminFee default adminFee to be initialized with
     * @param _lpTokenTargetAddress the address of an existing LPToken contract to use as a target
     */
    function __SwapV2_init(
        address[] memory _pooledTokens,
        uint8[] memory _decimals,
        string memory _lpTokenName,
        string memory _lpTokenSymbol,
        uint256 _a,
        uint256 _fee,
        uint256 _adminFee,
        address _lpTokenTargetAddress
    ) internal virtual {
        // Check _pooledTokens and precisions parameter
        require(_pooledTokens.length > 1, "StablePair: _pooledTokens.length <= 1");
        require(_pooledTokens.length <= 32, "StablePair: _pooledTokens.length > 32");
        require(_pooledTokens.length == _decimals.length, "StablePair: _pooledTokens decimals mismatch");

        uint256[] memory _precisionMultipliers = new uint256[](_decimals.length);
        IERC20[] memory _poolTokens = new IERC20[](_decimals.length);

        for (uint8 i = 0; i < _pooledTokens.length; i++) {
            if (i > 0) {
                // Check if index is already used. Check if 0th element is a duplicate.
                require(
                    tokenIndexes_[_pooledTokens[i]] == 0 && _pooledTokens[0] != _pooledTokens[i],
                    "StablePair: Duplicate tokens"
                );
            }
            require(
                _pooledTokens[i] != address(0) && _pooledTokens[i] != address(this),
                "StablePair: The 0 address isn't an ERC-20"
            );
            require(_decimals[i] <= SwapUtils.POOL_PRECISION_DECIMALS, "StablePair: Token decimals exceeds max");
            _precisionMultipliers[i] = 10 ** (uint256(SwapUtils.POOL_PRECISION_DECIMALS) - uint256(_decimals[i]));
            _poolTokens[i] = IERC20(_pooledTokens[i]);
            tokenIndexes_[_pooledTokens[i]] = i;
        }

        // Check _a, _fee, _adminFee, _withdrawFee parameters
        require(_a < AmplificationUtils.MAX_A, "StablePair: _a exceeds maximum");
        require(_fee < SwapUtils.MAX_SWAP_FEE, "StablePair: _fee exceeds maximum");
        require(_adminFee < SwapUtils.MAX_ADMIN_FEE, "StablePair: _adminFee exceeds maximum");

        // Clone and initialize a LPToken contract
        LPToken _lpToken = LPToken(Clones.clone(_lpTokenTargetAddress));
        require(_lpToken.initialize(_lpTokenName, _lpTokenSymbol), "StablePair: could not init lpToken clone");

        // Initialize swapStorage struct
        swapStorage.lpToken = _lpToken;
        swapStorage.pooledTokens = _poolTokens;
        swapStorage.tokenPrecisionMultipliers = _precisionMultipliers;
        swapStorage.balances = new uint256[](_pooledTokens.length);
        swapStorage.initialA = _a * AmplificationUtils.A_PRECISION;
        swapStorage.futureA = _a * AmplificationUtils.A_PRECISION;
        // swapStorage.initialATime = 0;
        // swapStorage.futureATime = 0;
        swapStorage.swapFee = _fee;
        swapStorage.adminFee = _adminFee;
    }

    /*** MODIFIERS ***/

    /**
     * @notice Modifier to check sender against factory manager.
     */
    modifier onlyManager() {
        require(IPairFactory(factory).manager() == msg.sender, "StablePair: : not manager");
        _;
    }

    /**
     * @notice contract function lock modifier.
     */
    modifier lock() {
        require(unlocked_ == 1, "StablePair: LOCKED");
        unlocked_ = 0;
        _;
        unlocked_ = 1;
    }

    /**
     * @notice Modifier to check _deadline against current timestamp
     * @param _deadline latest timestamp to accept this transaction
     */
    modifier deadlineCheck(uint256 _deadline) {
        require(block.timestamp <= _deadline, "StablePair: Deadline not met");
        _;
    }

    /*** VIEW FUNCTIONS ***/

    /**
     * @notice Return A, the amplification coefficient * n * (n - 1)
     * @dev See the StableSwap paper for details
     * @return A parameter
     */
    function getA() external view virtual returns (uint256) {
        return swapStorage.getA();
    }

    /**
     * @notice Return A in its raw precision form
     * @dev See the StableSwap paper for details
     * @return A parameter in its raw precision form
     */
    function getAPrecise() external view virtual returns (uint256) {
        return swapStorage.getAPrecise();
    }

    /**
     * @notice Return address of the pooled token at given index. Reverts if _tokenIndex is out of range.
     * @param _index the index of the token
     * @return address of the token at given index
     */
    function getToken(uint8 _index) public view virtual returns (address) {
        require(_index < swapStorage.pooledTokens.length, "StablePair: Out of range");
        return address(swapStorage.pooledTokens[_index]);
    }

    /**
     * @notice Query all token addresses in pair.
     * @return _tokens all token addresses
     */
    function tokens() external view override returns (address[] memory _tokens) {
        _tokens = new address[](swapStorage.pooledTokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) _tokens[i] = address(swapStorage.pooledTokens[i]);
    }

    /**
     * @notice Query lpToken addresse.
     * @return lpToken addresse
     */
    function lpToken() external view override returns (address) {
        return address(swapStorage.lpToken);
    }

    /**
     * @notice Return the index of the given token address. Reverts if no matching
     * token is found.
     * @param _tokenAddress address of the token
     * @return the index of the given token address
     */
    function getTokenIndex(address _tokenAddress) public view virtual returns (uint8) {
        uint8 _index = tokenIndexes_[_tokenAddress];
        require(getToken(_index) == _tokenAddress, "StablePair: Token does not exist");
        return _index;
    }

    /**
     * @notice Return current balance of the pooled token at given index
     * @param _index the index of the token
     * @return current balance of the pooled token at given index with token's native precision
     */
    function getTokenBalance(uint8 _index) external view virtual returns (uint256) {
        require(_index < swapStorage.pooledTokens.length, "StablePair: Index out of range");
        return swapStorage.balances[_index];
    }

    /**
     * @notice Return current balances of the pooled tokens
     * @return current balances of the pooled tokens
     */
    function getTokenBalances() external view virtual returns (uint256[] memory) {
        return swapStorage.balances;
    }

    /**
     * @notice Get the virtual price, to help calculate profit
     * @return the virtual price, scaled to the POOL_PRECISION_DECIMALS
     */
    function getVirtualPrice() external view virtual returns (uint256) {
        return swapStorage.getVirtualPrice();
    }

    /**
     * @notice Calculate amount of tokens you receive on swap
     * @param _tokenFrom the token address the user wants to sell
     * @param _tokenTo the token address the user wants to buy
     * @param _dx the amount of tokens the user wants to sell. If the token charges
     * a fee on transfers, use the amount that gets transferred after the fee.
     * @return amount of tokens the user will receive
     */
    function getAmountOut(address _tokenFrom, address _tokenTo, uint256 _dx) external view override returns (uint256) {
        return swapStorage.calculateSwap(tokenIndexes_[_tokenFrom], tokenIndexes_[_tokenTo], _dx);
    }

    /**
     * @notice Convert the array index, according to tokenIndexes_.
     * @param _tokens an array of all token addresses for the pair,
     * @param _amounts an array of token amounts, corresponding to param _tokens.
     * @return _newAmounts amount of tokens after conversion
     */
    function _convertIndex(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) internal view returns (uint256[] memory _newAmounts) {
        _newAmounts = new uint256[](_amounts.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _newAmounts[getTokenIndex(_tokens[i])] = _amounts[i];
        }
    }

    /**
     * @notice A simple method to calculate prices from deposits or
     * withdrawals, excluding fees but including slippage. This is
     * helpful as an input into the various "min" parameters on calls
     * to fight front-running
     *
     * @dev This shouldn't be used outside frontends for user estimates.
     *
     * @param _tokens an array of all token addresses for the pair,
     * @param _amounts an array of token amounts to deposit or withdrawal,
     * corresponding to param _tokens. The amount should be in each
     * pooled token's native precision. If a token charges a fee on transfers,
     * use the amount that gets transferred after the fee.
     * @param _deposit whether this is a deposit or a withdrawal
     * @return token amount the user will receive
     */
    function calculateTokenAmount(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        bool _deposit
    ) external view virtual override returns (uint256) {
        return swapStorage.calculateTokenAmount(_convertIndex(_tokens, _amounts), _deposit);
    }

    /**
     * @notice A simple method to calculate amount of each underlying
     * tokens that is returned upon burning given amount of LP tokens
     * @param _tokens token address list
     * @param _amount the amount of LP tokens that would be burned on withdrawal
     * @return array of token balances that the user will receive
     */
    function calculateRemoveLiquidity(
        address[] calldata _tokens,
        uint256 _amount
    ) external view virtual override returns (uint256[] memory) {
        uint256[] memory _amounts = swapStorage.calculateRemoveLiquidity(_amount);
        uint256[] memory _actualAmounts = new uint256[](_amounts.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            _actualAmounts[i] = _amounts[getTokenIndex(_tokens[i])];
        }
        return _actualAmounts;
    }

    /**
     * @notice Calculate the amount of underlying token available to withdraw
     * when withdrawing via only single token
     * @param _token address of tokens that will be withdrawn
     * @param _tokenAmount the amount of LP token to burn
     * @return calculated amount of underlying token
     * available to withdraw
     */
    function calculateRemoveLiquidityOneToken(
        address _token,
        uint256 _tokenAmount
    ) external view virtual override returns (uint256) {
        return swapStorage.calculateWithdrawOneToken(_tokenAmount, tokenIndexes_[_token]);
    }

    /**
     * @notice This function reads the accumulated amount of admin fees of the token with given index
     * @param _index Index of the pooled token
     * @return admin's token balance in the token's precision
     */
    function getAdminBalance(uint256 _index) external view virtual returns (uint256) {
        return swapStorage.getAdminBalance(_index);
    }

    /*** STATE MODIFYING FUNCTIONS ***/

    /**
     * @notice Calculate amount of tokens you receive on swap
     * @param _tokenFrom the token address the user wants to sell
     * @param _tokenTo the token address the user wants to buy
     * @param _dx the amount of tokens the user wants to swap from
     * @param _minDy the min amount the user would like to receive, or revert.
     * @param _receiver recipient address
     * @param _deadline latest timestamp to accept this transaction
     */
    function swap(
        address _tokenFrom,
        address _tokenTo,
        uint256 _dx,
        uint256 _minDy,
        address _receiver,
        uint256 _deadline
    ) external override lock deadlineCheck(_deadline) returns (uint256) {
        return swapStorage.swap(tokenIndexes_[_tokenFrom], tokenIndexes_[_tokenTo], _dx, _minDy, _receiver);
    }

    /**
     * @notice Add liquidity to the pool with the given amounts of tokens
     * @param _tokens token address list
     * @param _amounts the amounts of each token to add, in their native precision,corresponding to param _tokens
     * @param _minToMint the minimum LP tokens adding this amount of liquidity
     * should mint, otherwise revert. Handy for front-running mitigation
     * @param _receiver recipient address
     * @param _deadline latest timestamp to accept this transaction
     * @return amount of LP token user minted and received
     */
    function addLiquidity(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        uint256 _minToMint,
        address _receiver,
        uint256 _deadline
    ) external override lock deadlineCheck(_deadline) returns (uint256) {
        return swapStorage.addLiquidity(_convertIndex(_tokens, _amounts), _minToMint, _receiver);
    }

    /**
     * @notice Burn LP tokens to remove liquidity from the pool. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @dev Liquidity can always be removed, even when the pool is paused.
     * @param _amount the amount of LP tokens to burn
     * @param _tokens token address list
     * @param _minAmounts the minimum amounts of each token in the pool
     *        acceptable for this burn. Useful as a front-running mitigation
     * @param _receiver recipient address
     * @param _deadline latest timestamp to accept this transaction
     * @return amounts of tokens user received
     */
    function removeLiquidity(
        uint256 _amount,
        address[] calldata _tokens,
        uint256[] calldata _minAmounts,
        address _receiver,
        uint256 _deadline
    ) external virtual override lock deadlineCheck(_deadline) returns (uint256[] memory) {
        return swapStorage.removeLiquidity(_amount, _convertIndex(_tokens, _minAmounts), _receiver);
    }

    /**
     * @notice Remove liquidity from the pool all in one token. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @param _tokenAmount the amount of the token you want to receive
     * @param _token address of the token you want to receive
     * @param _minAmount the minimum amount to withdraw, otherwise revert
     * @param _receiver recipient address
     * @param _deadline latest timestamp to accept this transaction
     * @return amount of chosen token user received
     */
    function removeLiquidityOneToken(
        uint256 _tokenAmount,
        address _token,
        uint256 _minAmount,
        address _receiver,
        uint256 _deadline
    ) external override lock deadlineCheck(_deadline) returns (uint256) {
        return swapStorage.removeLiquidityOneToken(_tokenAmount, tokenIndexes_[_token], _minAmount, _receiver);
    }

    /**
     * @notice Remove liquidity from the pool, weighted differently than the
     * pool's current balances. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @param _tokens token address list
     * @param _amounts how much of each token to withdraw
     * @param _maxBurnAmount the max LP token provider is willing to pay to
     * remove liquidity. Useful as a front-running mitigation.
     * @param _receiver recipient address
     * @param _deadline latest timestamp to accept this transaction
     * @return amount of LP tokens burned
     */
    function removeLiquidityImbalance(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        uint256 _maxBurnAmount,
        address _receiver,
        uint256 _deadline
    ) external override lock deadlineCheck(_deadline) returns (uint256) {
        return swapStorage.removeLiquidityImbalance(_convertIndex(_tokens, _amounts), _maxBurnAmount, _receiver);
    }

    /*** ADMIN FUNCTIONS ***/

    /**
     * @notice Withdraw all admin fees to the contract factory manager
     */
    function claimFees() external returns (uint256[] memory) {
        return swapStorage.withdrawAdminFees(IPairFactory(factory).manager());
    }

    /**
     * @notice Update the admin fee. Admin fee takes portion of the swap fee.
     * @param _newAdminFee new admin fee to be applied on future transactions
     */
    function setAdminFeeRate(uint256 _newAdminFee) external onlyManager {
        swapStorage.setAdminFee(_newAdminFee);
    }

    /**
     * @notice Update the swap fee to be applied on swaps
     * @param _newSwapFee new swap fee to be applied on future transactions
     */
    function setSwapFee(uint256 _newSwapFee) external onlyManager {
        swapStorage.setSwapFee(_newSwapFee);
    }

    /**
     * @notice Start ramping up or down A parameter towards given futureA and futureTime
     * Checks if the change is too rapid, and commits the new A value only when it falls under
     * the limit range.
     * @param _futureA the new A to ramp towards
     * @param _futureTime timestamp when the new A should be reached
     */
    function rampA(uint256 _futureA, uint256 _futureTime) external onlyManager {
        swapStorage.rampA(_futureA, _futureTime);
    }

    /**
     * @notice Stop ramping A immediately. Reverts if ramp A is already stopped.
     */
    function stopRampA() external onlyManager {
        swapStorage.stopRampA();
    }
}
