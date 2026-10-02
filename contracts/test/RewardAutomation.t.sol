// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AutoPushRewardDistributor.sol";
import "../src/RewardDistributorFactory.sol";

contract AutoRewardToken {
    mapping(address=>uint256) public balanceOf;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function transfer(address to,uint256 amount) external returns(bool){
        require(balanceOf[msg.sender]>=amount,"BALANCE");
        balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
    }
}
contract RewardAutomationTest {
    function testFactoryCreatesPushDistributor() public {
        AutoRewardToken t=new AutoRewardToken();
        RewardDistributorFactory f=new RewardDistributorFactory(address(this),address(this));
        f.setLauncher(address(this));
        address a=f.create(address(0xBEEF),address(t));
        AutoPushRewardDistributor d=AutoPushRewardDistributor(a);
        require(d.rewardAsset()==address(t)&&d.publisher()==address(this),"BAD_DISTRIBUTOR");
        require(d.paused(),"MUST_START_PAUSED");
    }
}
