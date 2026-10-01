import assert from "node:assert/strict";
import test from "node:test";
import {
  walletErrorCode,
  walletErrorMessage,
  walletRequestWasRejected,
} from "../src/lib/ethereum-provider.ts";

test("plain EIP-1193 errors preserve the wallet message and code", () => {
  const cause = { code: 4001, message: "User rejected the request." };
  assert.equal(walletErrorCode(cause), 4001);
  assert.equal(walletErrorMessage(cause, "fallback"), "User rejected the request. (wallet code 4001)");
  assert.equal(walletRequestWasRejected(cause), true);
});

test("nested Bitget/RPC errors expose the useful inner message", () => {
  const cause = { code: -32603, data: { message: "execution reverted: NotOwner" } };
  assert.equal(walletErrorMessage(cause, "fallback"), "execution reverted: NotOwner (wallet code -32603)");
  assert.equal(walletRequestWasRejected(cause), false);
});

test("Error instances and unknown values have stable fallbacks", () => {
  assert.equal(walletErrorMessage(new Error("network unavailable"), "fallback"), "network unavailable");
  assert.equal(walletErrorMessage(null, "fallback"), "fallback");
  assert.equal(walletRequestWasRejected({ message: "Request denied by user" }), true);
});
