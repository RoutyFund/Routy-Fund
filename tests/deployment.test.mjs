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
