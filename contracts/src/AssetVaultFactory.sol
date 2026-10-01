// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./AssetVault.sol";
contract AssetVaultFactory {
 address public immutable launcher;
 mapping(address=>address) public vaultForToken;
 event VaultCreated(address indexed token,address indexed targetAsset,address indexed vault,address router,address executor);
 modifier onlyLauncher(){require(msg.sender==launcher,"NOT_LAUNCHER");_;}
 constructor(address launcher_){require(launcher_!=address(0),"ZERO_LAUNCHER");launcher=launcher_;}
 function create(address token,address targetAsset,address router,address executor) external onlyLauncher returns(address vault){require(token!=address(0)&&targetAsset!=address(0)&&router!=address(0)&&executor!=address(0),"ZERO_ADDRESS");require(vaultForToken[token]==address(0),"EXISTS");vault=address(new AssetVault(targetAsset,router,executor));vaultForToken[token]=vault;emit VaultCreated(token,targetAsset,vault,router,executor);}
}
