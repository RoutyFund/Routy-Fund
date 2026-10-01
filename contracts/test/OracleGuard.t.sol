// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;import "../src/OracleGuard.sol";
contract Feed{int256 p=100;uint256 u=block.timestamp;function latestRoundData()external view returns(uint80,int256,uint256,uint256,uint80){return(1,p,0,u,1);}}
contract OracleGuardTest{function testDeviation()public{OracleGuard g=new OracleGuard(1 hours);require(g.withinDeviation(100,101,100),"WITHIN");require(!g.withinDeviation(100,103,100),"OUTSIDE");}function testRead()public{OracleGuard g=new OracleGuard(1 hours);Feed f=new Feed();require(g.read(address(f))==100,"PRICE");}}