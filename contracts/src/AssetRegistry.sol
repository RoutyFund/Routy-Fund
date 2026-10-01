// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AssetRegistry {
    address public owner;
    mapping(address => bool) public approved;

    event AssetApprovalChanged(address indexed asset, bool approvedStatus);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "ZERO_OWNER");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function setApproved(address asset, bool status) external onlyOwner {
        require(asset != address(0), "ZERO_ASSET");
        approved[asset] = status;
        emit AssetApprovalChanged(asset, status);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
