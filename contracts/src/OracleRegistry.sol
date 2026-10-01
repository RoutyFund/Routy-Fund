// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract OracleRegistry{
 address public immutable owner;mapping(address=>address)public feedForAsset;event FeedSet(address indexed asset,address indexed feed);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function setFeed(address asset,address feed)external onlyOwner{require(asset!=address(0)&&feed!=address(0),"ZERO_ADDRESS");feedForAsset[asset]=feed;emit FeedSet(asset,feed);}
}