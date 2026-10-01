// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./interfaces/IPonsFeeEscrow.sol";
interface IERC20Lite{function balanceOf(address)external view returns(uint256);function transfer(address,uint256)external returns(bool);}
contract FeeRouter{
 uint256 public constant BPS=10_000;uint256 public constant VAULT_BPS=8_000;
 address public immutable launchedToken;IPonsV2FeeEscrow public immutable feeEscrow;address public immutable quoteToken;address public immutable assetVault;address public immutable treasury;bool private locked;
 event Harvested(address indexed quoteToken,uint256 claimed,uint256 vaultAmount,uint256 treasuryAmount);
 modifier nonReentrant(){require(!locked,"REENTRANT");locked=true;_;locked=false;}
 constructor(address token_,address escrow_,address quote_,address vault_,address treasury_){require(token_!=address(0)&&escrow_!=address(0)&&vault_!=address(0)&&treasury_!=address(0),"ZERO_ADDRESS");launchedToken=token_;feeEscrow=IPonsV2FeeEscrow(escrow_);quoteToken=quote_;assetVault=vault_;treasury=treasury_;}
 receive()external payable{}
 function harvest()external nonReentrant returns(uint256 claimed){
  if(quoteToken==address(0)){uint256 beforeBal=address(this).balance;feeEscrow.claim();claimed=address(this).balance-beforeBal;require(claimed>0,"NO_NEW_FEES");uint256 v=claimed*VAULT_BPS/BPS;uint256 t=claimed-v;(bool okV,)=assetVault.call{value:v}("");require(okV,"VAULT_TRANSFER_FAILED");(bool okT,)=treasury.call{value:t}("");require(okT,"TREASURY_TRANSFER_FAILED");emit Harvested(address(0),claimed,v,t);}
  else{IERC20Lite q=IERC20Lite(quoteToken);uint256 beforeBal=q.balanceOf(address(this));feeEscrow.claimToken(quoteToken);claimed=q.balanceOf(address(this))-beforeBal;require(claimed>0,"NO_NEW_FEES");uint256 v=claimed*VAULT_BPS/BPS;uint256 t=claimed-v;require(q.transfer(assetVault,v),"VAULT_TRANSFER_FAILED");require(q.transfer(treasury,t),"TREASURY_TRANSFER_FAILED");emit Harvested(quoteToken,claimed,v,t);}
 }
}