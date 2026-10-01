// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;import "../src/FeeRouter.sol";
contract MockEscrow{mapping(address=>uint256)public due;function seed(address a)external payable{due[a]+=msg.value;}function claim()external returns(uint256 a){a=due[msg.sender];due[msg.sender]=0;(bool ok,)=msg.sender.call{value:a}("");require(ok);}function claimToken(address)external pure returns(uint256){return 0;}}
contract Sink{receive()external payable{}}
contract FeeRouterTest{
 receive()external payable{}
 function testConstants()public{MockEscrow e=new MockEscrow();Sink v=new Sink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));require(r.VAULT_BPS()==8000&&r.BPS()==10000,"BAD_SPLIT");}
 function testNativeHarvestSplitsExactly()public{MockEscrow e=new MockEscrow();Sink v=new Sink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));e.seed{value:100}(address(r));uint256 beforeV=address(v).balance;uint256 beforeT=address(t).balance;r.harvest();require(address(v).balance-beforeV==80,"BAD_VAULT");require(address(t).balance-beforeT==20,"BAD_TREASURY");}
 function testNoFeesReverts()public{MockEscrow e=new MockEscrow();Sink v=new Sink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));try r.harvest(){revert("SHOULD_REVERT");}catch{}}
}