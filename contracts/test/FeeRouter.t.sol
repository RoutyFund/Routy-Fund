// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/FeeRouter.sol";
contract Sink{receive()external payable{}}
contract Source{function claimFees(address)external returns(uint256){return 0;}}
contract FeeRouterTest{
 function testConstants()public{Sink v=new Sink();Sink t=new Sink();Source s=new Source();FeeRouter r=new FeeRouter(address(1),address(s),address(v),address(t));require(r.VAULT_BPS()==8000,"BAD_SPLIT");require(r.BPS()==10000,"BAD_BPS");}
}