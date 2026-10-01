// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/RewardDistributor.sol";
contract RewardToken {mapping(address=>uint256)public balanceOf;function mint(address a,uint256 n)external{balanceOf[a]+=n;}function transfer(address to,uint256 n)external returns(bool){require(balanceOf[msg.sender]>=n,"BALANCE");balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;}}
contract RewardDistributorTest {
 function leaf(address a,uint256 cumulative)internal pure returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(a,cumulative))));}
 function testCumulativeClaimCannotDoubleClaim() public {
  RewardToken t=new RewardToken();RewardDistributor d=new RewardDistributor(address(t),address(this));t.mint(address(d),100);
  d.publishRoot(leaf(address(this),40));bytes32[] memory proof=new bytes32[](0);d.claim(40,proof);require(t.balanceOf(address(this))==40,"BAD_FIRST");
  try d.claim(40,proof){revert("SHOULD_REVERT");}catch{}
  d.publishRoot(leaf(address(this),70));d.claim(70,proof);require(t.balanceOf(address(this))==70,"BAD_CUMULATIVE");require(d.claimed(address(this))==70,"BAD_ACCOUNTING");
 }
}