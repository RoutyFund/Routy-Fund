// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IVaultSwap {
 function targetAsset() external view returns(address);
 function quoteToken() external view returns(address);
 function availableEarned() external view returns(uint256);
 function recordPurchase(uint256,uint256) external;
}
interface IERC20Swap {function balanceOf(address)external view returns(uint256);function transfer(address,uint256)external returns(bool);}
contract SwapExecutor {
 address public owner;address public pendingOwner;bool public paused=true;mapping(address=>bool)public approvedVault;
 event VaultApproval(address indexed vault,bool approved);event PauseStateChanged(bool paused);event OwnershipTransferStarted(address indexed owner,address indexed pendingOwner);event OwnershipTransferred(address indexed oldOwner,address indexed newOwner);event PurchaseSettled(address indexed vault,address indexed targetAsset,uint256 quoteSpent,uint256 assetReceived);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function transferOwnership(address next)external onlyOwner{require(next!=address(0),"ZERO_OWNER");pendingOwner=next;emit OwnershipTransferStarted(owner,next);}
 function acceptOwnership()external{require(msg.sender==pendingOwner,"NOT_PENDING_OWNER");address old=owner;owner=msg.sender;pendingOwner=address(0);emit OwnershipTransferred(old,msg.sender);}
 function setVault(address vault,bool ok)external onlyOwner{require(vault!=address(0),"ZERO_VAULT");approvedVault[vault]=ok;emit VaultApproval(vault,ok);}
 function setPaused(bool next)external onlyOwner{paused=next;emit PauseStateChanged(next);}
 function settlePurchase(address vault,uint256 quoteSpent,uint256 assetReceived)external onlyOwner{
   require(!paused&&approvedVault[vault],"NOT_ACTIVE");require(quoteSpent>0&&assetReceived>0,"ZERO_AMOUNT");
   IVaultSwap v=IVaultSwap(vault);require(quoteSpent<=v.availableEarned(),"EXCEEDS_EARNED");
   address asset=v.targetAsset();require(IERC20Swap(asset).balanceOf(vault)>=assetReceived,"ASSET_NOT_RECEIVED");
   v.recordPurchase(quoteSpent,assetReceived);emit PurchaseSettled(vault,asset,quoteSpent,assetReceived);
 }
}
