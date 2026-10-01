// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/AssetVault.sol";
import "../src/OracleGuard.sol";
import "../src/OracleRegistry.sol";
import "../src/SwapExecutor.sol";
import "../src/SwapOracleQuoter.sol";
import "../src/SwapRouterAdapter.sol";

interface VmSwap {
    function chainId(uint256 newChainId) external;
    function etch(address target, bytes calldata code) external;
    function deal(address account, uint256 newBalance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract SwapTestToken {
    string public name;
    uint8 public immutable decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory name_, uint8 decimals_) {
        name = name_;
        decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount && allowance[from][msg.sender] >= amount, "ALLOWANCE");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SwapTestFeed {
    int256 public answer;
    uint8 public immutable decimals;
    uint256 public updatedAt;
    uint80 public answeredInRound = 1;

    constructor(int256 answer_, uint8 decimals_) {
        answer = answer_;
        decimals = decimals_;
        updatedAt = block.timestamp;
    }

    function set(int256 answer_, uint256 updatedAt_, uint80 answered_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        answeredInRound = answered_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, 0, updatedAt, answeredInRound);
    }
}

contract SwapTestPermit2 {
    mapping(address => mapping(address => mapping(address => uint160))) public allowance;

    function approve(address token, address spender, uint160 amount, uint48) external {
        allowance[msg.sender][token][spender] = amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 current = allowance[from][token][msg.sender];
        require(current >= amount, "PERMIT2_ALLOWANCE");
        allowance[from][token][msg.sender] = current - amount;
        require(SwapTestToken(token).transferFrom(from, to, amount), "TRANSFER_FAILED");
    }
}

contract SwapTestRouter {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    uint256 public amountOut;
    bool public shouldRevert;
    address public lastInput;
    address public lastOutput;
    address public lastRecipient;
    uint256 public lastMinOut;

    function configure(uint256 amountOut_, bool revert_) external {
        amountOut = amountOut_;
        shouldRevert = revert_;
    }

    function execute(bytes calldata commands, bytes[] calldata inputs, uint256) external payable {
        require(!shouldRevert, "MOCK_ROUTER_REVERT");
        require(commands.length == 1 && uint8(commands[0]) == 0x10 && inputs.length == 1, "BAD_COMMAND");
        (bytes memory actions, bytes[] memory params) = abi.decode(inputs[0], (bytes, bytes[]));
        require(actions.length == 3 && actions[0] == 0x06 && actions[1] == 0x0c && actions[2] == 0x0e, "BAD_ACTIONS");
        require(params.length == 3, "BAD_PARAMS");
        (PoolKey memory key, bool zeroForOne, uint128 amountIn, uint128 minOut,,) = abi.decode(
            params[0], (PoolKey, bool, uint128, uint128, uint256, bytes)
        );
        (address input, uint256 settledAmount) = abi.decode(params[1], (address, uint256));
        (address output, address recipient, uint256 takeAmount) = abi.decode(params[2], (address, address, uint256));
        require(input == (zeroForOne ? key.currency0 : key.currency1) && settledAmount == amountIn, "BAD_INPUT");
        require(output == (zeroForOne ? key.currency1 : key.currency0) && takeAmount == type(uint256).max, "BAD_OUTPUT");
        require(amountOut >= minOut, "ROUTER_MIN_OUT");
        if (input == address(0)) require(msg.value == amountIn, "BAD_NATIVE_INPUT");
        else {
            require(msg.value == 0, "UNEXPECTED_VALUE");
            SwapTestPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3).transferFrom(msg.sender, address(this), uint160(amountIn), input);
        }
        lastInput = input;
        lastOutput = output;
        lastRecipient = recipient;
        lastMinOut = minOut;
        require(SwapTestToken(output).transfer(recipient, amountOut), "OUTPUT_TRANSFER_FAILED");
    }
}

