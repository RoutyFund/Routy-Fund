// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/AutoPushRewardDistributor.sol";
import "../src/RewardAutomationController.sol";

contract ControllerRewardToken {
    mapping(address=>uint256) public balanceOf;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function transfer(address to,uint256 amount) external returns(bool){
        require(balanceOf[msg.sender]>=amount,"BALANCE");
        balanceOf[msg.sender]-=amount;
        balanceOf[to]+=amount;
        return true;
    }
}

contract RewardAutomationControllerTest {
    function testKeeperPushesRewardsWithoutOwnerKey() public {
        ControllerRewardToken token=new ControllerRewardToken();
        RewardAutomationController controller=new RewardAutomationController(address(this),address(this));
        AutoPushRewardDistributor distributor=new AutoPushRewardDistributor(address(token),address(controller));

        token.mint(address(distributor),100);
        controller.setDistributorPaused(address(distributor),false);

        address[] memory accounts=new address[](2);
        accounts[0]=address(0xA11CE);
        accounts[1]=address(0xB0B);
        uint256[] memory cumulative=new uint256[](2);
        cumulative[0]=60;
        cumulative[1]=40;

        controller.distribute(address(distributor),accounts,cumulative);

        require(token.balanceOf(accounts[0])==60,"ALICE_REWARD");
        require(token.balanceOf(accounts[1])==40,"BOB_REWARD");
        require(distributor.totalDistributed()==100,"BAD_TOTAL");
    }

    function testControllerRejectsForeignPublisher() public {
        ControllerRewardToken token=new ControllerRewardToken();
        RewardAutomationController controller=new RewardAutomationController(address(this),address(this));
        AutoPushRewardDistributor foreignDistributor=new AutoPushRewardDistributor(address(token),address(this));

        (bool ok,)=address(controller).call(
            abi.encodeWithSelector(controller.setDistributorPaused.selector,address(foreignDistributor),false)
        );
        require(!ok,"FOREIGN_DISTRIBUTOR_ACCEPTED");
    }
}
