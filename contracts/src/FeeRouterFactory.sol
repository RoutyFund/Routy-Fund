// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./FeeRouter.sol";
contract FeeRouterFactory {
 address public immutable admin; address public launcher; mapping(address=>address) public routerForToken;
 event LauncherSet(address indexed launcher); event RouterCreated(address indexed token,address indexed router,address quoteToken,address vault);
 modifier onlyAdmin(){require(msg.sender==admin,"NOT_ADMIN");_;} modifier onlyLauncher(){require(msg.sender==launcher&&launcher!=address(0),"NOT_LAUNCHER");_;}
 constructor(address admin_){require(admin_!=address(0),"ZERO_ADMIN");admin=admin_;}
 function setLauncher(address launcher_) external onlyAdmin {require(launcher==address(0)&&launcher_!=address(0),"LAUNCHER_ALREADY_SET");launcher=launcher_;emit LauncherSet(launcher_);}
 function create(address token,address escrow,address quoteToken,address vault,address treasury) external onlyLauncher returns(address router){require(token!=address(0)&&routerForToken[token]==address(0),"INVALID_TOKEN");router=address(new FeeRouter(token,escrow,quoteToken,vault,treasury));routerForToken[token]=router;emit RouterCreated(token,router,quoteToken,vault);}
}
