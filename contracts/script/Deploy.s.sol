// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";import "../src/OracleRegistry.sol";import "../src/FeeRouterFactory.sol";import "../src/AssetVaultFactory.sol";import "../src/ProtocolLauncher.sol";import "../src/OracleGuard.sol";import "../src/SwapExecutor.sol";
interface Vm{function envAddress(string calldata)external returns(address);function envUint(string calldata)external returns(uint256);function startBroadcast(uint256)external;function stopBroadcast()external;function addr(uint256)external returns(address);}
contract Deploy{
 Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
 address constant PONS_FACTORY=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e; address constant PONS_ESCROW=0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
 address constant UNISWAP_POOL_MANAGER=0x8366a39CC670B4001A1121B8F6A443A643e40951; address constant UNISWAP_ROUTER=0x204FAca1764B154221e35c0d20aBb3c525710498; address constant UNISWAP_PERMIT2=0x000000000022D473030F116dDEE9F6B43aC78BA3;
 event RoutyDeployment(address registry,address oracleRegistry,address feeRouterFactory,address vaultFactory,address launcher,address oracleGuard,address swapExecutor);
 function run()external{require(block.chainid==4663,"WRONG_CHAIN");uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");uint256 deviation=vm.envUint("MAX_PRICE_DEVIATION_BPS");require(deviation>0&&deviation<=2000,"INVALID_DEVIATION");address treasury=vm.envAddress("ROUTY_TREASURY_ADDRESS");require(treasury!=address(0),"ZERO_TREASURY");address deployer=vm.addr(key);vm.startBroadcast(key);
  AssetRegistry registry=new AssetRegistry(deployer);OracleRegistry oracleRegistry=new OracleRegistry(deployer);SwapExecutor swap=new SwapExecutor(deployer);OracleGuard guard=new OracleGuard(1 hours);
  FeeRouterFactory frf=new FeeRouterFactory(deployer);AssetVaultFactory avf=new AssetVaultFactory(deployer);
  ProtocolLauncher launcher=new ProtocolLauncher(address(registry),PONS_FACTORY,address(avf),address(frf),PONS_ESCROW,treasury,address(swap));
    frf.setLauncher(address(launcher));avf.setLauncher(address(launcher));swap.setLauncher(address(launcher));_configureSwap(swap,oracleRegistry,guard,deviation);
  emit RoutyDeployment(address(registry),address(oracleRegistry),address(frf),address(avf),address(launcher),address(guard),address(swap));vm.stopBroadcast();
 }
 function _configureSwap(SwapExecutor swap,OracleRegistry oracleRegistry,OracleGuard guard,uint256 deviation)private{swap.configureDependencies(UNISWAP_ROUTER,UNISWAP_PERMIT2,UNISWAP_POOL_MANAGER,address(oracleRegistry),address(guard),uint16(deviation));}
}