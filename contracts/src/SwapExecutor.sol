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
    address public pendingOwner;
    address public launcher;
    address public oracleRegistry;
    address public oracleGuard;
    address public oracleQuoter;
    address public routerAdapter;
    uint16 public maxDeviationBps;
    bool public paused = true;
    mapping(address => bool) public approvedVault;
    mapping(address => PoolKey) public poolKeyForVault;

    event LauncherSet(address indexed launcher);
    event DependenciesConfigured(address indexed oracleRegistry,address indexed oracleGuard,address oracleQuoter,address routerAdapter,uint16 maxDeviationBps);
    event VaultApproval(address indexed vault,bool approved);
    event PoolConfigured(address indexed vault,address currency0,address currency1,uint24 fee,int24 tickSpacing);
    event PauseStateChanged(bool paused);
    event OwnershipTransferStarted(address indexed owner,address indexed pendingOwner);
    event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
    event PurchaseExecuted(address indexed vault,address indexed quoteToken,address indexed targetAsset,uint256 quoteSpent,uint256 assetReceived);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
    modifier onlyLauncher(){require(msg.sender==launcher&&launcher!=address(0),"NOT_LAUNCHER");_;}

    constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}

    function transferOwnership(address next) external onlyOwner {require(next!=address(0),"ZERO_OWNER");pendingOwner=next;emit OwnershipTransferStarted(owner,next);}
    function acceptOwnership() external {require(msg.sender==pendingOwner,"NOT_PENDING_OWNER");address old=owner;owner=msg.sender;pendingOwner=address(0);emit OwnershipTransferred(old,msg.sender);}
    function setLauncher(address launcher_) external onlyOwner {require(launcher==address(0)&&launcher_!=address(0),"LAUNCHER_ALREADY_SET");launcher=launcher_;emit LauncherSet(launcher_);}

    function configureDependencies(address registry_,address guard_,address quoter_,address adapter_,uint16 deviation_) external onlyOwner {
        require(block.chainid==4663,"WRONG_CHAIN");
        require(paused,"NOT_PAUSED");
        require(registry_!=address(0)&&guard_!=address(0)&&quoter_!=address(0)&&adapter_!=address(0),"ZERO_ADDRESS");
        require(deviation_>0&&deviation_<=2000,"BAD_DEVIATION");
        oracleRegistry=registry_;oracleGuard=guard_;oracleQuoter=quoter_;routerAdapter=adapter_;maxDeviationBps=deviation_;
        emit DependenciesConfigured(registry_,guard_,quoter_,adapter_,deviation_);
    }

    function registerVault(address vault) external onlyLauncher {
        require(vault!=address(0)&&!approvedVault[vault],"INVALID_VAULT");
        approvedVault[vault]=true;
        emit VaultApproval(vault,true);
    }

    function setPoolKey(address vault,PoolKey calldata key) external onlyOwner {
        require(paused&&approvedVault[vault],"NOT_CONFIGURABLE");
        address quote=IVaultSwap(vault).quoteToken();
        address target=IVaultSwap(vault).targetAsset();
        ISwapRouterAdapter.PoolKey memory adapterKey=ISwapRouterAdapter.PoolKey(key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks);
        require(ISwapRouterAdapter(routerAdapter).validatePool(quote,target,adapterKey),"INVALID_POOL");
        poolKeyForVault[vault]=key;
        emit PoolConfigured(vault,key.currency0,key.currency1,key.fee,key.tickSpacing);
    }

    function setPaused(bool next) external onlyOwner {paused=next;emit PauseStateChanged(next);}

    function execute(address vault,uint256 amountIn,uint256 minOut,uint256 deadline) external onlyOwner {
        require(!paused&&approvedVault[vault],"NOT_ACTIVE");
        require(amountIn>0&&minOut>0&&deadline>=block.timestamp&&deadline<=block.timestamp+15 minutes,"BAD_ORDER");
        IVaultSwap v=IVaultSwap(vault);
        require(amountIn<=v.availableEarned(),"EXCEEDS_EARNED");
        address quote=v.quoteToken();
        address target=v.targetAsset();
        PoolKey memory key=poolKeyForVault[vault];
        require(key.currency0!=key.currency1,"POOL_NOT_SET");

        uint256 expected=ISwapOracleQuoter(oracleQuoter).expectedOut(oracleRegistry,oracleGuard,quote,target,amountIn);
        require(minOut*10_000>=expected*(10_000-maxDeviationBps),"MIN_OUT_DEVIATION");

        uint256 beforeBalance=ISwapBalance(target).balanceOf(vault);
        ISwapRouterAdapter.PoolKey memory adapterKey=ISwapRouterAdapter.PoolKey(key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks);
        if(quote==address(0)){
            v.spendQuote(address(this),amountIn);
            ISwapRouterAdapter(routerAdapter).swap{value:amountIn}(vault,quote,target,adapterKey,amountIn,minOut,deadline);
        }else{
            v.spendQuote(address(this),amountIn);
            _approve(quote,routerAdapter,amountIn);
            ISwapRouterAdapter(routerAdapter).swap(vault,quote,target,adapterKey,amountIn,minOut,deadline);
            _approve(quote,routerAdapter,0);
        }
        uint256 received=ISwapBalance(target).balanceOf(vault)-beforeBalance;
        require(received>=minOut,"INSUFFICIENT_OUTPUT");
        require(received*10_000<=expected*(10_000+maxDeviationBps),"PRICE_DEVIATION");
        v.recordPurchase(amountIn,received);
        emit PurchaseExecuted(vault,quote,target,amountIn,received);
    }

    function _approve(address token,address spender,uint256 amount) private {
        (bool ok,bytes memory result)=token.call(abi.encodeWithSelector(0x095ea7b3,spender,amount));
        require(ok&&(result.length==0||abi.decode(result,(bool))),"APPROVE_FAILED");
    }

    receive() external payable {}
}
