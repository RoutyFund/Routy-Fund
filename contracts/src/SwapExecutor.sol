// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVaultSwap {
    function targetAsset() external view returns (address);
    function quoteToken() external view returns (address);
    function availableEarned() external view returns (uint256);
    function spendQuote(address to,uint256 amount) external;
    function recordPurchase(uint256 quoteSpent,uint256 assetReceived) external;
}

interface ISwapBalance {
    function balanceOf(address) external view returns (uint256);
}

interface ISwapOracleQuoter {
    function expectedOut(address registry,address guard,address quote,address target,uint256 amountIn) external view returns (uint256);
}

interface ISwapRouterAdapter {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    function validatePool(address quote,address target,PoolKey calldata key) external pure returns (bool);
    function swap(address vault,address quote,address target,PoolKey calldata key,uint256 amountIn,uint256 minOut,uint256 deadline) external payable;
}

contract SwapExecutor {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    address public owner;
    address public launcher;
    address oracleRegistry;
    address oracleGuard;
    address oracleQuoter;
    address routerAdapter;
    uint16 maxDeviationBps;
    bool public paused = true;
    mapping(address => bool) public approvedVault;
    mapping(address => PoolKey) public poolKeyForVault;

    error NotOwner();
    error NotLauncher();
    error ZeroAddress();
    error AlreadySet();
    error WrongChain();
    error NotPaused();
    error BadDeviation();
    error InvalidVault();
    error NotConfigurable();
    error NotActive();
    error BadOrder();
    error ExceedsEarned();
    error PoolNotSet();
    error MinOutDeviation();
    error InsufficientOutput();
    error PriceDeviation();
    error ApproveFailed();

    event PurchaseExecuted(address indexed vault,address indexed quoteToken,address indexed targetAsset,uint256 quoteSpent,uint256 assetReceived);
    modifier onlyOwner(){if(msg.sender!=owner) revert NotOwner();_;}
    modifier onlyLauncher(){if(msg.sender!=launcher||launcher==address(0)) revert NotLauncher();_;}

    constructor(address owner_){if(owner_==address(0)) revert ZeroAddress();owner=owner_;}

    function setLauncher(address launcher_) external onlyOwner {if(launcher!=address(0)) revert AlreadySet();if(launcher_==address(0)) revert ZeroAddress();launcher=launcher_;}

    function configureDependencies(address registry_,address guard_,address quoter_,address adapter_,uint16 deviation_) external onlyOwner {
        if(block.chainid!=4663) revert WrongChain();
        if(!paused) revert NotPaused();
        if(registry_==address(0)||guard_==address(0)||quoter_==address(0)||adapter_==address(0)) revert ZeroAddress();
        if(deviation_==0||deviation_>2000) revert BadDeviation();
        oracleRegistry=registry_;oracleGuard=guard_;oracleQuoter=quoter_;routerAdapter=adapter_;maxDeviationBps=deviation_;
    }

    function registerVault(address vault) external onlyLauncher {
        if(vault==address(0)||approvedVault[vault]) revert InvalidVault();
        approvedVault[vault]=true;
    }

    function setPoolKey(address vault,PoolKey calldata key) external onlyOwner {
        if(!paused||!approvedVault[vault]) revert NotConfigurable();
        address quote=IVaultSwap(vault).quoteToken();
        address target=IVaultSwap(vault).targetAsset();
        ISwapRouterAdapter.PoolKey memory adapterKey=ISwapRouterAdapter.PoolKey(key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks);
        ISwapRouterAdapter(routerAdapter).validatePool(quote,target,adapterKey);
        poolKeyForVault[vault]=key;
    }

    function setPaused(bool next) external onlyOwner {paused=next;}

    function execute(address vault,uint256 amountIn,uint256 minOut,uint256 deadline) external onlyOwner {
        if(paused||!approvedVault[vault]) revert NotActive();
        if(amountIn==0||minOut==0||deadline<block.timestamp||deadline>block.timestamp+15 minutes) revert BadOrder();
        IVaultSwap v=IVaultSwap(vault);
        if(amountIn>v.availableEarned()) revert ExceedsEarned();
        address quote=v.quoteToken();
        address target=v.targetAsset();
        PoolKey memory key=poolKeyForVault[vault];
        if(key.currency0==key.currency1) revert PoolNotSet();

        uint256 expected=ISwapOracleQuoter(oracleQuoter).expectedOut(oracleRegistry,oracleGuard,quote,target,amountIn);
        if(minOut*10_000<expected*(10_000-maxDeviationBps)) revert MinOutDeviation();

        uint256 beforeBalance=ISwapBalance(target).balanceOf(vault);
        _routeSwap(v,vault,quote,target,key,amountIn,minOut,deadline);
        uint256 received=ISwapBalance(target).balanceOf(vault)-beforeBalance;
        if(received<minOut) revert InsufficientOutput();
        if(received*10_000>expected*(10_000+maxDeviationBps)) revert PriceDeviation();
        v.recordPurchase(amountIn,received);
        emit PurchaseExecuted(vault,quote,target,amountIn,received);
    }

    function _routeSwap(IVaultSwap v,address vault,address quote,address target,PoolKey memory key,uint256 amountIn,uint256 minOut,uint256 deadline) private {
        ISwapRouterAdapter.PoolKey memory adapterKey=ISwapRouterAdapter.PoolKey(key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks);
        v.spendQuote(address(this),amountIn);
        if(quote==address(0)){
            ISwapRouterAdapter(routerAdapter).swap{value:amountIn}(vault,quote,target,adapterKey,amountIn,minOut,deadline);
        }else{
            _approve(quote,routerAdapter,amountIn);
            ISwapRouterAdapter(routerAdapter).swap(vault,quote,target,adapterKey,amountIn,minOut,deadline);
            _approve(quote,routerAdapter,0);
        }
    }

    function _approve(address token,address spender,uint256 amount) private {
        (bool ok,bytes memory result)=token.call(abi.encodeWithSelector(0x095ea7b3,spender,amount));
        if(!ok||(result.length!=0&&!abi.decode(result,(bool)))) revert ApproveFailed();
    }

    receive() external payable {}
}
