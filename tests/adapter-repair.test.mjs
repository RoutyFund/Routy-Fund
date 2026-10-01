import assert from "node:assert/strict";
import test from "node:test";
import {
  addressFromStorageWord,
  decodeAdapterSafetyWord,
  sameAddress,
} from "../src/lib/adapter-repair.ts";
import { encodeDeployment } from "../src/lib/deploy-encoding.ts";
import { DEPLOY_BYTECODE } from "../src/lib/deploy-artifacts.ts";

const adapter = "0x1234567890abcdef1234567890abcdef12345678";

test("repair deploys the exact CI-published adapter creation bytecode", () => {
  assert.equal(
    encodeDeployment("SwapRouterAdapter", DEPLOY_BYTECODE.SwapRouterAdapter, []),
    DEPLOY_BYTECODE.SwapRouterAdapter,
  );
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
