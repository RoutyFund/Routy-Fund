// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20RewardSource {
    function balanceOf(address account) external view returns(uint256);
    function transfer(address to,uint256 amount) external returns(bool);
}

/// @notice Route-scoped reward funding controller. The configured source must call
/// release() itself, so no third party receives an allowance over vault assets.
contract RewardFundingAutomation {
    struct Route {
        address rewardAsset;
        address source;
        address distributor;
        uint96 minAmount;
        bool enabled;
    }

    address public owner;
    bool public paused=true;
    mapping(address=>Route) public routeForToken;

    event RouteConfigured(address indexed token,address rewardAsset,address source,address distributor,uint256 minAmount,bool enabled);
    event FundingReleased(address indexed token,address indexed distributor,uint256 amount);
    event Paused(bool paused);
    event OwnershipTransferred(address indexed previousOwner,address indexed nextOwner);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}

    constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}

    function transferOwnership(address next) external onlyOwner {
        require(next!=address(0),"ZERO_OWNER");
        emit OwnershipTransferred(owner,next);
        owner=next;
    }

    function setPaused(bool next) external onlyOwner {paused=next;emit Paused(next);}

    function configure(address token,address rewardAsset,address source,address distributor,uint96 minAmount,bool enabled) external onlyOwner {
        require(token!=address(0)&&rewardAsset!=address(0)&&source!=address(0)&&distributor!=address(0),"ZERO_ADDRESS");
        require(!enabled||minAmount>0,"BAD_CONFIG");
        routeForToken[token]=Route(rewardAsset,source,distributor,minAmount,enabled);
        emit RouteConfigured(token,rewardAsset,source,distributor,minAmount,enabled);
    }

    /// @notice Called by the configured source after it has determined the exact
    /// distributable amount. This contract never receives custody or token approval.
    function release(address token,uint256 amount) external {
        require(!paused,"PAUSED");
        Route memory r=routeForToken[token];
        require(r.enabled&&msg.sender==r.source&&amount>=r.minAmount,"NOT_READY");
        require(amount<=IERC20RewardSource(r.rewardAsset).balanceOf(r.source),"INSUFFICIENT_SOURCE");
        require(IERC20RewardSource(r.rewardAsset).transfer(r.distributor,amount),"TRANSFER_FAILED");
        emit FundingReleased(token,r.distributor,amount);
    }
}
