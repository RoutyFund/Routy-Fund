// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;import "../src/FeeRouter.sol";
contract MockERC20{mapping(address=>uint256)public balanceOf;function mint(address a,uint256 n)external{balanceOf[a]+=n;}function transfer(address to,uint256 n)external returns(bool){require(balanceOf[msg.sender]>=n,"BAL");balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;}}
contract MockEscrow{mapping(address=>uint256)public due;mapping(address=>mapping(address=>uint256))public tokenDue;function seed(address a)external payable{due[a]+=msg.value;}function seedToken(address a,address t,uint256 n)external{tokenDue[a][t]+=n;}function claim()external returns(uint256 a){a=due[msg.sender];due[msg.sender]=0;(bool ok,)=msg.sender.call{value:a}("");require(ok);}function claimToken(address t)external returns(uint256 a){a=tokenDue[msg.sender][t];tokenDue[msg.sender][t]=0;require(MockERC20(t).transfer(msg.sender,a));}}
contract Sink{receive()external payable{}}
contract VaultSink{uint256 public earned;receive()external payable{}function recordTokenEarned(uint256 n)external{earned+=n;}}
contract FeeRouterTest{
 receive()external payable{}
 function testNativeHarvestSplitsExactly()public{MockEscrow e=new MockEscrow();VaultSink v=new VaultSink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));e.seed{value:100}(address(r));r.harvest();require(address(v).balance==80,"BAD_VAULT");require(address(t).balance==20,"BAD_TREASURY");}
 function testTokenHarvestSplitsAndAccounts()public{MockERC20 q=new MockERC20();MockEscrow e=new MockEscrow();VaultSink v=new VaultSink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(q),address(v),address(t));q.mint(address(e),100);e.seedToken(address(r),address(q),100);r.harvest();require(q.balanceOf(address(v))==80,"BAD_VAULT_TOKEN");require(q.balanceOf(address(t))==20,"BAD_TREASURY_TOKEN");require(v.earned()==80,"BAD_ACCOUNTING"); }
 function testNoFeesReverts()public{MockEscrow e=new MockEscrow();VaultSink v=new VaultSink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));try r.harvest(){revert("SHOULD_REVERT");}catch{}}
}