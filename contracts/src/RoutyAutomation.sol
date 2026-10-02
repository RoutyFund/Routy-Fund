// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFeeRouterAutomation {
    function harvest() external returns (uint256 claimed);
}

interface ISwapExecutorAutomation {
    function execute(address vault,uint256 amountIn,uint256 minOut,uint256 deadline) external;
}

interface IAutomationVault {
    function availableEarned() external view returns (uint256);
    function quoteToken() external view returns (address);
    function targetAsset() external view returns (address);
}

interface IAutomationQuoter {
    function expectedOut(address registry,address guard,address quote,address target,uint256 amountIn) external view returns(uint256);
}

/// @notice Owner-configured keeper for Routy. Anyone may trigger a configured route,
/// but all limits are fixed by the owner and enforced on-chain.
contract RoutyAutomation {
    uint256 private constant BPS=10_000;
    address public owner;
    address public immutable executor;
    address public immutable oracleRegistry;
    address public immutable oracleGuard;
    address public immutable oracleQuoter;
    bool public paused=true;

    struct RouteConfig {
        address router;
        address vault;
        uint96 minSwapAmount;
        uint96 maxSwapAmount;
        uint32 cooldown;
        uint16 slippageBps;
        uint64 lastSwap;
        bool enabled;
    }
    mapping(address=>RouteConfig) public configForToken;

    event RouteConfigured(address indexed token,address router,address vault,uint256 minSwapAmount,uint256 maxSwapAmount,uint32 cooldown,uint16 slippageBps,bool enabled);
    event HarvestTriggered(address indexed token,address indexed router,uint256 claimed);
    event SwapTriggered(address indexed token,address indexed vault,uint256 amountIn,uint256 minOut);
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner,address indexed nextOwner);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}

    constructor(address owner_,address executor_,address registry_,address guard_,address quoter_){
        require(owner_!=address(0)&&executor_!=address(0)&&registry_!=address(0)&&guard_!=address(0)&&quoter_!=address(0),"ZERO_ADDRESS");
        owner=owner_;executor=executor_;oracleRegistry=registry_;oracleGuard=guard_;oracleQuoter=quoter_;
    }

    function transferOwnership(address next) external onlyOwner {require(next!=address(0),"ZERO_ADDRESS");emit OwnershipTransferred(owner,next);owner=next;}

    function setPaused(bool next) external onlyOwner {paused=next;emit Paused(next);}

    function configure(address token,address router,address vault,uint96 minSwapAmount,uint96 maxSwapAmount,uint32 cooldown,uint16 slippageBps,bool enabled) external onlyOwner {
        require(token!=address(0)&&router!=address(0)&&vault!=address(0),"ZERO_ADDRESS");
        require(!enabled||(minSwapAmount>0&&maxSwapAmount>=minSwapAmount&&cooldown>=60&&cooldown<=7 days&&slippageBps>0&&slippageBps<=200),"BAD_CONFIG");
        RouteConfig storage c=configForToken[token];
        c.router=router;c.vault=vault;c.minSwapAmount=minSwapAmount;c.maxSwapAmount=maxSwapAmount;c.cooldown=cooldown;c.slippageBps=slippageBps;c.enabled=enabled;
        emit RouteConfigured(token,router,vault,minSwapAmount,maxSwapAmount,cooldown,slippageBps,enabled);
    }

    /// @notice Permissionless trigger. Reverts harmlessly if the FeeRouter has no claimable fees.
    function harvest(address token) external returns(uint256 claimed){
        require(!paused,"PAUSED");RouteConfig storage c=configForToken[token];require(c.enabled,"NOT_ENABLED");
        claimed=IFeeRouterAutomation(c.router).harvest();
        emit HarvestTriggered(token,c.router,claimed);
    }

    /// @notice Permissionless trigger with owner-defined amount/cooldown/slippage bounds.
    /// Executor ownership must explicitly be transferred to this contract before this can operate.
    function swap(address token) external {
        require(!paused,"PAUSED");RouteConfig storage c=configForToken[token];require(c.enabled,"NOT_ENABLED");
        require(block.timestamp>=uint256(c.lastSwap)+c.cooldown,"COOLDOWN");
        uint256 available=IAutomationVault(c.vault).availableEarned();require(available>=c.minSwapAmount,"BELOW_THRESHOLD");
        uint256 amountIn=available>c.maxSwapAmount?c.maxSwapAmount:available;
        address quote=IAutomationVault(c.vault).quoteToken();address target=IAutomationVault(c.vault).targetAsset();
        uint256 expected=IAutomationQuoter(oracleQuoter).expectedOut(oracleRegistry,oracleGuard,quote,target,amountIn);
        uint256 minOut=expected*(BPS-c.slippageBps)/BPS;require(minOut>0,"ZERO_MIN_OUT");
        c.lastSwap=uint64(block.timestamp);
        ISwapExecutorAutomation(executor).execute(c.vault,amountIn,minOut,block.timestamp+5 minutes);
        emit SwapTriggered(token,c.vault,amountIn,minOut);
    }

    function harvestAndSwap(address token) external {
        harvest(token);
        RouteConfig storage c=configForToken[token];
        if(IAutomationVault(c.vault).availableEarned()>=c.minSwapAmount&&block.timestamp>=uint256(c.lastSwap)+c.cooldown) swap(token);
    }
}
