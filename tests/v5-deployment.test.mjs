import assert from "node:assert/strict";
import test from "node:test";
import {decodeFunctionData} from "viem";
import {DEPLOY_BYTECODE} from "../src/lib/deploy-artifacts.ts";
import {V5_STEPS, assertV5Transaction, buildV5Transaction, parseV5Progress, v5StepReady} from "../src/lib/v5-deployment.ts";

const a = Array.from({length: 12}, (_, i) => "0x" + (i + 1).toString(16).padStart(40, "0"));
const config = {owner:a[0], operator:a[1], treasury:a[2], registry:a[3], ponsFactory:a[4], escrow:a[5], oracleRegistry:a[6], oracleGuard:a[7], quoter:a[8], adapter:a[9]};
const progress = Object.fromEntries(V5_STEPS.slice(0,6).map(({id}, i) => [id, {hash:"0x" + "11".repeat(32), address:a[i+6]}]));

test("V5 launcher constructor uses direct fee factory and eight addresses in contract order", () => {
  const tx=buildV5Transaction("launcher",progress,config,DEPLOY_BYTECODE);
  const words=tx.data.slice(-8*64).match(/.{64}/g);
  assert.deepEqual(words,[config.owner,config.operator,config.registry,config.ponsFactory,progress.rewardFactory.address,progress.vaultFactory.address,progress.routerFactory.address,progress.executor.address].map(address=>address.slice(2).padStart(64,"0")));
  assert.equal(tx.to,undefined);
});
test("V5 fee factory encodes operator, Pons escrow and treasury correctly", () => {
  const tx=buildV5Transaction("routerFactory",progress,config,DEPLOY_BYTECODE);
  assert.deepEqual(tx.data.slice(-4*64).match(/.{64}/g),[config.owner,config.operator,config.escrow,config.treasury].map(address=>address.slice(2).padStart(64,"0")));
});
test("each binding targets the intended contract instead of creating another contract", () => {
  const expected={bindReward:"rewardFactory",bindVault:"vaultFactory",bindRouter:"routerFactory",bindExecutor:"executor"};
  for(const [id,target] of Object.entries(expected)) assert.equal(buildV5Transaction(id,progress,config,DEPLOY_BYTECODE).to,progress[target].address);
  assert.throws(()=>buildV5Transaction("bindRouter",{},config,DEPLOY_BYTECODE),/Verify routerFactory/);
});
test("executor configuration uses existing audited dependencies and 200 bps", () => {
  const tx=buildV5Transaction("configure",progress,config,DEPLOY_BYTECODE);
  const abi=[{type:"function",name:"configureDependencies",inputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint16"}]}];
  const decoded=decodeFunctionData({abi,data:tx.data});
  assert.deepEqual(decoded.args.slice(0,4).map(x=>x.toLowerCase()),[config.oracleRegistry,config.oracleGuard,config.quoter,config.adapter]);
  assert.equal(decoded.args[4],200);
});
test("receipt validation rejects foreign sender, wrong target, or different bytecode", () => {
  const expected=buildV5Transaction("controller",{},config,DEPLOY_BYTECODE);
  const actual={from:expected.from,to:null,input:expected.data};
  assert.doesNotThrow(()=>assertV5Transaction(expected,actual));
  for(const change of [{from:a[2]},{to:a[2]},{input:"0x1234"}]) assert.throws(()=>assertV5Transaction(expected,{...actual,...change}),/does not match/);
});
test("stored addresses do not unlock later steps without receipt verification", () => {
  assert.equal(v5StepReady("rewardFactory",{}),false);
  assert.equal(v5StepReady("rewardFactory",{controller:true}),true);
  assert.equal(v5StepReady("configure",{bindExecutor:true}),false);
});
test("legacy and structured backups restore hashes but malformed entries fail", () => {
  assert.deepEqual(parseV5Progress(progress),progress);
  assert.deepEqual(parseV5Progress({version:1,steps:progress}),progress);
  assert.throws(()=>parseV5Progress({controller:{hash:"broken"}}),/Invalid transaction hash/);
  assert.throws(()=>parseV5Progress({controller:{hash:"0x"+"11".repeat(32),address:"0x"+"0".repeat(40)}}),/Invalid contract address/);
  assert.throws(()=>parseV5Progress({steps:[]}),/Invalid deployment steps/);
});
