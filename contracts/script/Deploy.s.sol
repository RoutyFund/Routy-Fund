// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";import "../src/OracleRegistry.sol";import "../src/FeeRouterFactory.sol";import "../src/AssetVaultFactory.sol";import "../src/ProtocolLauncher.sol";import "../src/OracleGuard.sol";import "../src/SwapExecutor.sol";
interface Vm{function envAddress(string calldata)external returns(address);function envUint(string calldata)external returns(uint256);function startBroadcast(uint256)external;function stopBroadcast()external;function addr(uint256)external returns(address);}
contract Deploy{
 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 address constant PONS_FACTORY=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e; address constant PONS_ESCROW=0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
 event RoutyDeployment(address registry,address oracleRegistry,address feeRouterFactory,address vaultFactory,address launcher,address oracleGuard,address swapExecutor);
 function run()external{uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");address treasury=vm.envAddress("ROUTY_TREASURY_ADDRESS");require(treasury!=address(0),"ZERO_TREASURY");address deployer=vm.addr(key);vm.startBroadcast(key);
  AssetRegistry registry=new AssetRegistry(deployer);OracleRegistry oracleRegistry=new OracleRegistry(deployer);SwapExecutor swap=new SwapExecutor(treasury);OracleGuard guard=new OracleGuard(1 hours);
  FeeRouterFactory frf=new FeeRouterFactory(deployer);AssetVaultFactory avf=new AssetVaultFactory(deployer);
  ProtocolLauncher launcher=new ProtocolLauncher(address(registry),PONS_FACTORY,address(avf),address(frf),PONS_ESCROW,treasury,address(swap));
  frf.setLauncher(address(launcher));avf.setLauncher(address(launcher));
  emit RoutyDeployment(address(registry),address(oracleRegistry),address(frf),address(avf),address(launcher),address(guard),address(swap));vm.stopBroadcast();
 }
}