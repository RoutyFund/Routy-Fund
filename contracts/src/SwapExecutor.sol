// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVaultSwap {
    function targetAsset() external view returns (address);
    function quoteToken() external view returns (address);
    function availableEarned() external view returns (uint256);
    function launcher() external view returns (address);
    function executor() external view returns (address);
    function transferEarnedToExecutor(uint256 amount) external;
    function recordPurchase(uint256 quoteSpent, uint256 assetReceived) external;
}

interface IERC20Swap {
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IOracleRegistrySwap {
    function feedForAsset(address asset) external view returns (address);
}

interface IOracleGuardSwap {
    function read(address feed) external view returns (uint256);
    function withinDeviation(uint256 oraclePrice, uint256 dexPrice, uint256 maxDeviationBps) external view returns (bool);
}

interface IPermit2Swap {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IUniversalRouterSwap {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

contract SwapExecutor {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    uint256 public constant CHAIN_ID = 4663;
    uint256 public constant MAX_DEADLINE_DELAY = 15 minutes;
    uint256 public constant MAX_ALLOWED_DEVIATION_BPS = 2_000;
    address public constant UNIVERSAL_ROUTER = 0x204FAca1764B154221e35c0d20aBb3c525710498;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address public constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;

    address public owner;
    address public pendingOwner;
    address public launcher;
    address public oracleRegistry;
    address public oracleGuard;
    uint16 public maxDeviationBps;
    bool public dependenciesConfigured;
    bool public paused = true;
    bool private locked;
    address private activeNativeVault;

    mapping(address => bool) public registeredVault;
    mapping(address => bool) public keeper;
    mapping(address => bool) public poolConfigured;
    mapping(address => PoolKey) public poolForVault;

    event VaultRegistered(address indexed vault);
    event KeeperSet(address indexed keeper, bool allowed);
    event PoolConfigured(address indexed vault, address currency0, address currency1, uint24 fee, int24 tickSpacing);
    event PauseStateChanged(bool paused);
    event DependenciesConfigured(address indexed router, address indexed permit2, address indexed poolManager, address oracleRegistry, address oracleGuard, uint16 maxDeviationBps);
    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event PurchaseSettled(address indexed vault, address indexed targetAsset, uint256 quoteSpent, uint256 assetReceived);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == owner || keeper[msg.sender], "NOT_KEEPER");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "REENTRANT");
        locked = true;
        _;
        locked = false;
    }

    constructor(address owner_) {
        require(owner_ != address(0), "ZERO_OWNER");
        owner = owner_;
    }

    receive() external payable {
        require(msg.sender == activeNativeVault && activeNativeVault != address(0), "UNEXPECTED_NATIVE");
    }

    function transferOwnership(address next) external onlyOwner {
        require(next != address(0), "ZERO_OWNER");
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING_OWNER");
        address old = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(old, msg.sender);
    }

    function setLauncher(address launcher_) external onlyOwner {
        require(launcher == address(0) && launcher_.code.length != 0, "INVALID_LAUNCHER");
        launcher = launcher_;
    }

    function configureDependencies(
        address router_,
        address permit2_,
        address poolManager_,
        address oracleRegistry_,
        address oracleGuard_,
        uint16 maxDeviationBps_
    ) external onlyOwner {
        require(!dependenciesConfigured && block.chainid == CHAIN_ID, "CONFIGURATION_LOCKED");
        require(router_ == UNIVERSAL_ROUTER && permit2_ == PERMIT2 && poolManager_ == POOL_MANAGER, "UNVERIFIED_UNISWAP");
        require(router_.code.length != 0 && permit2_.code.length != 0 && poolManager_.code.length != 0, "MISSING_UNISWAP_CODE");
        require(oracleRegistry_.code.length != 0 && oracleGuard_.code.length != 0, "MISSING_ORACLE_CODE");
        require(maxDeviationBps_ > 0 && maxDeviationBps_ <= MAX_ALLOWED_DEVIATION_BPS, "INVALID_DEVIATION");
        oracleRegistry = oracleRegistry_;
        oracleGuard = oracleGuard_;
        maxDeviationBps = maxDeviationBps_;
        dependenciesConfigured = true;
        emit DependenciesConfigured(router_, permit2_, poolManager_, oracleRegistry_, oracleGuard_, maxDeviationBps_);
    }

