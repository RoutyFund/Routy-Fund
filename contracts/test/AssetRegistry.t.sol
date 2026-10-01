// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;import "../src/AssetRegistry.sol";
contract AssetRegistryTest{
 function testOwnerCanApproveAndHalt()public{AssetRegistry r=new AssetRegistry(address(this));address a=address(0x1234);r.setApproved(a,true);require(r.tradable(a),"NOT_TRADABLE");r.setHalted(a,true);require(!r.tradable(a),"HALT_FAILED");}
}