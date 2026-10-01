// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";import "../src/ProtocolLauncher.sol";
contract ProtocolLauncherTest{function testApprovedAssetRegisters()public{AssetRegistry r=new AssetRegistry(address(this));address a=address(0xA11CE);r.setApproved(a,true);ProtocolLauncher l=new ProtocolLauncher(address(r));address t=address(0xBEEF);l.register(t,a,ProtocolLauncher.Policy.PRO_RATA);(address creator,address asset,,)=l.routes(t);require(creator==address(this)&&asset==a,"BAD_ROUTE");}}