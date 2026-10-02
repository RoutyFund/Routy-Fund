// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20RewardSweep {
    function balanceOf(address account) external view returns(uint256);
    function transferFrom(address from,address to,uint256 amount) external returns(bool);
}

/// @notice Permissionless trigger for a pre-approved reward source. It cannot choose
/// recipients or assets; those are fixed per route. Root publication remains separate.
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
    event FundingTriggered(address indexed token,address indexed distributor,uint256 amount);
    event Paused(bool paused);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}

    constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}

    function setPaused(bool next) external onlyOwner {paused=next;emit Paused(next);}

    function configure(address token,address rewardAsset,address source,address distributor,uint96 minAmount,bool enabled) external onlyOwner {
        require(token!=address(0)&&rewardAsset!=address(0)&&source!=address(0)&&distributor!=address(0),"ZERO_ADDRESS");
        require(!enabled||minAmount>0,"BAD_CONFIG");
        routeForToken[token]=Route(rewardAsset,source,distributor,minAmount,enabled);
        emit RouteConfigured(token,rewardAsset,source,distributor,minAmount,enabled);
    }

    function fund(address token,uint256 amount) external {
        require(!paused,"PAUSED");
        Route memory r=routeForToken[token];
        require(r.enabled&&amount>=r.minAmount,"NOT_READY");
        require(amount<=IERC20RewardSweep(r.rewardAsset).balanceOf(r.source),"INSUFFICIENT_SOURCE");
        require(IERC20RewardSweep(r.rewardAsset).transferFrom(r.source,r.distributor,amount),"TRANSFER_FAILED");
        emit FundingTriggered(token,r.distributor,amount);
    }
}
