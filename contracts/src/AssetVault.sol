// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract AssetVault {
 address public immutable targetAsset; address public immutable launcher; address public immutable executor; address public router; address public quoteToken;
 uint256 public totalEarned; uint256 public totalSpent;
 event RouterBound(address indexed router,address indexed quoteToken); event FundsReceived(address indexed from,uint256 amount,bool countedAsEarned); event EarnedRecorded(address indexed quoteToken,uint256 amount); event PurchaseRecorded(uint256 quoteSpent,uint256 assetReceived);
 modifier onlyLauncher(){require(msg.sender==launcher,"NOT_LAUNCHER");_;} modifier onlyRouter(){require(msg.sender==router&&router!=address(0),"NOT_ROUTER");_;} modifier onlyExecutor(){require(msg.sender==executor,"NOT_EXECUTOR");_;}
 constructor(address asset_,address launcher_,address executor_){require(asset_!=address(0)&&launcher_!=address(0)&&executor_!=address(0),"ZERO_ADDRESS");targetAsset=asset_;launcher=launcher_;executor=executor_;}
 function bindRouter(address router_,address quote_) external onlyLauncher {require(router==address(0)&&router_!=address(0),"ROUTER_ALREADY_BOUND");router=router_;quoteToken=quote_;emit RouterBound(router_,quote_);}
 receive() external payable {bool earned=msg.sender==router&&router!=address(0)&&quoteToken==address(0);if(earned)totalEarned+=msg.value;emit FundsReceived(msg.sender,msg.value,earned);}
 function recordTokenEarned(uint256 amount) external onlyRouter {require(quoteToken!=address(0)&&amount>0,"INVALID_EARNING");totalEarned+=amount;emit EarnedRecorded(quoteToken,amount);}
 function transferEarnedToExecutor(uint256 amount) external onlyExecutor {require(amount>0&&amount<=totalEarned-totalSpent,"EXCEEDS_EARNED");if(quoteToken==address(0)){(bool ok,)=executor.call{value:amount}("");require(ok,"NATIVE_TRANSFER_FAILED");}else{_safeTransfer(quoteToken,executor,amount);}}
 function recordPurchase(uint256 quoteSpent,uint256 assetReceived) external onlyExecutor {require(totalSpent+quoteSpent<=totalEarned,"EXCEEDS_EARNED");totalSpent+=quoteSpent;emit PurchaseRecorded(quoteSpent,assetReceived);}
 function availableEarned() external view returns(uint256){return totalEarned-totalSpent;}
 function _safeTransfer(address token,address to,uint256 amount) private { (bool ok,bytes memory data)=token.call(abi.encodeWithSelector(0xa9059cbb,to,amount));require(ok&&(data.length==0||abi.decode(data,(bool))),"TOKEN_TRANSFER_FAILED"); }
}
