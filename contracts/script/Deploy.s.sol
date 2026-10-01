// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/AssetRegistry.sol";
import "../src/OracleRegistry.sol";
import "../src/FeeRouterFactory.sol";
import "../src/AssetVaultFactory.sol";
import "../src/ProtocolLauncher.sol";
import "../src/OracleGuard.sol";
import "../src/SwapExecutor.sol";
import "../src/SwapOracleQuoter.sol";
import "../src/SwapRouterAdapter.sol";

interface Vm {
    function envAddress(string calldata) external returns (address);
    function envUint(string calldata) external returns (uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
    function addr(uint256) external returns (address);
}

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address constant PONS_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;

    AssetRegistry private registry;
    OracleRegistry private oracleRegistry;
    FeeRouterFactory private feeRouterFactory;
    AssetVaultFactory private vaultFactory;
    ProtocolLauncher private launcher;
    OracleGuard private oracleGuard;
    SwapExecutor private swapExecutor;
    SwapOracleQuoter private oracleQuoter;
    SwapRouterAdapter private routerAdapter;

    event RoutyDeployment(
        address registry,
        address oracleRegistry,
        address feeRouterFactory,
        address vaultFactory,
        address launcher,
        address oracleGuard,
        address swapExecutor
    );

    function run() external {
        require(block.chainid == 4663, "WRONG_CHAIN");

        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 deviation = vm.envUint("MAX_PRICE_DEVIATION_BPS");
        require(deviation > 0 && deviation <= 2000, "INVALID_DEVIATION");

        address treasury = vm.envAddress("ROUTY_TREASURY_ADDRESS");
        require(treasury != address(0), "ZERO_TREASURY");

        address deployer = vm.addr(key);
        vm.startBroadcast(key);

        _deployCore(deployer);
        _deployFactories(deployer);
        _deployLauncher(treasury);
        _configure(deviation);

        emit RoutyDeployment(
            address(registry),
            address(oracleRegistry),
            address(feeRouterFactory),
            address(vaultFactory),
            address(launcher),
            address(oracleGuard),
            address(swapExecutor)
        );

        vm.stopBroadcast();
    }

    function _deployCore(address deployer) private {
        registry = new AssetRegistry(deployer);
        oracleRegistry = new OracleRegistry(deployer);
        swapExecutor = new SwapExecutor(deployer);
        oracleGuard = new OracleGuard(1 hours);
        oracleQuoter = new SwapOracleQuoter();
        routerAdapter = new SwapRouterAdapter();
    }

    function _deployFactories(address deployer) private {
        feeRouterFactory = new FeeRouterFactory(deployer);
        vaultFactory = new AssetVaultFactory(deployer);
    }

    function _deployLauncher(address treasury) private {
        launcher = new ProtocolLauncher(
            address(registry),
            PONS_FACTORY,
            address(vaultFactory),
            address(feeRouterFactory),
            PONS_ESCROW,
            treasury,
            address(swapExecutor)
        );
    }

    function _configure(uint256 deviation) private {
        feeRouterFactory.setLauncher(address(launcher));
        vaultFactory.setLauncher(address(launcher));
        swapExecutor.setLauncher(address(launcher));
        swapExecutor.configureDependencies(
            address(oracleRegistry),
            address(oracleGuard),
            address(oracleQuoter),
            address(routerAdapter),
            uint16(deviation)
        );
    }
}