    function setMaxDeviationBps(uint16 next) external onlyOwner {
        require(paused && next > 0 && next <= MAX_ALLOWED_DEVIATION_BPS, "INVALID_DEVIATION");
        maxDeviationBps = next;
    }

    function setKeeper(address account, bool allowed) external onlyOwner {
        require(account != address(0), "ZERO_KEEPER");
        keeper[account] = allowed;
        emit KeeperSet(account, allowed);
    }

    function setPaused(bool next) external onlyOwner {
        if (!next) require(dependenciesConfigured && launcher != address(0), "NOT_CONFIGURED");
        paused = next;
        emit PauseStateChanged(next);
    }

    function registerVault(address vault) external {
        require(msg.sender == launcher && launcher != address(0), "NOT_LAUNCHER");
        require(!registeredVault[vault] && vault.code.length != 0, "INVALID_VAULT");
        IVaultSwap v = IVaultSwap(vault);
        address quote = v.quoteToken();
        address target = v.targetAsset();
        require(v.launcher() == launcher && v.executor() == address(this), "NOT_ROUTY_VAULT");
        require(target != address(0) && target != quote && target.code.length != 0 && (quote == address(0) || quote.code.length != 0), "INVALID_ASSETS");
        registeredVault[vault] = true;
        emit VaultRegistered(vault);
    }

    function setPoolKey(address vault, PoolKey calldata key) external onlyOwner {
        require(paused && registeredVault[vault], "VAULT_NOT_CONFIGURABLE");
        _validatePoolKey(vault, key);
        poolForVault[vault] = key;
        poolConfigured[vault] = true;
        emit PoolConfigured(vault, key.currency0, key.currency1, key.fee, key.tickSpacing);
    }

    function execute(address vault, uint256 amountIn, uint256 minOut, uint256 deadline) external onlyKeeper nonReentrant {
        require(block.chainid == CHAIN_ID && dependenciesConfigured && !paused, "EXECUTION_DISABLED");
        require(registeredVault[vault] && poolConfigured[vault], "VAULT_NOT_CONFIGURED");
        require(deadline >= block.timestamp && deadline <= block.timestamp + MAX_DEADLINE_DELAY, "INVALID_DEADLINE");
        require(amountIn > 0 && amountIn <= type(uint128).max && minOut > 0 && minOut <= type(uint128).max, "INVALID_AMOUNT");

        IVaultSwap v = IVaultSwap(vault);
        address quote = v.quoteToken();
        address target = v.targetAsset();
        require(amountIn <= v.availableEarned(), "EXCEEDS_EARNED");
        _validatePoolKey(vault, poolForVault[vault]);

        uint256 expectedOut = _oracleExpectedOut(quote, target, amountIn);
        uint256 targetBalanceBefore = IERC20Swap(target).balanceOf(vault);
        uint256 quoteBalanceBefore = quote == address(0) ? address(this).balance : IERC20Swap(quote).balanceOf(address(this));

        if (quote == address(0)) activeNativeVault = vault;
        v.transferEarnedToExecutor(amountIn);
        if (quote == address(0)) {
            require(address(this).balance == quoteBalanceBefore + amountIn, "NATIVE_AMOUNT_MISMATCH");
        } else {
            require(IERC20Swap(quote).balanceOf(address(this)) == quoteBalanceBefore + amountIn, "TOKEN_AMOUNT_MISMATCH");
            _approveExact(quote, amountIn, uint48(deadline));
        }

        (bytes memory commands, bytes[] memory inputs) = _routerCall(vault, quote, target, amountIn, minOut, deadline);
        IUniversalRouterSwap(UNIVERSAL_ROUTER).execute{value: quote == address(0) ? amountIn : 0}(commands, inputs, deadline);
        if (quote != address(0)) _clearApprovals(quote);
        activeNativeVault = address(0);

        uint256 targetBalanceAfter = IERC20Swap(target).balanceOf(vault);
        require(targetBalanceAfter > targetBalanceBefore, "NO_ASSET_RECEIVED");
        uint256 actualOut = targetBalanceAfter - targetBalanceBefore;
        require(actualOut >= minOut, "MIN_OUT_NOT_MET");
        require(IOracleGuardSwap(oracleGuard).withinDeviation(expectedOut, actualOut, maxDeviationBps), "ORACLE_DEVIATION");
        if (quote == address(0)) {
            require(address(this).balance == quoteBalanceBefore, "NATIVE_NOT_SPENT_EXACTLY");
        } else {
            require(IERC20Swap(quote).balanceOf(address(this)) == quoteBalanceBefore, "QUOTE_NOT_SPENT_EXACTLY");
        }

        v.recordPurchase(amountIn, actualOut);
        emit PurchaseSettled(vault, target, amountIn, actualOut);
    }

