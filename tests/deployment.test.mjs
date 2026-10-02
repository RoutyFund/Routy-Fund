import assert from "node:assert/strict";
import test from "node:test";
import { isAddress } from "viem";
import { ROUTY_DEPLOYMENT, ROUTY_RELEASE_STATE } from "../src/lib/deployment.ts";

test("every recorded deployment address is a complete 20-byte EVM address", () => {
  for (const [name, value] of Object.entries(ROUTY_DEPLOYMENT)) {
    if (name === "chainId") continue;
    assert.match(value, /^0x[0-9a-f]{40}$/i, `${name} must contain exactly 40 hexadecimal digits`);
    assert.equal(isAddress(value, { strict: false }), true, `${name} must be a valid EVM address`);
  }
});

test("SwapExecutor matches the contract derived at deployer nonce 15", () => {
  assert.equal(
    ROUTY_DEPLOYMENT.swapExecutor,
    "0xc91a4e8d64Dfa97b6263d958d9EF1F35Cc37675D",
  );
});

test("canonical SwapRouterAdapter matches the verified repair", () => {
  assert.equal(
    ROUTY_DEPLOYMENT.swapRouterAdapter,
    "0x43327B698FEf2e097B03529101eaeC39994219CD",
  );
  assert.equal(ROUTY_RELEASE_STATE.swapAdapterRepairRequired, false);
});


test("verified V4 production deployment is fully recorded", () => {
  assert.equal(ROUTY_DEPLOYMENT.protocolLauncherV4.toLowerCase(), "0xdf1180c0a0e32dcc850bdf384acd7c6ba1292a5b");
  assert.equal(ROUTY_DEPLOYMENT.swapExecutorV4.toLowerCase(), "0x9ef31960d25c9ed2f8e39544d765077fddbb2c00");
  assert.equal(ROUTY_DEPLOYMENT.rewardAutomationControllerV4.toLowerCase(), "0x74235cfecb26a4a48e15ccbab47f78efba17d48e");
  assert.equal(ROUTY_DEPLOYMENT.rewardDistributorFactoryV4.toLowerCase(), "0xa656b6a735e0fa9e778b4cd6b8a4c683388a6fe2");
  assert.equal(ROUTY_DEPLOYMENT.assetVaultFactoryV4.toLowerCase(), "0x92dda3a4ae5804b595d4134fbc2ebb2ee2bf9617");
  assert.equal(ROUTY_DEPLOYMENT.feeRouterFactoryV4.toLowerCase(), "0x8d80e628e2d0f24296cba8aa55bef8c235bf4676");
  assert.equal(ROUTY_DEPLOYMENT.automationOperatorV4.toLowerCase(), "0x866d5d863381efe9e10ccb2e44f388611f781212");
});
