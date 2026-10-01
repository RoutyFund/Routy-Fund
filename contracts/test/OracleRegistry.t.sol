// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/OracleRegistry.sol";
contract OracleRegistryTest{
 function testOwnerSetsFeed()public{OracleRegistry r=new OracleRegistry(address(this));address asset=address(0xA11CE);address feed=address(0xFEE1);r.setFeed(asset,feed);require(r.feedForAsset(asset)==feed,"BAD_FEED");}
 function testOwnershipStartsTwoStep()public{OracleRegistry r=new OracleRegistry(address(this));r.transferOwnership(address(0xBEEF));require(r.owner()==address(this),"OWNER_CHANGED");require(r.pendingOwner()==address(0xBEEF),"BAD_PENDING");}
 function testZeroFeedRejected()public{OracleRegistry r=new OracleRegistry(address(this));try r.setFeed(address(1),address(0)){revert("SHOULD_REVERT");}catch{}}
}