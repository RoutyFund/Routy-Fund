import assert from "node:assert/strict";
import test from "node:test";
import {decodeFunctionData} from "viem";
import {DEPLOY_BYTECODE} from "../src/lib/deploy-artifacts.ts";
import {V5_LEGACY_BYTECODE} from "../src/lib/v5-legacy-artifacts.ts";
import {V5_STEPS, assertV5Transaction, buildV5Transaction, parseV5Progress, readV5Receipt, receiptFailure, v5GasLimit, v5StepReady} from "../src/lib/v5-deployment.ts";

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

const hash = "0x" + "22".repeat(32);
function receiptProvider(receipt, overrides = {}) {
  const tx = buildV5Transaction("routerFactory", progress, config, DEPLOY_BYTECODE);
  const calls = [];
  return {calls, request: async ({method}) => {
    calls.push(method);
    if (method === "eth_getTransactionReceipt") return receipt;
    if (method === "eth_getTransactionByHash") return {from: tx.from, to: null, input: tx.data, gas: "0x124f80", ...overrides};
    if (method === "eth_getCode") return "0x6000";
    throw new Error("Unexpected RPC method " + method);
  }};
}
test("failed factory receipts expose exhausted gas and wallet-reduced limits without verifying", async () => {
  const provider = receiptProvider({status: "0x0", gasUsed: "0x124f80", contractAddress: a[7]});
  const next = {...progress, routerFactory: {hash, requestedGas: "0x2dc6c0"}};
  const check = await readV5Receipt(provider, "routerFactory", next, config, DEPLOY_BYTECODE);
  assert.equal(check.status, "reverted");
  assert.equal(check.gasLimit, "1200000");
  assert.equal(check.exhaustedGas, true);
  assert.equal(check.walletReducedGas, true);
  assert.equal(check.address, undefined);
  assert.match(receiptFailure(check), /100%/);
  assert.match(receiptFailure(check), /wallet sent a lower gas limit/);
  assert.equal(provider.calls.includes("eth_getCode"), false);
});
test("pending receipts stay pending and do not read or verify a contract", async () => {
  const provider = receiptProvider(null);
  const check = await readV5Receipt(provider, "routerFactory", progress, config, DEPLOY_BYTECODE);
  assert.equal(check.status, "pending");
  assert.deepEqual(provider.calls, ["eth_getTransactionReceipt"]);
});
test("a receipt verifies only matching deployment data with confirmed success", async () => {
  const receipt = {status: "0x01", gasUsed: "0x100000", contractAddress: a[7]};
  assert.equal((await readV5Receipt(receiptProvider(receipt), "routerFactory", progress, config, DEPLOY_BYTECODE)).address, a[7]);
  await assert.rejects(readV5Receipt(receiptProvider(receipt, {from: a[3]}), "routerFactory", progress, config, DEPLOY_BYTECODE), /does not match/);
  await assert.rejects(readV5Receipt(receiptProvider({...receipt, status: undefined}), "routerFactory", progress, config, DEPLOY_BYTECODE), /no confirmed success/);
});
test("deployment gas respects Bitget's cap and rejects transactions that need more", () => {
  assert.equal(BigInt(v5GasLimit("0x124f80", true)), 1_200_000n);
  assert.equal(BigInt(v5GasLimit("0xf4240", true)), 1_200_000n);
  assert.equal(BigInt(v5GasLimit("0x186a0", false)), 150_000n);
  assert.equal(BigInt(v5GasLimit("0x124f80", false)), 1_200_000n);
  assert.throws(() => v5GasLimit("0x124f81", true), /exceeds Bitget/);
  assert.throws(() => v5GasLimit("0x1e8480", false), /not submitted/);
  assert.throws(() => v5GasLimit("0x0", true), /Invalid gas estimate/);
  const next = {...progress, routerFactory: {hash, requestedGas: "0x2dc6c0"}};
  assert.deepEqual(parseV5Progress({version: 1, steps: next}), next);
  assert.throws(() => parseV5Progress({routerFactory: {hash, requestedGas: "bad"}}), /Invalid gas limit/);
});
test("old factory receipts remain recoverable after optimization, with exact identity checks", async () => {
  const previous = buildV5Transaction("routerFactory", progress, config, {...DEPLOY_BYTECODE, ...V5_LEGACY_BYTECODE});
  const receipt = {status: "0x0", gasUsed: "0x124f80"};
  const provider = receiptProvider(receipt, {input: previous.data});
  assert.equal((await readV5Receipt(provider, "routerFactory", progress, config, DEPLOY_BYTECODE, V5_LEGACY_BYTECODE)).status, "reverted");
  await assert.rejects(readV5Receipt(provider, "routerFactory", progress, config, DEPLOY_BYTECODE), /does not match/);
  await assert.rejects(readV5Receipt(receiptProvider(receipt, {input: previous.data.slice(0,-1)+"0"}), "routerFactory", progress, config, DEPLOY_BYTECODE, V5_LEGACY_BYTECODE), /does not match/);
  await assert.rejects(readV5Receipt(receiptProvider(receipt, {input: previous.data, from: a[3]}), "routerFactory", progress, config, DEPLOY_BYTECODE, V5_LEGACY_BYTECODE), /does not match/);
});
