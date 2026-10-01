import assert from "node:assert/strict";
import test from "node:test";
import {
  canCheckStep,
  canSubmitStep,
  encodeDeployment,
  encodeExecutorConfigureDependencies,
} from "../src/lib/deploy-encoding.ts";
import { DEPLOY_BYTECODE } from "../src/lib/deploy-artifacts.ts";

const addresses = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
  "0x0000000000000000000000000000000000000005",
  "0x0000000000000000000000000000000000000006",
  "0x0000000000000000000000000000000000000007",
];

test("constructor arguments follow ProtocolLauncher constructor order", () => {
  const data = encodeDeployment("ProtocolLauncher", DEPLOY_BYTECODE.ProtocolLauncher, addresses);
  const words = data.slice(-7 * 64).match(/.{64}/g);
  assert.deepEqual(words, addresses.map((address) => address.slice(2).padStart(64, "0")));
});

test("OracleGuard constructor encodes maxAge 3600", () => {
  const data = encodeDeployment("OracleGuard", DEPLOY_BYTECODE.OracleGuard, [3600n]);
  assert.equal(data.slice(-64), (3600n).toString(16).padStart(64, "0"));
});

test("dependency configuration encodes the requested 200 bps", () => {
  const data = encodeExecutorConfigureDependencies([...addresses.slice(0, 4), 200]);
  assert.equal(data.slice(-64), "c8".padStart(64, "0"));
});

test("submission is blocked until every previous step is confirmed", () => {
  const statuses = ["confirmed", "failed", "pending"];
  assert.equal(canSubmitStep(statuses, 1), true);
  assert.equal(canSubmitStep(statuses, 2), false);
  assert.equal(canSubmitStep(["confirmed", "confirmed", "pending"], 2), true);
  assert.equal(canSubmitStep(statuses, 3), false);
});

test("receipt checks are also sequential after reload", () => {
  assert.equal(canCheckStep(["submitted", "submitted"], 0), true);
  assert.equal(canCheckStep(["submitted", "submitted"], 1), false);
  assert.equal(canCheckStep(["confirmed", "submitted"], 1), true);
});
