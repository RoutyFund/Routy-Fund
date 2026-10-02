// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AutomatedRewardDistributor.sol";
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
    function leaf(address a,uint256 cumulative) internal pure returns(bytes32){
        return keccak256(bytes.concat(keccak256(abi.encode(a,cumulative))));
    }
    function testFactoryOnlyLauncherAndCumulativeClaim() public {
        AutoRewardToken t=new AutoRewardToken();
        RewardDistributorFactory f=new RewardDistributorFactory(address(this),address(this));
        f.setLauncher(address(this));
        address a=f.create(address(0xBEEF),address(t));
        AutomatedRewardDistributor d=AutomatedRewardDistributor(a);
        t.mint(a,100);
        d.publishRoot(leaf(address(this),40));
        bytes32[] memory proof=new bytes32[](0);
        d.claim(40,proof);
        require(t.balanceOf(address(this))==40,"BAD_FIRST");
        try d.claim(40,proof){revert("SHOULD_REVERT");}catch{}
        d.publishRoot(leaf(address(this),70));
        d.claim(70,proof);
        require(t.balanceOf(address(this))==70,"BAD_CUMULATIVE");
    }
}
