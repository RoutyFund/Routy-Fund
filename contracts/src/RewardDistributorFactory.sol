// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AutomatedRewardDistributor.sol";

contract RewardDistributorFactory {
    address public immutable admin;
    address public immutable publisher;
    address public launcher;
    mapping(address=>address) public distributorForRoute;

    event LauncherSet(address indexed launcher);
    event DistributorCreated(address indexed routeToken,address indexed rewardAsset,address indexed distributor);

    modifier onlyAdmin(){require(msg.sender==admin,"NOT_ADMIN");_;}
    modifier onlyLauncher(){require(msg.sender==launcher&&launcher!=address(0),"NOT_LAUNCHER");_;}

    constructor(address admin_,address publisher_){
        require(admin_!=address(0)&&publisher_!=address(0),"ZERO_ADDRESS");
        admin=admin_;
        publisher=publisher_;
    }

    function setLauncher(address launcher_) external onlyAdmin {
        require(launcher==address(0)&&launcher_!=address(0),"LAUNCHER_ALREADY_SET");
        launcher=launcher_;
        emit LauncherSet(launcher_);
    }

    function create(address routeToken,address rewardAsset) external onlyLauncher returns(address distributor){
        require(routeToken!=address(0)&&rewardAsset!=address(0),"ZERO_ADDRESS");
        require(distributorForRoute[routeToken]==address(0),"EXISTS");
        distributor=address(new AutomatedRewardDistributor(rewardAsset,publisher));
        distributorForRoute[routeToken]=distributor;
        emit DistributorCreated(routeToken,rewardAsset,distributor);
    }
}