    function _routerCall(address vault, address quote, address target, uint256 amountIn, uint256 minOut, uint256 deadline)
        private
        view
        returns (bytes memory commands, bytes[] memory inputs)
    {
        PoolKey memory key = poolForVault[vault];
        bool zeroForOne = quote == key.currency0;
        bytes memory actions = abi.encodePacked(bytes1(uint8(0x06)), bytes1(uint8(0x0c)), bytes1(uint8(0x0e)));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key, zeroForOne, uint128(amountIn), uint128(minOut), uint256(0), bytes(""));
        params[1] = abi.encode(quote, amountIn);
        params[2] = abi.encode(target, vault, type(uint256).max);
        inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        commands = abi.encodePacked(bytes1(uint8(0x10)));
        deadline;
    }

    function _oracleExpectedOut(address quote, address target, uint256 amountIn) private view returns (uint256) {
        IOracleRegistrySwap registry = IOracleRegistrySwap(oracleRegistry);
        IOracleGuardSwap guard = IOracleGuardSwap(oracleGuard);
        address quoteFeed = registry.feedForAsset(quote);
        address targetFeed = registry.feedForAsset(target);
        require(quoteFeed != address(0) && targetFeed != address(0), "MISSING_FEED");
        uint256 quotePrice = guard.read(quoteFeed);
        uint256 targetPrice = guard.read(targetFeed);
        uint8 quoteDecimals = quote == address(0) ? 18 : IERC20Swap(quote).decimals();
        uint8 targetDecimals = IERC20Swap(target).decimals();
        require(quoteDecimals <= 36 && targetDecimals <= 36, "BAD_TOKEN_DECIMALS");
        uint256 quoteScale = 10 ** quoteDecimals;
        uint256 targetScale = 10 ** targetDecimals;
        require(amountIn <= type(uint256).max / quotePrice, "ORACLE_AMOUNT_OVERFLOW");
        uint256 quoteValueUsd = amountIn * quotePrice / quoteScale;
        require(quoteValueUsd > 0 && quoteValueUsd <= type(uint256).max / targetScale, "ORACLE_VALUE_INVALID");
        uint256 expectedOut = quoteValueUsd * targetScale / targetPrice;
        require(expectedOut > 0, "ORACLE_OUTPUT_ZERO");
        return expectedOut;
    }

    function _validatePoolKey(address vault, PoolKey memory key) private view {
        address quote = IVaultSwap(vault).quoteToken();
        address target = IVaultSwap(vault).targetAsset();
        require(key.currency0 < key.currency1, "UNSORTED_POOL_KEY");
        require((key.currency0 == quote && key.currency1 == target) || (key.currency0 == target && key.currency1 == quote), "WRONG_POOL_ASSETS");
        require(key.fee <= 1_000_000 && key.tickSpacing > 0 && key.tickSpacing <= 32_767 && key.hooks == address(0), "UNSUPPORTED_POOL");
    }

    function _approveExact(address token, uint256 amount, uint48 expiration) private {
        _callToken(token, abi.encodeWithSelector(0x095ea7b3, PERMIT2, 0));
        _callToken(token, abi.encodeWithSelector(0x095ea7b3, PERMIT2, amount));
        IPermit2Swap(PERMIT2).approve(token, UNIVERSAL_ROUTER, uint160(amount), expiration);
    }

    function _clearApprovals(address token) private {
        IPermit2Swap(PERMIT2).approve(token, UNIVERSAL_ROUTER, 0, 0);
        _callToken(token, abi.encodeWithSelector(0x095ea7b3, PERMIT2, 0));
    }

    function _callToken(address token, bytes memory callData) private {
        (bool ok, bytes memory result) = token.call(callData);
        require(ok && (result.length == 0 || abi.decode(result, (bool))), "TOKEN_APPROVAL_FAILED");
    }
}