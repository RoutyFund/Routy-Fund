// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/OracleGuard.sol";
contract Feed{int256 p;uint8 d;uint256 u;uint80 round=1;uint80 answered=1;constructor(int256 p_,uint8 d_){p=p_;d=d_;u=block.timestamp;}function set(int256 p_,uint256 u_,uint80 answered_)external{p=p_;u=u_;answered=answered_;}function decimals()external view returns(uint8){return d;}function latestRoundData()external view returns(uint80,int256,uint256,uint256,uint80){return(round,p,0,u,answered);}}
contract OracleGuardTest{
 function testDeviation()public{OracleGuard g=new OracleGuard(1 hours);require(g.withinDeviation(100,101,100),"WITHIN");require(!g.withinDeviation(100,103,100),"OUTSIDE");require(!g.withinDeviation(0,100,100),"ZERO");require(!g.withinDeviation(100,100,10001),"BPS");}
 function testNormalizesEightDecimals()public{OracleGuard g=new OracleGuard(1 hours);Feed f=new Feed(100_00000000,8);require(g.read(address(f))==100e18,"NORMALIZE");}
 function testCrossPrice()public{OracleGuard g=new OracleGuard(1 hours);Feed stock=new Feed(200_00000000,8);Feed ethUsd=new Feed(4000_00000000,8);require(g.crossPrice(address(stock),address(ethUsd))==5e16,"CROSS");}
 function testRejectsNegativePrice()public{OracleGuard g=new OracleGuard(1 hours);Feed f=new Feed(-1,8);try g.read(address(f)){revert("SHOULD_REVERT");}catch{}}
 function testRejectsIncompleteRound()public{OracleGuard g=new OracleGuard(1 hours);Feed f=new Feed(100_00000000,8);f.set(100_00000000,block.timestamp,0);try g.read(address(f)){revert("SHOULD_REVERT");}catch{}}
}