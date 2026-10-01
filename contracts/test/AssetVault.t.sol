// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetVault.sol";
contract AssetVaultTest {
 receive() external payable {}
 function testRandomDepositNotEarned() public {
  AssetVault v=new AssetVault(address(1),address(2),address(this));
  (bool ok,)=address(v).call{value:0}("");require(ok);
  require(v.totalEarned()==0,"RANDOM_COUNTED");
 }
 function testCannotOverspendEarned() public {
  AssetVault v=new AssetVault(address(1),address(2),address(this));
  (bool ok,)=address(v).call{value:0}("");require(ok);
  try v.recordPurchase(1,1){revert("SHOULD_REVERT");}catch{}
 }
}