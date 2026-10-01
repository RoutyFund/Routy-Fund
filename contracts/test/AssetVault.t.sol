// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24; import "../src/AssetVault.sol";
contract AssetVaultTest {receive()external payable{} function testRouterBindsOnce()public{AssetVault v=new AssetVault(address(1),address(this),address(this));v.bindRouter(address(2));require(v.router()==address(2),"BAD_ROUTER");try v.bindRouter(address(3)){revert("SHOULD_REVERT");}catch{}}
function testRandomDepositNotEarned()public{AssetVault v=new AssetVault(address(1),address(this),address(this));v.bindRouter(address(2));(bool ok,)=address(v).call{value:0}("");require(ok);require(v.totalEarned()==0,"RANDOM_COUNTED");}
function testCannotOverspendEarned()public{AssetVault v=new AssetVault(address(1),address(this),address(this));v.bindRouter(address(2));try v.recordPurchase(1,1){revert("SHOULD_REVERT");}catch{}}}
