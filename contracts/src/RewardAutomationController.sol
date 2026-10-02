// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IManagedAutoPushDistributor {
    function publisher() external view returns(address);
    function setPaused(bool next) external;
    function distributeBatch(address[] calldata accounts,uint256[] calldata cumulativeAmounts) external;
}

/// @notice Separates protocol ownership from unattended reward publishing.
/// Owner controls keeper rotation and distributor activation. The keeper can only
/// submit reward batches to distributors whose immutable publisher is this controller.
contract RewardAutomationController {
    address public owner;
    address public keeper;

    event OwnerTransferred(address indexed previousOwner,address indexed newOwner);
    event KeeperSet(address indexed previousKeeper,address indexed newKeeper);
    event DistributorPauseSet(address indexed distributor,bool paused);
    event DistributionSubmitted(address indexed distributor,uint256 recipients);

    error NotOwner();
    error NotKeeper();
    error ZeroAddress();
    error WrongPublisher();

    modifier onlyOwner(){if(msg.sender!=owner) revert NotOwner();_;}
    modifier onlyKeeper(){if(msg.sender!=keeper) revert NotKeeper();_;}

    constructor(address owner_,address keeper_){
        if(owner_==address(0)||keeper_==address(0)) revert ZeroAddress();
        owner=owner_;
        keeper=keeper_;
    }

    function transferOwnership(address next) external onlyOwner {
        if(next==address(0)) revert ZeroAddress();
        address previous=owner;
        owner=next;
        emit OwnerTransferred(previous,next);
    }

    function setKeeper(address next) external onlyOwner {
        if(next==address(0)) revert ZeroAddress();
        address previous=keeper;
        keeper=next;
        emit KeeperSet(previous,next);
    }

    function setDistributorPaused(address distributor,bool next) external onlyOwner {
        _assertManaged(distributor);
        IManagedAutoPushDistributor(distributor).setPaused(next);
        emit DistributorPauseSet(distributor,next);
    }

    function distribute(
        address distributor,
        address[] calldata accounts,
        uint256[] calldata cumulativeAmounts
    ) external onlyKeeper {
        _assertManaged(distributor);
        IManagedAutoPushDistributor(distributor).distributeBatch(accounts,cumulativeAmounts);
        emit DistributionSubmitted(distributor,accounts.length);
    }

    function _assertManaged(address distributor) private view {
        if(distributor==address(0)) revert ZeroAddress();
        if(IManagedAutoPushDistributor(distributor).publisher()!=address(this)) revert WrongPublisher();
    }
}
