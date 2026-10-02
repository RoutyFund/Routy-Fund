// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/AssetVaultV2Factory.sol";
import "../src/FeeRouterFactoryV5.sol";
import "../src/RewardDistributorFactory.sol";
import "../src/RewardAutomationController.sol";
import "../src/ProtocolLauncherV5.sol";
import "../src/SwapExecutor.sol";
import "../src/SwapOracleQuoter.sol";
import "../src/SwapRouterAdapter.sol";

interface VmV5 {
    function envAddress(string calldata) external returns(address);
    function envUint(string calldata) external returns(uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
    function addr(uint256) external returns(address);
}

/// @notice Deploys the Routy V5 stack (Pons creator fees go directly to a pre-deployed FeeRouter).
/// Deploy order mirrors DeployRoutyV4. Every factory/executor is bound to exactly one launcher,
/// so V5 needs fresh instances; only registry/oracle/treasury/Pons addresses are reused.
///
/// Required env: DEPLOYER_PRIVATE_KEY, ROUTY_AUTOMATION_OPERATOR, ROUTY_ASSET_REGISTRY_ADDRESS,
/// ROUTY_ORACLE_REGISTRY_ADDRESS, ROUTY_ORACLE_GUARD_ADDRESS, ROUTY_TREASURY_ADDRESS, MAX_PRICE_DEVIATION_BPS.
contract DeployRoutyV5 {
    VmV5 constant vm=VmV5(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PONS_FACTORY=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant PONS_ESCROW=0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;

    // Copy these into Vercel:
    //   launcher   -> ROUTY_LAUNCHER_V5_ADDRESS
    //   executor   -> ROUTY_SWAP_EXECUTOR_V5_ADDRESS
    //   controller -> ROUTY_REWARD_CONTROLLER_V5_ADDRESS
    //   routerFactory -> ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS
    event RoutyV5Deployment(address launcher,address executor,address controller,address routerFactory,address rewardFactory,address vaultFactory,address operator);

    function run() external {
        require(block.chainid==4663,"WRONG_CHAIN");
        uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer=vm.addr(key);
        address operator=vm.envAddress("ROUTY_AUTOMATION_OPERATOR");
        address registry=vm.envAddress("ROUTY_ASSET_REGISTRY_ADDRESS");
        address oracleRegistry=vm.envAddress("ROUTY_ORACLE_REGISTRY_ADDRESS");
        address oracleGuard=vm.envAddress("ROUTY_ORACLE_GUARD_ADDRESS");
        address treasury=vm.envAddress("ROUTY_TREASURY_ADDRESS");
        uint256 deviation=vm.envUint("MAX_PRICE_DEVIATION_BPS");
        require(operator!=address(0)&&registry!=address(0)&&oracleRegistry!=address(0)&&oracleGuard!=address(0)&&treasury!=address(0),"ZERO_ADDRESS");
        require(deviation>0&&deviation<=2000,"INVALID_DEVIATION");

        vm.startBroadcast(key);

        // The automation operator is both controller owner and keeper, and operates the router factory
        // (prepare) and executor (pool keys, swaps). Launcher ownership stays with the deployer.
        RewardAutomationController controller=new RewardAutomationController(operator,operator);
        RewardDistributorFactory rewardFactory=new RewardDistributorFactory(deployer,address(controller));
        AssetVaultV2Factory vaultFactory=new AssetVaultV2Factory(deployer);
        FeeRouterFactoryV5 routerFactory=new FeeRouterFactoryV5(deployer,operator,PONS_ESCROW,treasury);
        SwapExecutor executor=new SwapExecutor(deployer);
        SwapOracleQuoter quoter=new SwapOracleQuoter();
        SwapRouterAdapter adapter=new SwapRouterAdapter();

        executor.configureDependencies(oracleRegistry,oracleGuard,address(quoter),address(adapter),uint16(deviation));

        ProtocolLauncherV5 launcher=new ProtocolLauncherV5(
            deployer,operator,registry,PONS_FACTORY,address(rewardFactory),address(vaultFactory),address(routerFactory),address(executor)
        );

        rewardFactory.setLauncher(address(launcher));
        vaultFactory.setLauncher(address(launcher));
        routerFactory.setLauncher(address(launcher));
        executor.setLauncher(address(launcher));
        executor.transferOwnership(operator);

        emit RoutyV5Deployment(address(launcher),address(executor),address(controller),address(routerFactory),address(rewardFactory),address(vaultFactory),operator);
        vm.stopBroadcast();
    }
}
