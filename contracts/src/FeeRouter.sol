// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IFeeSource{function claimFees(address token)external returns(uint256);}
contract FeeRouter{
 uint256 public constant BPS=10_000;uint256 public constant VAULT_BPS=8_000;
 address public immutable launchedToken;address public immutable feeSource;address public immutable assetVault;address public immutable treasury;
 uint256 public accountedBalance;bool private locked;
 event Harvested(uint256 claimed,uint256 vaultAmount,uint256 treasuryAmount);
 modifier nonReentrant(){require(!locked,"REENTRANT");locked=true;_;locked=false;}
 constructor(address t,address f,address v,address tr){require(t!=address(0)&&f!=address(0)&&v!=address(0)&&tr!=address(0),"ZERO_ADDRESS");launchedToken=t;feeSource=f;assetVault=v;treasury=tr;}
 receive()external payable{}
 function harvest()external nonReentrant returns(uint256 claimed){
  uint256 beforeBalance=address(this).balance;IFeeSource(feeSource).claimFees(launchedToken);uint256 afterBalance=address(this).balance;
  claimed=afterBalance>beforeBalance?afterBalance-beforeBalance:0;require(claimed>0,"NO_NEW_FEES");
  uint256 vaultAmount=claimed*VAULT_BPS/BPS;uint256 treasuryAmount=claimed-vaultAmount;
  (bool v,)=assetVault.call{value:vaultAmount}("");require(v,"VAULT_TRANSFER_FAILED");
  (bool t,)=treasury.call{value:treasuryAmount}("");require(t,"TREASURY_TRANSFER_FAILED");
  emit Harvested(claimed,vaultAmount,treasuryAmount);
 }
}