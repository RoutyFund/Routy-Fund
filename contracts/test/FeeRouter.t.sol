// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;import "../src/FeeRouter.sol";
contract MockEscrow{mapping(address=>uint256)public due;function seed(address a)external payable{due[a]+=msg.value;}function claim()external returns(uint256 a){a=due[msg.sender];due[msg.sender]=0;(bool ok,)=msg.sender.call{value:a}("");require(ok);}function claimToken(address)external pure returns(uint256){return 0;}}
contract Sink{receive()external payable{}}
contract FeeRouterTest{function testConstants()public{MockEscrow e=new MockEscrow();Sink v=new Sink();Sink t=new Sink();FeeRouter r=new FeeRouter(address(1),address(e),address(0),address(v),address(t));require(r.VAULT_BPS()==8000&&r.BPS()==10000,"BAD_SPLIT");}}
