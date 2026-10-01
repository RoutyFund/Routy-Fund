// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AssetVault {
 address public immutable targetAsset; address public immutable launcher; address public immutable executor; address public router;
 uint256 public totalEarned; uint256 public totalSpent;
 event RouterBound(address indexed router); event FundsReceived(address indexed from,uint256 amount,bool countedAsEarned); event PurchaseRecorded(uint256 quoteSpent,uint256 assetReceived);
 modifier onlyLauncher(){require(msg.sender==launcher,"NOT_LAUNCHER");_;} modifier onlyExecutor(){require(msg.sender==executor,"NOT_EXECUTOR");_;}
 constructor(address asset_,address launcher_,address executor_){require(asset_!=address(0)&&launcher_!=address(0)&&executor_!=address(0),"ZERO_ADDRESS");targetAsset=asset_;launcher=launcher_;executor=executor_;}
 function bindRouter(address router_) external onlyLauncher {require(router==address(0)&&router_!=address(0),"ROUTER_ALREADY_BOUND");router=router_;emit RouterBound(router_);}
 receive() external payable {bool earned=msg.sender==router&&router!=address(0);if(earned)totalEarned+=msg.value;emit FundsReceived(msg.sender,msg.value,earned);}
 function recordPurchase(uint256 quoteSpent,uint256 assetReceived) external onlyExecutor {require(totalSpent+quoteSpent<=totalEarned,"EXCEEDS_EARNED");totalSpent+=quoteSpent;emit PurchaseRecorded(quoteSpent,assetReceived);}
 function availableEarned() external view returns(uint256){return totalEarned-totalSpent;}
}
