// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetVaultV2.sol";
import "../src/AutoPushRewardDistributor.sol";

contract VaultV2Token {
    mapping(address=>uint256) public balanceOf;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function transfer(address to,uint256 amount) external returns(bool){
        require(balanceOf[msg.sender]>=amount,"BALANCE");
        balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
    }
}
contract AssetVaultV2Test {
    function testPurchaseAutomaticallyFundsDistributor() public {
        VaultV2Token target=new VaultV2Token();
        AutoPushRewardDistributor d=new AutoPushRewardDistributor(address(target),address(this));
        AssetVaultV2 v=new AssetVaultV2(address(target),address(this),address(this),address(d));
        v.bindRouter(address(0xBEEF),address(0));
        target.mint(address(v),25);
        v.recordPurchase(0,25);
        require(target.balanceOf(address(v))==0,"VAULT_RETAINED_REWARD");
        require(target.balanceOf(address(d))==25,"DISTRIBUTOR_NOT_FUNDED");
        require(v.totalRewardsFunded()==25,"BAD_ACCOUNTING");
    }
}
