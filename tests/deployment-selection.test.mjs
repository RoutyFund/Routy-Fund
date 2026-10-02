import assert from "node:assert/strict";
import test from "node:test";
import {selectDeployment, V5_DEPLOYMENT_ENV} from "../src/lib/deployment-selection.ts";
import {ROUTY_DEPLOYMENT} from "../src/lib/deployment.ts";
const address = "0x0000000000000000000000000000000000000001";
test("existing V4 remains selected when V5 is absent", () => {
  const d = selectDeployment({}, ROUTY_DEPLOYMENT);
  assert.equal(d.version, "V4"); assert.equal(d.configured, true);
  assert.equal(d.launcher, ROUTY_DEPLOYMENT.protocolLauncherV4);
});
test("every individual V5 variable blocks silent V4 fallback", () => {
  for (const name of V5_DEPLOYMENT_ENV) {
    const d = selectDeployment({[name]: address}, ROUTY_DEPLOYMENT);
    assert.equal(d.version, "V5", name); assert.equal(d.configured, false, name);
    assert.equal(d.missing.length, 3, name);
    assert.notEqual(d.launcher, ROUTY_DEPLOYMENT.protocolLauncherV4, name);
  }
});
test("complete V5 selects only V5 addresses and trims whitespace", () => {
  const d = selectDeployment(Object.fromEntries(V5_DEPLOYMENT_ENV.map(name => [name, ` ${address} `])), ROUTY_DEPLOYMENT);
  assert.equal(d.version, "V5"); assert.equal(d.configured, true); assert.deepEqual(d.missing, []);
  for (const key of ["launcher", "executor", "controller", "routerFactory"]) assert.equal(d[key], address);
});
test("invalid and zero V5 addresses fail closed", () => {
  const env = Object.fromEntries(V5_DEPLOYMENT_ENV.map(name => [name, address]));
  for (const invalid of ["0x" + "0".repeat(40), "not-an-address", "0x1234"]) {
    const d = selectDeployment({...env, ROUTY_SWAP_EXECUTOR_V5_ADDRESS: invalid}, ROUTY_DEPLOYMENT);
    assert.equal(d.configured, false); assert.equal(d.executor, "");
    assert.deepEqual(d.missing, ["ROUTY_SWAP_EXECUTOR_V5_ADDRESS"]);
  }
});
test("invalid explicit V4 override does not select a different contract", () => {
  const d = selectDeployment({ROUTY_LAUNCHER_V4_ADDRESS: "broken"}, ROUTY_DEPLOYMENT);
  assert.equal(d.configured, false); assert.equal(d.launcher, "");
});
