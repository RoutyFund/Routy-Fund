// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FeeRouterV5.sol";

contract FeeRouterFactoryV5 {
    address public immutable admin;
    address public immutable feeEscrow;
    address public immutable treasury;
    address public operator;
    address public launcher;

    mapping(address=>address) public creatorForRouter;
    mapping(address=>address) public routerForToken;

    event OperatorSet(address indexed previousOperator,address indexed nextOperator);
    event LauncherSet(address indexed launcher);
    event RouterPrepared(address indexed creator,address indexed router,bytes32 indexed salt);
    event RouterBound(address indexed token,address indexed router,address indexed vault);

    error NotAdmin();
    error NotOperator();
    error NotLauncher();
    error ZeroAddress();
    error LauncherAlreadySet();
    error ZeroCreator();
    error AlreadyPrepared();
    error BadCreate2();
    error InvalidRouter();

    modifier onlyAdmin(){if(msg.sender!=admin) revert NotAdmin();_;}
    modifier onlyOperator(){if(msg.sender!=operator||operator==address(0)) revert NotOperator();_;}
    modifier onlyLauncher(){if(msg.sender!=launcher||launcher==address(0)) revert NotLauncher();_;}

    constructor(address admin_,address operator_,address escrow_,address treasury_){
        if(admin_==address(0)||operator_==address(0)||escrow_==address(0)||treasury_==address(0)) revert ZeroAddress();
        admin=admin_;operator=operator_;feeEscrow=escrow_;treasury=treasury_;
    }

    function setOperator(address next) external onlyAdmin {
        if(next==address(0)) revert ZeroAddress();
        address previous=operator;operator=next;emit OperatorSet(previous,next);
    }

    function setLauncher(address next) external onlyAdmin {
        if(launcher!=address(0)||next==address(0)) revert LauncherAlreadySet();
        launcher=next;emit LauncherSet(next);
    }

    function routerSalt(address creator,bytes32 salt) public pure returns(bytes32){
        return keccak256(abi.encodePacked(creator,salt));
    }

    function predictRouter(address creator,bytes32 salt) public view returns(address predicted){
        bytes32 finalSalt=routerSalt(creator,salt);
        bytes32 initHash=keccak256(abi.encodePacked(type(FeeRouterV5).creationCode,abi.encode(address(this),feeEscrow,treasury)));
        predicted=address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff),address(this),finalSalt,initHash)))));
    }

    function prepare(address creator,bytes32 salt) external onlyOperator returns(address router){
        if(creator==address(0)) revert ZeroCreator();
        address predicted=predictRouter(creator,salt);
        if(predicted.code.length!=0||creatorForRouter[predicted]!=address(0)) revert AlreadyPrepared();
        router=address(new FeeRouterV5{salt:routerSalt(creator,salt)}(address(this),feeEscrow,treasury));
        if(router!=predicted) revert BadCreate2();
        creatorForRouter[router]=creator;
        emit RouterPrepared(creator,router,salt);
    }

    function bind(address router,address token,address quote,address vault) external onlyLauncher {
        if(routerForToken[token]!=address(0)||creatorForRouter[router]==address(0)) revert InvalidRouter();
        FeeRouterV5(payable(router)).bind(token,quote,vault);
        routerForToken[token]=router;
        emit RouterBound(token,router,vault);
    }
}
