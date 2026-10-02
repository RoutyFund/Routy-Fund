// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AutoPushRewardDistributor.sol";

contract PushRewardToken {
    mapping(address=>uint256) public balanceOf;
    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function transfer(address to,uint256 amount) external returns(bool){
        require(balanceOf[msg.sender]>=amount,"BALANCE");
        balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;
    }
}
contract AutoPushRewardDistributorTest {
    function testPushesWithoutHolderClaimAndUsesCumulativeAccounting() public {
        PushRewardToken t=new PushRewardToken();
        AutoPushRewardDistributor d=new AutoPushRewardDistributor(address(t),address(this));
        address a=address(0xA11CE);address b=address(0xB0B);
        t.mint(address(d),100);
        d.setPaused(false);
        address[] memory accounts=new address[](2);
        uint256[] memory amounts=new uint256[](2);
        accounts[0]=a;accounts[1]=b;amounts[0]=30;amounts[1]=20;
        d.distributeBatch(accounts,amounts);
        require(t.balanceOf(a)==30&&t.balanceOf(b)==20,"BAD_PUSH");
        amounts[0]=40;amounts[1]=25;
        d.distributeBatch(accounts,amounts);
        require(t.balanceOf(a)==40&&t.balanceOf(b)==25,"BAD_CUMULATIVE");
        require(d.totalDistributed()==65,"BAD_TOTAL");
    }
}
