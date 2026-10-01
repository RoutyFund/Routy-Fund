// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./AssetVault.sol";
contract AssetVaultFactory{
 mapping(address=>address)public vaultForAsset;
 event VaultCreated(address indexed asset,address indexed vault,address router,address executor);
 function create(address asset,address router,address executor)external returns(address vault){
  require(vaultForAsset[asset]==address(0),"VAULT_EXISTS");vault=address(new AssetVault(asset,router,executor));vaultForAsset[asset]=vault;emit VaultCreated(asset,vault,router,executor);
 }
}