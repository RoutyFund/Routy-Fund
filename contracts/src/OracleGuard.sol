// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAggregator{function latestRoundData()external view returns(uint80,int256,uint256,uint256,uint80);}
contract OracleGuard{
 uint256 public immutable maxAge;constructor(uint256 a){require(a>0,"ZERO_AGE");maxAge=a;}
 function read(address f)public view returns(uint256){require(f!=address(0),"ZERO_FEED");(uint80 round,int256 p,,uint256 u,uint80 answered)=IAggregator(f).latestRoundData();require(p>0&&u!=0&&answered>=round&&block.timestamp>=u&&block.timestamp-u<=maxAge,"INVALID_PRICE");return uint256(p);}
 function withinDeviation(uint256 oraclePrice,uint256 quotePrice,uint256 maxDeviationBps)external pure returns(bool){if(oraclePrice==0||quotePrice==0||maxDeviationBps>10_000)return false;uint256 diff=oraclePrice>quotePrice?oraclePrice-quotePrice:quotePrice-oraclePrice;return diff*10_000<=oraclePrice*maxDeviationBps;}
}