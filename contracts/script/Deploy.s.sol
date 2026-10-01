// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";
import "../src/FeeRouterFactory.sol";
import "../src/AssetVaultFactory.sol";
import "../src/ProtocolLauncher.sol";
import "../src/RewardDistributor.sol";
import "../src/RaffleDistributor.sol";
import "../src/OracleGuard.sol";
import "../src/SwapExecutor.sol";

interface Vm {function envAddress(string calldata) external returns(address);function envUint(string calldata) external returns(uint256);function startBroadcast(uint256) external;function stopBroadcast() external;}

contract Deploy {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function run() external {
        uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury=vm.envAddress("ROUTY_TREASURY_ADDRESS");
        require(treasury!=address(0),"ZERO_TREASURY");
        vm.startBroadcast(key);
        AssetRegistry registry=new AssetRegistry(treasury);
        new FeeRouterFactory();
        new AssetVaultFactory();
        new ProtocolLauncher(address(registry));
        new OracleGuard(1 hours);
        new SwapExecutor(treasury);
        vm.stopBroadcast();
    }
}
