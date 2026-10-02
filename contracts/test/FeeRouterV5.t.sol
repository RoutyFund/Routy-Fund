// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/FeeRouterFactoryV5.sol";

contract FeeRouterV5MockEscrow {
    mapping(address=>uint256) public due;
    function seed(address recipient) external payable {due[recipient]+=msg.value;}
    function claim() external returns(uint256 amount){amount=due[msg.sender];due[msg.sender]=0;(bool ok,)=msg.sender.call{value:amount}("");require(ok);}
    function claim(uint256 amount) external returns(uint256){require(due[msg.sender]>=amount);due[msg.sender]-=amount;(bool ok,)=msg.sender.call{value:amount}("");require(ok);return amount;}
    function claimToken(address) external pure returns(uint256){return 0;}
    function claimToken(address,uint256) external pure returns(uint256){return 0;}
    function credit(address) external payable {}
    function creditToken(address,address,uint256) external {}
    function balanceOf(address recipient) external view returns(uint256){return due[recipient];}
    function balanceOfToken(address,address) external pure returns(uint256){return 0;}
}
contract FeeRouterV5Vault { receive() external payable {} function recordTokenEarned(uint256) external {} }
contract FeeRouterV5Treasury { receive() external payable {} }

contract FeeRouterV5Test {
    receive() external payable {}

    function testPreparedRouterCanReceivePonsFeesBeforeBinding() public {
        FeeRouterV5MockEscrow escrow=new FeeRouterV5MockEscrow();
        FeeRouterV5Treasury treasury=new FeeRouterV5Treasury();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(escrow),address(treasury));
        bytes32 salt=keccak256("launch-1");
        address predicted=factory.predictRouter(address(this),salt);
        address router=factory.prepare(address(this),salt);
        require(router==predicted,"PREDICTION_MISMATCH");
        require(factory.creatorForRouter(router)==address(this),"BAD_CREATOR");

        escrow.seed{value:100}(router);
        require(escrow.balanceOf(router)==100,"FEE_NOT_CREDITED");

        FeeRouterV5Vault vault=new FeeRouterV5Vault();
        factory.setLauncher(address(this));
        factory.bind(router,address(0xBEEF),address(0),address(vault));
        FeeRouterV5(payable(router)).harvest();

        require(address(vault).balance==80,"BAD_VAULT_SPLIT");
        require(address(treasury).balance==20,"BAD_TREASURY_SPLIT");
        require(FeeRouterV5(payable(router)).launchedToken()==address(0xBEEF),"BAD_TOKEN_BIND");
    }

    function testRouterCannotBindTwice() public {
        FeeRouterV5MockEscrow escrow=new FeeRouterV5MockEscrow();
        FeeRouterV5Treasury treasury=new FeeRouterV5Treasury();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(escrow),address(treasury));
        address router=factory.prepare(address(this),keccak256("launch-2"));
        FeeRouterV5Vault vault=new FeeRouterV5Vault();
        factory.setLauncher(address(this));
        factory.bind(router,address(0xCAFE),address(0),address(vault));
        (bool ok,)=address(factory).call(abi.encodeWithSelector(factory.bind.selector,router,address(0xCAFE),address(0),address(vault)));
        require(!ok,"DOUBLE_BIND_ALLOWED");
    }
}
