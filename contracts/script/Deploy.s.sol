// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";import "../src/OracleRegistry.sol";import "../src/FeeRouterFactory.sol";import "../src/AssetVaultFactory.sol";import "../src/ProtocolLauncher.sol";import "../src/OracleGuard.sol";import "../src/SwapExecutor.sol";
interface Vm{function envAddress(string calldata)external returns(address);function envUint(string calldata)external returns(uint256);function startBroadcast(uint256)external;function stopBroadcast()external;}
contract Deploy{
 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 event RoutyDeployment(address registry,address oracleRegistry,address feeRouterFactory,address vaultFactory,address launcher,address oracleGuard,address swapExecutor);
 function run()external{uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");address treasury=vm.envAddress("ROUTY_TREASURY_ADDRESS");require(treasury!=address(0),"ZERO_TREASURY");vm.startBroadcast(key);AssetRegistry registry=new AssetRegistry(treasury);OracleRegistry oracleRegistry=new OracleRegistry(treasury);FeeRouterFactory frf=new FeeRouterFactory();AssetVaultFactory avf=new AssetVaultFactory();ProtocolLauncher launcher=new ProtocolLauncher(address(registry));OracleGuard guard=new OracleGuard(1 hours);SwapExecutor swap=new SwapExecutor(treasury);emit RoutyDeployment(address(registry),address(oracleRegistry),address(frf),address(avf),address(launcher),address(guard),address(swap));vm.stopBroadcast();}
}