// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAssetVaultExec{function targetAsset()external view returns(address);function availableEarned()external view returns(uint256);function recordPurchase(uint256,uint256)external;}
interface IERC20Balance{function balanceOf(address)external view returns(uint256);}
contract SwapExecutor{
 address public immutable owner;mapping(address=>bool)public approvedRouter;bool private locked;
 event RouterApproval(address indexed router,bool approved);event Purchase(address indexed vault,address indexed asset,uint256 ethSpent,uint256 received);
 modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}modifier nonReentrant(){require(!locked,"REENTRANT");locked=true;_;locked=false;}
 constructor(address owner_){require(owner_!=address(0),"ZERO_OWNER");owner=owner_;}
 function setRouter(address router,bool ok)external onlyOwner{approvedRouter[router]=ok;emit RouterApproval(router,ok);}
 function execute(address vault,address router,bytes calldata data,uint256 amountIn,uint256 minOut,uint256 deadline)external onlyOwner nonReentrant returns(uint256 received){
  require(approvedRouter[router],"ROUTER_NOT_APPROVED");require(block.timestamp<=deadline,"EXPIRED");require(amountIn>0&&amountIn<=IAssetVaultExec(vault).availableEarned(),"BAD_AMOUNT");
  address asset=IAssetVaultExec(vault).targetAsset();uint256 beforeBal=IERC20Balance(asset).balanceOf(vault);
  (bool ok,)=router.call{value:amountIn}(data);require(ok,"SWAP_FAILED");
  uint256 afterBal=IERC20Balance(asset).balanceOf(vault);received=afterBal-beforeBal;require(received>=minOut,"SLIPPAGE");
  IAssetVaultExec(vault).recordPurchase(amountIn,received);emit Purchase(vault,asset,amountIn,received);
 }
 receive()external payable{}
}