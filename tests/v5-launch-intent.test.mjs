import assert from "node:assert/strict";
import test from "node:test";
import {encodeAbiParameters,keccak256,toBytes} from "viem";
import {matchesV5LaunchIntent,v5LaunchIntentSalt} from "../src/lib/v5-launch-intent.ts";

const creator="0x866d5D863381efe9e10cCb2E44f388611F781212";
const targetAsset="0x1111111111111111111111111111111111111111";
const other="0x2222222222222222222222222222222222222222";
const intent={creator,targetAsset,policy:0,nonce:"0x"+"ab".repeat(32)};

test("launch intent commits to the Routy V5 domain, chain, creator, asset, policy and full nonce",()=>{
 const encoded=encodeAbiParameters([{type:"bytes32"},{type:"uint256"},{type:"address"},{type:"address"},{type:"uint8"},{type:"bytes32"}],
  [keccak256(toBytes("ROUTY_V5_LAUNCH_INTENT_V1")),4663n,creator,targetAsset,0,intent.nonce]);
 const salt=v5LaunchIntentSalt(intent);
 assert.equal(salt,keccak256(encoded));
 assert.equal(matchesV5LaunchIntent(salt,intent),true);
 assert.equal(matchesV5LaunchIntent(salt.toUpperCase().replace("0X","0x"),{...intent,creator:creator.toLowerCase()}),true);
});
test("a launch commitment cannot authorize another creator, target, policy or nonce",()=>{
 const salt=v5LaunchIntentSalt(intent);
 for(const change of [{creator:other},{targetAsset:other},{policy:1},{policy:2},{nonce:"0x"+"cd".repeat(32)}]){
  assert.equal(matchesV5LaunchIntent(salt,{...intent,...change}),false);
  assert.notEqual(v5LaunchIntentSalt({...intent,...change}),salt);
 }
});
test("all supported reward policies retain a distinct valid commitment",()=>{
 const salts=[0,1,2].map(policy=>v5LaunchIntentSalt({...intent,policy}));
 assert.equal(new Set(salts).size,3);
 salts.forEach((salt,policy)=>assert.equal(matchesV5LaunchIntent(salt,{...intent,policy}),true));
});
test("legacy, malformed, and foreign-domain salts do not authorize V5 setup",()=>{
 assert.equal(matchesV5LaunchIntent(keccak256(toBytes(creator+":1790960000000")),intent),false);
 for(const salt of ["bad","0x","0x"+"00".repeat(32),"0x"+"ab".repeat(31)])assert.equal(matchesV5LaunchIntent(salt,intent),false);
 const foreign=keccak256(encodeAbiParameters([{type:"bytes32"},{type:"uint256"},{type:"address"},{type:"address"},{type:"uint8"},{type:"bytes32"}],
  [keccak256(toBytes("ANOTHER_PROTOCOL")),4663n,creator,targetAsset,0,intent.nonce]));
 assert.equal(matchesV5LaunchIntent(foreign,intent),false);
});
test("invalid addresses, policies, or nonces fail closed",()=>{
 for(const change of [{creator:"bad"},{creator:"0x"+"0".repeat(40)},{targetAsset:"0x"+"0".repeat(40)},{policy:-1},{policy:3},{policy:0.5},{nonce:"0x12"},{nonce:"0x"+"gg".repeat(32)}]){
  assert.throws(()=>v5LaunchIntentSalt({...intent,...change}),/INVALID_LAUNCH_INTENT/);
  assert.equal(matchesV5LaunchIntent(v5LaunchIntentSalt(intent),{...intent,...change}),false);
 }
});
