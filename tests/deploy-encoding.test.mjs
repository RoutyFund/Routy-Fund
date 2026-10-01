import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeterministicDeployment,
  buildRepairTransaction,
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

test("deterministic deployment prepends a 32-byte salt and predicts the CREATE2 address", () => {
  const deployment = buildDeterministicDeployment(
    "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    `0x${"11".repeat(32)}`,
    "0x6000",
  );
  assert.equal(deployment.data, `0x${"11".repeat(32)}6000`);
  assert.equal(deployment.address, "0xAF84FaC5271f2B4ed9A50e34C8574d1f7c951aBe");
});

test("repair transactions always use a complete recipient and omit zero value", () => {
  assert.deepEqual(
    buildRepairTransaction(addresses[0], "0x6000", addresses[1], "0x1e8480"),
    {
      from: addresses[0],
      to: addresses[1],
      gas: "0x1e8480",
      data: "0x6000",
    },
  );
});

test("repair transactions reject odd-length hexadecimal data", () => {
  assert.throws(
    () => buildRepairTransaction(addresses[0], "0x123", addresses[1], "0x124f80"),
    /even-length hexadecimal bytes/,
  );
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
