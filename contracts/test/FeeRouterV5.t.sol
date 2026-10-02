// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/FeeRouterFactoryV5.sol";

contract FeeRouterV5Token {
    mapping(address=>uint256) public balanceOf;
    function mint(address recipient,uint256 amount) external {balanceOf[recipient]+=amount;}
    function transfer(address recipient,uint256 amount) external returns(bool){require(balanceOf[msg.sender]>=amount);balanceOf[msg.sender]-=amount;balanceOf[recipient]+=amount;return true;}
}
contract FeeRouterV5MockEscrow {
    mapping(address=>uint256) public due;
    mapping(address=>mapping(address=>uint256)) public tokenDue;
    function seed(address recipient) external payable {due[recipient]+=msg.value;}
    function claim() external returns(uint256 amount){amount=due[msg.sender];due[msg.sender]=0;(bool ok,)=msg.sender.call{value:amount}("");require(ok);}
    function claim(uint256 amount) external returns(uint256){require(due[msg.sender]>=amount);due[msg.sender]-=amount;(bool ok,)=msg.sender.call{value:amount}("");require(ok);return amount;}
    function seedToken(address recipient,address token,uint256 amount) external {tokenDue[token][recipient]+=amount;FeeRouterV5Token(token).mint(address(this),amount);}
    function claimToken(address token) external returns(uint256 amount){amount=tokenDue[token][msg.sender];tokenDue[token][msg.sender]=0;require(FeeRouterV5Token(token).transfer(msg.sender,amount));}
    function claimToken(address,uint256) external pure returns(uint256){return 0;}
    function credit(address) external payable {}
    function creditToken(address,address,uint256) external {}
    function balanceOf(address recipient) external view returns(uint256){return due[recipient];}
    function balanceOfToken(address,address) external pure returns(uint256){return 0;}
}
contract FeeRouterV5Vault { uint256 public tokenEarned; receive() external payable {} function recordTokenEarned(uint256 amount) external {tokenEarned+=amount;} }
contract FeeRouterV5Treasury { receive() external payable {} }
contract FeeRouterV5RejectTreasury { receive() external payable {revert();} }
contract FeeRouterV5ReentrantVault {
    FeeRouterV5 private router;
    bool public reentryRejected;
    constructor(address router_){router=FeeRouterV5(payable(router_));}
    receive() external payable {(bool ok,)=address(router).call(abi.encodeWithSelector(router.harvest.selector));reentryRejected=!ok;}
}

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

    function testCompactFactoryDeploymentGasBudget() public {
        uint256 beforeGas=gasleft();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(0xABCD),address(0xDCBA));
        uint256 used=beforeGas-gasleft();
        // Leaves room for the creation transaction's calldata and intrinsic gas within 1.2M.
        require(used<1_050_000,"FACTORY_EXCEEDS_MOBILE_GAS_BUDGET");
        require(factory.admin()==address(this),"BAD_ADMIN");
    }

    function testTokenFeesKeepSplitAndVaultAccounting() public {
        FeeRouterV5MockEscrow escrow=new FeeRouterV5MockEscrow();
        FeeRouterV5Treasury treasury=new FeeRouterV5Treasury();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(escrow),address(treasury));
        address router=factory.prepare(address(this),keccak256("token-fees"));
        FeeRouterV5Token token=new FeeRouterV5Token();
        FeeRouterV5Vault vault=new FeeRouterV5Vault();
        escrow.seedToken(router,address(token),1000);
        factory.setLauncher(address(this));
        factory.bind(router,address(0xCAFE),address(token),address(vault));
        require(FeeRouterV5(payable(router)).harvest()==1000,"BAD_CLAIM");
        require(token.balanceOf(address(vault))==800&&token.balanceOf(address(treasury))==200,"BAD_TOKEN_SPLIT");
        require(vault.tokenEarned()==800,"BAD_ACCOUNTING");
        (bool again,)=router.call(abi.encodeWithSelector(FeeRouterV5.harvest.selector));
        require(!again,"EMPTY_HARVEST_ALLOWED");
    }

    function testFactoryAndRouterAccessChecksRemainEnforced() public {
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(0xBEEF),address(0xABCD),address(0xDCBA));
        (bool prepared,)=address(factory).call(abi.encodeWithSelector(factory.prepare.selector,address(this),bytes32(0)));
        require(!prepared,"UNAUTHORIZED_PREPARE");
        factory.setOperator(address(this));
        address router=factory.prepare(address(this),bytes32(0));
        (bool bound,)=router.call(abi.encodeWithSelector(FeeRouterV5.bind.selector,address(0xCAFE),address(0),address(this)));
        require(!bound,"UNAUTHORIZED_BIND");
        (bool harvested,)=router.call(abi.encodeWithSelector(FeeRouterV5.harvest.selector));
        require(!harvested,"UNBOUND_HARVEST");
        (bool duplicate,)=address(factory).call(abi.encodeWithSelector(factory.prepare.selector,address(this),bytes32(0)));
        require(!duplicate,"DUPLICATE_ROUTER");
    }

    function testTreasuryRejectionRollsBackClaimAndVaultTransfer() public {
        FeeRouterV5MockEscrow escrow=new FeeRouterV5MockEscrow();
        FeeRouterV5RejectTreasury treasury=new FeeRouterV5RejectTreasury();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(escrow),address(treasury));
        address router=factory.prepare(address(this),keccak256("rollback"));
        FeeRouterV5Vault vault=new FeeRouterV5Vault();
        factory.setLauncher(address(this));
        factory.bind(router,address(0xCAFE),address(0),address(vault));
        escrow.seed{value:100}(router);
        (bool ok,)=router.call(abi.encodeWithSelector(FeeRouterV5.harvest.selector));
        require(!ok&&escrow.balanceOf(router)==100&&address(vault).balance==0,"CLAIM_NOT_ATOMIC");
    }

    function testReentrantHarvestBlockedAndLaterHarvestStillWorks() public {
        FeeRouterV5MockEscrow escrow=new FeeRouterV5MockEscrow();
        FeeRouterV5Treasury treasury=new FeeRouterV5Treasury();
        FeeRouterFactoryV5 factory=new FeeRouterFactoryV5(address(this),address(this),address(escrow),address(treasury));
        address router=factory.prepare(address(this),keccak256("reentrant"));
        FeeRouterV5ReentrantVault vault=new FeeRouterV5ReentrantVault(router);
        factory.setLauncher(address(this));
        factory.bind(router,address(0xCAFE),address(0),address(vault));
        escrow.seed{value:100}(router);
        FeeRouterV5(payable(router)).harvest();
        require(vault.reentryRejected()&&address(vault).balance==80,"REENTRY_ALLOWED");
        escrow.seed{value:100}(router);
        FeeRouterV5(payable(router)).harvest();
        require(address(vault).balance==160&&address(treasury).balance==40,"LOCK_NOT_RELEASED");
    }
}
