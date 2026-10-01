// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AssetRegistry{
 address public immutable owner;mapping(address=>bool)public approved;mapping(address=>bool)public halted;
 event ApprovalSet(address indexed asset,bool approved);event HaltSet(address indexed asset,bool halted);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function setApproved(address asset,bool ok)external onlyOwner{require(asset!=address(0),"ZERO_ASSET");approved[asset]=ok;emit ApprovalSet(asset,ok);}
 function setHalted(address asset,bool value)external onlyOwner{require(asset!=address(0),"ZERO_ASSET");halted[asset]=value;emit HaltSet(asset,value);}
 function tradable(address asset)external view returns(bool){return approved[asset]&&!halted[asset];}
}