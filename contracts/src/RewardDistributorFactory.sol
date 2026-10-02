// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AutomatedRewardDistributor.sol";

contract RewardDistributorFactory {
    address public immutable publisher;
    mapping(address=>address) public distributorForRoute;
    event DistributorCreated(address indexed routeToken,address indexed rewardAsset,address indexed distributor);

    constructor(address publisher_){
        require(publisher_!=address(0),"ZERO_PUBLISHER");
        publisher=publisher_;
    }

    function create(address routeToken,address rewardAsset) external returns(address distributor){
        require(routeToken!=address(0)&&rewardAsset!=address(0),"ZERO_ADDRESS");
        require(distributorForRoute[routeToken]==address(0),"EXISTS");
        distributor=address(new AutomatedRewardDistributor(rewardAsset,publisher));
        distributorForRoute[routeToken]=distributor;
        emit DistributorCreated(routeToken,rewardAsset,distributor);
    }
}
