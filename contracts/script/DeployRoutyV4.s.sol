// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/AssetVaultV2Factory.sol";
import "../src/FeeRouterFactory.sol";
import "../src/RewardDistributorFactory.sol";
import "../src/RewardAutomationController.sol";
import "../src/ProtocolLauncherV4.sol";
import "../src/SwapExecutor.sol";
import "../src/SwapOracleQuoter.sol";
import "../src/SwapRouterAdapter.sol";

interface VmV4 {
    function envAddress(string calldata) external returns(address);
    function envUint(string calldata) external returns(uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
    function addr(uint256) external returns(address);
}

contract DeployRoutyV4 {
    VmV4 constant vm=VmV4(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PONS_FACTORY=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant PONS_ESCROW=0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;

    event RoutyV4Deployment(address launcher,address executor,address rewardController,address rewardFactory,address vaultFactory,address routerFactory,address operator);

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

        // The automation operator owns only the narrowly scoped runtime controls:
        // pool-key configuration and reward activation. Protocol launcher ownership
        // remains with the deployer and can later be transferred to the Safe.
        RewardAutomationController controller=new RewardAutomationController(operator,operator);
        RewardDistributorFactory rewardFactory=new RewardDistributorFactory(deployer,address(controller));
        AssetVaultV2Factory vaultFactory=new AssetVaultV2Factory(deployer);
        FeeRouterFactory routerFactory=new FeeRouterFactory(deployer);
        SwapExecutor executor=new SwapExecutor(operator);
        SwapOracleQuoter quoter=new SwapOracleQuoter();
        SwapRouterAdapter adapter=new SwapRouterAdapter();

        executor.configureDependencies(oracleRegistry,oracleGuard,address(quoter),address(adapter),uint16(deviation));

        ProtocolLauncherV4 launcher=new ProtocolLauncherV4(
            deployer,operator,registry,PONS_FACTORY,address(rewardFactory),address(vaultFactory),address(routerFactory),PONS_ESCROW,treasury,address(executor)
        );

        rewardFactory.setLauncher(address(launcher));
        vaultFactory.setLauncher(address(launcher));
        routerFactory.setLauncher(address(launcher));

        // setLauncher is owner-only; operator owns executor by design, therefore
        // it must be set after deployment by the operator wallet. Keeping this
        // explicit prevents silently granting broader deployer authority.
        emit RoutyV4Deployment(address(launcher),address(executor),address(controller),address(rewardFactory),address(vaultFactory),address(routerFactory),operator);
        vm.stopBroadcast();
    }
}
