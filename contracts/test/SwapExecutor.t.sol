// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/SwapExecutor.sol";
contract MockAsset{mapping(address=>uint256)public balanceOf;function mint(address a,uint256 n)external{balanceOf[a]+=n;}function transfer(address,uint256)external pure returns(bool){return true;}}
contract MockVault{address public targetAsset;address public quoteToken;uint256 public availableEarned=100;uint256 public spent;address public executor;constructor(address a,address e){targetAsset=a;executor=e;}function recordPurchase(uint256 q,uint256)external{require(msg.sender==executor,"NOT_EXECUTOR");availableEarned-=q;spent+=q;}}
contract SwapExecutorTest{
 function testSettlementRequiresApprovalAndUnpause()public{SwapExecutor e=new SwapExecutor(address(this));MockAsset t=new MockAsset();MockVault v=new MockVault(address(t),address(e));t.mint(address(v),50);try e.settlePurchase(address(v),10,50){revert("SHOULD_REVERT");}catch{}e.setVault(address(v),true);e.setPaused(false);e.settlePurchase(address(v),10,50);require(v.spent()==10,"NOT_RECORDED");}
 function testMissingAssetRejected()public{SwapExecutor e=new SwapExecutor(address(this));MockAsset t=new MockAsset();MockVault v=new MockVault(address(t),address(e));e.setVault(address(v),true);e.setPaused(false);try e.settlePurchase(address(v),10,1){revert("SHOULD_REVERT");}catch{}}
 function testTwoStepOwnership()public{SwapExecutor e=new SwapExecutor(address(this));e.transferOwnership(address(7));require(e.pendingOwner()==address(7),"BAD_PENDING");}
}