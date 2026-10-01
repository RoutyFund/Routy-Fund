// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract OracleRegistry{
 address public owner;address public pendingOwner;address public nativeFeed;mapping(address=>address)private feeds;
 event FeedSet(address indexed asset,address indexed feed);event OwnershipTransferStarted(address indexed owner,address indexed pendingOwner);event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function transferOwnership(address next)external onlyOwner{require(next!=address(0),"ZERO_OWNER");pendingOwner=next;emit OwnershipTransferStarted(owner,next);}
 function acceptOwnership()external{require(msg.sender==pendingOwner,"NOT_PENDING_OWNER");address old=owner;owner=msg.sender;pendingOwner=address(0);emit OwnershipTransferred(old,msg.sender);}
 function setFeed(address asset,address feed)external onlyOwner{require(asset!=address(0)&&feed!=address(0),"ZERO_ADDRESS");feeds[asset]=feed;emit FeedSet(asset,feed);}
 function setNativeFeed(address feed)external onlyOwner{require(feed!=address(0),"ZERO_FEED");nativeFeed=feed;emit FeedSet(address(0),feed);}
 function feedForAsset(address asset)external view returns(address){return asset==address(0)?nativeFeed:feeds[asset];}
}