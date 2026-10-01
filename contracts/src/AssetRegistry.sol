// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AssetRegistry{
 address public owner;address public pendingOwner;mapping(address=>bool)public approved;mapping(address=>bool)public halted;
 event ApprovalSet(address indexed asset,bool approved);event HaltSet(address indexed asset,bool halted);event OwnershipTransferStarted(address indexed owner,address indexed pendingOwner);event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function transferOwnership(address next)external onlyOwner{require(next!=address(0),"ZERO_OWNER");pendingOwner=next;emit OwnershipTransferStarted(owner,next);}
 function acceptOwnership()external{require(msg.sender==pendingOwner,"NOT_PENDING_OWNER");address old=owner;owner=msg.sender;pendingOwner=address(0);emit OwnershipTransferred(old,msg.sender);}
 function setApproved(address asset,bool ok)external onlyOwner{require(asset!=address(0),"ZERO_ASSET");approved[asset]=ok;emit ApprovalSet(asset,ok);}
 function setHalted(address asset,bool value)external onlyOwner{require(asset!=address(0),"ZERO_ASSET");halted[asset]=value;emit HaltSet(asset,value);}
 function tradable(address asset)external view returns(bool){return approved[asset]&&!halted[asset];}
}