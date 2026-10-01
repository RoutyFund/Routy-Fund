import assert from "node:assert/strict";
import test from "node:test";
import { keccak256 } from "viem";
import {
  addressFromStorageWord,
  decodeAdapterSafetyWord,
  sameAddress,
} from "../src/lib/adapter-repair.ts";
import { buildDeterministicDeployment, encodeDeployment } from "../src/lib/deploy-encoding.ts";
import { DEPLOY_BYTECODE } from "../src/lib/deploy-artifacts.ts";

const adapter = "0x1234567890abcdef1234567890abcdef12345678";

test("repair deploys the exact CI-published adapter creation bytecode", () => {
  assert.equal(
    encodeDeployment("SwapRouterAdapter", DEPLOY_BYTECODE.SwapRouterAdapter, []),
    DEPLOY_BYTECODE.SwapRouterAdapter,
  );
});

test("repair uses the live canonical CREATE2 deployer and locked adapter address", () => {
  const deployer = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
  const artifactHash = keccak256(DEPLOY_BYTECODE.SwapRouterAdapter);
  const deployment = buildDeterministicDeployment(deployer, artifactHash, DEPLOY_BYTECODE.SwapRouterAdapter);
  assert.equal(artifactHash, "0x77c0cd645d369050866e7c43c735c34715f5daaf78a46be52744234eab92b0de");
  assert.equal(deployment.address, "0x43327B698FEf2e097B03529101eaeC39994219CD");
  assert.equal(deployment.data, `${artifactHash}${DEPLOY_BYTECODE.SwapRouterAdapter.slice(2)}`);
});

test("executor address slots decode the low 20 bytes", () => {
  const word = `0x${"0".repeat(24)}${adapter.slice(2)}`;
  assert.equal(addressFromStorageWord(word), adapter);
});

test("packed adapter, deviation, and pause state decode from slot 5", () => {
  const word = `0x${"0".repeat(18)}01${"00c8"}${adapter.slice(2)}`;
  assert.deepEqual(decodeAdapterSafetyWord(word), {
    adapter,
    maxDeviationBps: 200,
    paused: true,
  });
});

test("address comparison is case-insensitive", () => {
  assert.equal(sameAddress(adapter, adapter.toUpperCase()), true);
});

test("malformed and zero storage words fail closed", () => {
  assert.throws(() => addressFromStorageWord("0x1234"), /invalid 32-byte storage word/);
  assert.throws(() => addressFromStorageWord(`0x${"0".repeat(64)}`), /address is zero/);
});
