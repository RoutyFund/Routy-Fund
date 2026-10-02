// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./AssetVaultV2.sol";

contract AssetVaultV2Factory {
    address public immutable admin;
    address public launcher;
    mapping(address=>address) public vaultForToken;

    event LauncherSet(address indexed launcher);
    event VaultCreated(address indexed token,address indexed targetAsset,address indexed vault,address executor,address distributor);

    modifier onlyAdmin(){require(msg.sender==admin,"NOT_ADMIN");_;}
    modifier onlyLauncher(){require(msg.sender==launcher&&launcher!=address(0),"NOT_LAUNCHER");_;}

    constructor(address admin_){require(admin_!=address(0),"ZERO_ADMIN");admin=admin_;}

    function setLauncher(address launcher_) external onlyAdmin {
        require(launcher==address(0)&&launcher_!=address(0),"LAUNCHER_ALREADY_SET");
        launcher=launcher_;emit LauncherSet(launcher_);
    }

    function create(address token,address targetAsset,address executor,address distributor) external onlyLauncher returns(address vault){
        require(token!=address(0)&&targetAsset!=address(0)&&executor!=address(0)&&distributor!=address(0),"ZERO_ADDRESS");
        require(vaultForToken[token]==address(0),"EXISTS");
        vault=address(new AssetVaultV2(targetAsset,launcher,executor,distributor));
        vaultForToken[token]=vault;
        emit VaultCreated(token,targetAsset,vault,executor,distributor);
    }
}