contract SwapExecutorTest {
    VmSwap private constant vm = VmSwap(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant ROUTER = 0x204FAca1764B154221e35c0d20aBb3c525710498;
    address private constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address private constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    uint256 private constant INPUT = 10 ether;
    uint256 private constant EXPECTED = 5 ether;

    SwapExecutor private executor;
    AssetVault private vault;
    SwapTestToken private quote;
    SwapTestToken private target;
    SwapTestFeed private quoteFeed;
    SwapTestFeed private targetFeed;
    OracleRegistry private registry;
    OracleGuard private guard;
    SwapOracleQuoter private quoter;
    SwapRouterAdapter private adapter;

    receive() external payable {}

    function setUp() public {
        vm.chainId(4663);
        vm.warp(1_700_000_000);
        SwapTestRouter routerImplementation = new SwapTestRouter();
        SwapTestPermit2 permitImplementation = new SwapTestPermit2();
        vm.etch(ROUTER, address(routerImplementation).code);
        vm.etch(PERMIT2, address(permitImplementation).code);
        vm.etch(POOL_MANAGER, address(permitImplementation).code);

        quote = new SwapTestToken("Quote", 18);
        target = new SwapTestToken("Stock", 18);
        quoteFeed = new SwapTestFeed(1e18, 18);
        targetFeed = new SwapTestFeed(2e18, 18);
        registry = new OracleRegistry(address(this));
        registry.setFeed(address(quote), address(quoteFeed));
        registry.setFeed(address(target), address(targetFeed));
        guard = new OracleGuard(1 hours);
        quoter = new SwapOracleQuoter();
        adapter = new SwapRouterAdapter();
        executor = new SwapExecutor(address(this));
        executor.configureDependencies(address(registry), address(guard), address(quoter), address(adapter), 200);
        executor.setLauncher(address(this));
        vault = new AssetVault(address(target), address(this), address(executor));
        vault.bindRouter(address(this), address(quote));
        executor.registerVault(address(vault));
        _configurePool(address(quote), address(target));
        executor.setPaused(false);
        SwapTestRouter(ROUTER).configure(EXPECTED, false);
        target.mint(ROUTER, 100 ether);
        quote.mint(address(vault), INPUT);
        vault.recordTokenEarned(INPUT);
    }

    function testSuccessfulConstrainedErc20Purchase() public {
        uint256 beforeTarget = target.balanceOf(address(vault));
        executor.execute(address(vault), INPUT, EXPECTED, block.timestamp + 2 minutes);
        require(target.balanceOf(address(vault)) == beforeTarget + EXPECTED, "WRONG_OUTPUT_BALANCE");
        require(vault.totalSpent() == INPUT && vault.availableEarned() == 0, "BAD_ACCOUNTING");
        require(SwapTestRouter(ROUTER).lastInput() == address(quote), "WRONG_INPUT");
        require(SwapTestRouter(ROUTER).lastOutput() == address(target), "WRONG_OUTPUT");
        require(SwapTestRouter(ROUTER).lastRecipient() == address(vault), "WRONG_RECIPIENT");
        require(SwapTestRouter(ROUTER).lastMinOut() == EXPECTED, "MIN_OUT_NOT_FORWARDED");
        require(quote.allowance(address(executor), PERMIT2) == 0, "TOKEN_ALLOWANCE_REMAINS");
        require(SwapTestPermit2(PERMIT2).allowance(address(executor), address(quote), ROUTER) == 0, "PERMIT2_ALLOWANCE_REMAINS");
    }

    function testUnauthorizedCallerRejected() public {
        vm.prank(address(0xBEEF));
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "UNAUTHORIZED_CALLER_ACCEPTED");
    }

    function testUnauthorizedVaultRejected() public {
        AssetVault foreign = new AssetVault(address(target), address(this), address(executor));
        vm.prank(address(0xBEEF));
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(foreign), 1, 1, block.timestamp + 1 minutes)));
        require(!ok, "UNREGISTERED_VAULT_ACCEPTED");
    }

    function testWrongInputTokenPoolRejected() public {
        SwapTestToken wrong = new SwapTestToken("Wrong", 18);
        SwapExecutor.PoolKey memory key = SwapExecutor.PoolKey(address(wrong), address(target), 3000, 60, address(0));
        executor.setPaused(true);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.setPoolKey, (address(vault), key)));
        require(!ok, "WRONG_INPUT_POOL_ACCEPTED");
    }

    function testWrongOutputTokenPoolRejected() public {
        SwapTestToken wrong = new SwapTestToken("Wrong", 18);
        SwapExecutor.PoolKey memory key = SwapExecutor.PoolKey(address(quote), address(wrong), 3000, 60, address(0));
        executor.setPaused(true);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.setPoolKey, (address(vault), key)));
        require(!ok, "WRONG_OUTPUT_POOL_ACCEPTED");
    }

    function testArbitraryRecipientCannotBeSelected() public {
        executor.execute(address(vault), INPUT, EXPECTED, block.timestamp + 2 minutes);
        require(SwapTestRouter(ROUTER).lastRecipient() == address(vault), "RECIPIENT_NOT_FIXED");
    }

    function testAmountAboveEarnedRejected() public {
        uint256 spentBefore = vault.totalSpent();
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT + 1, 1, block.timestamp + 1 minutes)));
        require(!ok && vault.totalSpent() == spentBefore, "OVERSPEND_ACCEPTED");
    }

    function testZeroMinOutRejected() public {
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, 0, block.timestamp + 1 minutes)));
        require(!ok, "ZERO_MIN_OUT_ACCEPTED");
    }

    function testExpiredDeadlineRejected() public {
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp - 1)));
        require(!ok, "EXPIRED_DEADLINE_ACCEPTED");
    }

    function testStaleOracleRejected() public {
        quoteFeed.set(1e18, block.timestamp - 2 hours, 1);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "STALE_ORACLE_ACCEPTED");
    }

    function testInvalidOracleRejected() public {
        targetFeed.set(-1, block.timestamp, 1);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "INVALID_ORACLE_ACCEPTED");
    }

    function testZeroOraclePriceRejected() public {
        targetFeed.set(0, block.timestamp, 1);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "ZERO_ORACLE_ACCEPTED");
    }

    function testIncompleteOracleRoundRejected() public {
        targetFeed.set(2e18, block.timestamp, 0);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "INCOMPLETE_ORACLE_ACCEPTED");
    }

    function testExcessivePriceDeviationRejected() public {
        SwapTestRouter(ROUTER).configure(4 ether, false);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, 1, block.timestamp + 1 minutes)));
        require(!ok && vault.totalSpent() == 0 && vault.availableEarned() == INPUT, "DEVIATION_NOT_REVERTED");
        require(quote.balanceOf(address(vault)) == INPUT, "DEVIATION_LOST_QUOTE");
    }

    function testRandomErc20DepositIsNotSpendable() public {
        AssetVault empty = new AssetVault(address(target), address(this), address(executor));
        empty.bindRouter(address(this), address(quote));
        executor.registerVault(address(empty));
        _configurePoolFor(address(empty), address(quote), address(target));
        quote.mint(address(empty), INPUT);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(empty), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok && empty.totalEarned() == 0, "RANDOM_TOKEN_SPENDABLE");
    }

    function testSwapFailureDoesNotConsumeEarnedAccounting() public {
        SwapTestRouter(ROUTER).configure(EXPECTED, true);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "FAILED_SWAP_ACCEPTED");
        require(vault.totalSpent() == 0 && vault.availableEarned() == INPUT, "FAILED_SWAP_CONSUMED_ACCOUNTING");
        require(quote.balanceOf(address(vault)) == INPUT, "FAILED_SWAP_LOST_QUOTE");
    }

    function testTargetAssetRemainsImmutable() public {
        address targetBefore = vault.targetAsset();
        executor.execute(address(vault), INPUT, EXPECTED, block.timestamp + 2 minutes);
        require(vault.targetAsset() == targetBefore, "TARGET_CHANGED");
    }

    function testPauseBlocksExecution() public {
        executor.setPaused(true);
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(vault), INPUT, EXPECTED, block.timestamp + 1 minutes)));
        require(!ok, "PAUSED_EXECUTION_ACCEPTED");
    }

    function testNativeQuotePurchase() public {
        SwapTestFeed nativeFeed = new SwapTestFeed(2e18, 18);
        registry.setNativeFeed(address(nativeFeed));
        AssetVault nativeVault = new AssetVault(address(target), address(this), address(executor));
        nativeVault.bindRouter(address(0x1234), address(0));
        executor.registerVault(address(nativeVault));
        _configurePoolFor(address(nativeVault), address(0), address(target));
        vm.deal(address(0x1234), INPUT);
        vm.prank(address(0x1234));
        (bool funded,) = address(nativeVault).call{value: INPUT}("");
        require(funded && nativeVault.totalEarned() == INPUT, "NATIVE_EARNED_NOT_RECORDED");
        SwapTestRouter(ROUTER).configure(10 ether, false);
        target.mint(ROUTER, 10 ether);
        executor.execute(address(nativeVault), INPUT, 10 ether, block.timestamp + 2 minutes);
        require(nativeVault.totalSpent() == INPUT && target.balanceOf(address(nativeVault)) == 10 ether, "NATIVE_SWAP_FAILED");
        require(SwapTestRouter(ROUTER).lastInput() == address(0) && SwapTestRouter(ROUTER).lastRecipient() == address(nativeVault), "NATIVE_PATH_MISMATCH");
    }

    function testRandomNativeDepositIsNotSpendable() public {
        AssetVault nativeVault = new AssetVault(address(target), address(this), address(executor));
        nativeVault.bindRouter(address(0x1234), address(0));
        executor.registerVault(address(nativeVault));
        _configurePoolFor(address(nativeVault), address(0), address(target));
        vm.deal(address(this), 1 ether);
        (bool funded,) = address(nativeVault).call{value: 1 ether}("");
        require(funded && nativeVault.totalEarned() == 0, "RANDOM_NATIVE_COUNTED");
        (bool ok,) = address(executor).call(abi.encodeCall(executor.execute, (address(nativeVault), 1, 1, block.timestamp + 1 minutes)));
        require(!ok, "RANDOM_NATIVE_SPENDABLE");
    }

    function testPoolKeyCannotEnableHooksOrUnsortedCurrencies() public {
        executor.setPaused(true);
        SwapExecutor.PoolKey memory hooked = SwapExecutor.PoolKey(address(quote), address(target), 3000, 60, address(0xCAFE));
        (bool hooksOk,) = address(executor).call(abi.encodeCall(executor.setPoolKey, (address(vault), hooked)));
        require(!hooksOk, "HOOK_POOL_ACCEPTED");
        SwapExecutor.PoolKey memory unsorted = address(quote) < address(target)
            ? SwapExecutor.PoolKey(address(target), address(quote), 3000, 60, address(0))
            : SwapExecutor.PoolKey(address(quote), address(target), 3000, 60, address(0));
        (bool orderOk,) = address(executor).call(abi.encodeCall(executor.setPoolKey, (address(vault), unsorted)));
        require(!orderOk, "UNSORTED_POOL_ACCEPTED");
    }

    function testDependenciesCannotBeEnabledOnWrongChain() public {
        vm.chainId(1);
        SwapExecutor fresh = new SwapExecutor(address(this));
        (bool ok,) = address(fresh).call(abi.encodeCall(fresh.configureDependencies, (address(registry), address(guard), address(quoter), address(adapter), 200)));
        require(!ok, "WRONG_CHAIN_CONFIGURATION_ACCEPTED");
    }

    function _configurePool(address quote_, address target_) private {
        _configurePoolFor(address(vault), quote_, target_);
    }

    function _configurePoolFor(address vault_, address quote_, address target_) private {
        bool wasPaused = executor.paused();
        if (!wasPaused) executor.setPaused(true);
        SwapExecutor.PoolKey memory key = quote_ < target_
            ? SwapExecutor.PoolKey(quote_, target_, 3000, 60, address(0))
            : SwapExecutor.PoolKey(target_, quote_, 3000, 60, address(0));
        executor.setPoolKey(vault_, key);
        if (!wasPaused) executor.setPaused(false);
    }
}