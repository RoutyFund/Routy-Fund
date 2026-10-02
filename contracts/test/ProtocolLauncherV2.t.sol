// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ProtocolLauncherV2.sol";
import "../src/RewardDistributorFactory.sol";
import "../src/AssetVaultV2Factory.sol";
import "../src/FeeRouterFactory.sol";

contract RegistryV2Mock {
    mapping(address=>bool) public approved;
    mapping(address=>bool) public halted;
    function set(address asset,bool ok) external { approved[asset]=ok; }
}

contract PonsV2Mock {
    mapping(address=>IPonsFactoryV2Launcher.Launch) internal launches;
    function set(address token,address creator,address pairToken) external {
        launches[token]=IPonsFactoryV2Launcher.Launch({
            token: token,
            curve: address(1),
            deployer: creator,
            creatorFeeRecipient: creator,
            pairToken: pairToken,
            graduationThreshold: 0,
            poolFee: 0,
            tickSpacing: 0,
            creatorTaxBps: 0,
            buybackEnabled: false,
            phase: 1,
            sweptQuote: 0,
            sweptTokens: 0,
            sweptAt: 0,
            exists: true
        });
    }
    function getLaunchedToken(address token) external view returns(IPonsFactoryV2Launcher.Launch memory) {
        return launches[token];
    }
}

contract ExecutorV2Mock {
    mapping(address=>bool) public approvedVault;
    function registerVault(address vault) external { approvedVault[vault]=true; }
}

contract ProtocolLauncherV2Test {
    function testProvisionCreatesRewardRouteAndRegistersVault() public {
        address routeToken=address(0xBEEF);
        address targetAsset=address(0xCAFE);

        RegistryV2Mock registry=new RegistryV2Mock();
        registry.set(targetAsset,true);

        PonsV2Mock pons=new PonsV2Mock();
        pons.set(routeToken,address(this),address(0));

        ExecutorV2Mock executor=new ExecutorV2Mock();
        RewardDistributorFactory rewardFactory=new RewardDistributorFactory(address(this),address(this));
        AssetVaultV2Factory vaultFactory=new AssetVaultV2Factory(address(this));
        FeeRouterFactory routerFactory=new FeeRouterFactory(address(this));

        ProtocolLauncherV2 launcher=new ProtocolLauncherV2(
            address(registry),
            address(pons),
            address(rewardFactory),
            address(vaultFactory),
            address(routerFactory),
            address(0x1234),
            address(0x5678),
            address(executor)
        );

        rewardFactory.setLauncher(address(launcher));
        vaultFactory.setLauncher(address(launcher));
        routerFactory.setLauncher(address(launcher));

        (address vault,address router,address distributor)=launcher.provision(
            routeToken,
            targetAsset,
            ProtocolLauncherV2.Policy.PRO_RATA
        );

        require(vault!=address(0)&&router!=address(0)&&distributor!=address(0),"ZERO_COMPONENT");
        require(executor.approvedVault(vault),"VAULT_NOT_REGISTERED");

        (address creator,address asset,address quote,address storedVault,address storedRouter,address storedDistributor,,)=launcher.routes(routeToken);
        require(creator==address(this),"BAD_CREATOR");
        require(asset==targetAsset,"BAD_ASSET");
        require(quote==address(0),"BAD_QUOTE");
        require(storedVault==vault&&storedRouter==router&&storedDistributor==distributor,"BAD_ROUTE");
    }
}
