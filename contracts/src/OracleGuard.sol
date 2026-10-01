// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAggregator{function latestRoundData()external view returns(uint80,int256,uint256,uint256,uint80);function decimals()external view returns(uint8);}
contract OracleGuard{
 uint256 public immutable maxAge;constructor(uint256 a){require(a>0,"ZERO_AGE");maxAge=a;}
 function read(address f)public view returns(uint256){require(f!=address(0),"ZERO_FEED");(uint80 round,int256 p,,uint256 u,uint80 answered)=IAggregator(f).latestRoundData();require(round>0&&p>0&&u!=0&&answered>=round&&block.timestamp>=u&&block.timestamp-u<=maxAge,"INVALID_PRICE");uint8 d=IAggregator(f).decimals();require(d<=36,"BAD_DECIMALS");uint256 v=uint256(p);uint256 normalized=d==18?v:d<18?v*(10**(18-d)):v/(10**(d-18));require(normalized>0,"ZERO_PRICE");return normalized;}
 function crossPrice(address baseFeed,address quoteFeed)external view returns(uint256){uint256 b=read(baseFeed);uint256 q=read(quoteFeed);require(q>0&&b<=type(uint256).max/1e18,"INVALID_CROSS_PRICE");return b*1e18/q;}
 function withinDeviation(uint256 oraclePrice,uint256 quotePrice,uint256 maxDeviationBps)external pure returns(bool){if(oraclePrice==0||quotePrice==0||maxDeviationBps>10_000)return false;uint256 diff=oraclePrice>quotePrice?oraclePrice-quotePrice:quotePrice-oraclePrice;uint256 allowed=(oraclePrice/10_000)*maxDeviationBps+(oraclePrice%10_000)*maxDeviationBps/10_000;return diff<=allowed;}
}