"use client";

import { useEffect, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, type Address, type Hex } from "viem";
import Nav from "@/components/Nav";
import { ROUTY_DEPLOYMENT } from "@/lib/deployment";
import { FIRST_PRODUCTION_ROUTE } from "@/lib/production-route";
import {
  getInjectedProvider,
  type EthereumProvider,
  type EthereumTransactionReceipt,
  walletErrorMessage,
} from "@/lib/ethereum-provider";

const OWNER = "0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const CHAIN_ID = "0x1237";
const EXPLORER = "https://robinhoodchain.blockscout.com";

const registryAbi = [
  { type: "function", name: "approved", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "setApproved", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "ok", type: "bool" }], outputs: [] },
] as const;

const oracleAbi = [
  { type: "function", name: "feedForAsset", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "address" }] },
  { type: "function", name: "setFeed", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "feed", type: "address" }], outputs: [] },
] as const;

type RouteCheck = {
  readyForOwnerConfiguration?: boolean;
  verification?: { poolKeyMatches?: boolean; expectedPoolId?: string; computedPoolId?: string };
};

type State = {
  assetApproved: boolean;
  targetFeed: Address;
  quoteFeed: Address;
};

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

async function ethCall(provider: EthereumProvider, to: Address, data: Hex) {
  return provider.request<Hex>({ method: "eth_call", params: [{ to, data }, "latest"] });
}

async function waitForReceipt(provider: EthereumProvider, hash: Hex) {
  for (let i = 0; i < 40; i += 1) {
    const receipt = await provider.request<EthereumTransactionReceipt | null>({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  return null;
}

export default function ProductionRouteSetupPage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [routeCheck, setRouteCheck] = useState<RouteCheck | null>(null);
  const [state, setState] = useState<State>({ assetApproved: false, targetFeed: ZERO, quoteFeed: ZERO });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const authorized = account.toLowerCase() === OWNER.toLowerCase();
  const correctChain = chainId.toLowerCase() === CHAIN_ID;
  const poolVerified = routeCheck?.readyForOwnerConfiguration === true && routeCheck?.verification?.poolKeyMatches === true;
  const targetFeedConfigured = state.targetFeed.toLowerCase() === FIRST_PRODUCTION_ROUTE.targetFeed.toLowerCase();
  const quoteFeedConfigured = state.quoteFeed.toLowerCase() === FIRST_PRODUCTION_ROUTE.quoteFeed.toLowerCase();
  const complete = poolVerified && state.assetApproved && targetFeedConfigured && quoteFeedConfigured;

  async function refreshWallet() {
    const provider = getInjectedProvider();
    if (!provider) return;
    const [accounts, chain] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] || "");
    setChainId(chain || "");
  }

  async function refreshState() {
    const provider = getInjectedProvider();
    if (!provider) return;
    const approvedData = encodeFunctionData({ abi: registryAbi, functionName: "approved", args: [FIRST_PRODUCTION_ROUTE.target] });
    const targetFeedData = encodeFunctionData({ abi: oracleAbi, functionName: "feedForAsset", args: [FIRST_PRODUCTION_ROUTE.target] });
    const quoteFeedData = encodeFunctionData({ abi: oracleAbi, functionName: "feedForAsset", args: [FIRST_PRODUCTION_ROUTE.quote] });
    const [approvedRaw, targetRaw, quoteRaw] = await Promise.all([
      ethCall(provider, ROUTY_DEPLOYMENT.assetRegistry, approvedData),
      ethCall(provider, ROUTY_DEPLOYMENT.oracleRegistry, targetFeedData),
      ethCall(provider, ROUTY_DEPLOYMENT.oracleRegistry, quoteFeedData),
    ]);
    setState({
      assetApproved: decodeFunctionResult({ abi: registryAbi, functionName: "approved", data: approvedRaw }),
      targetFeed: decodeFunctionResult({ abi: oracleAbi, functionName: "feedForAsset", data: targetRaw }) as Address,
      quoteFeed: decodeFunctionResult({ abi: oracleAbi, functionName: "feedForAsset", data: quoteRaw }) as Address,
    });
  }

  async function connect() {
    const provider = getInjectedProvider();
    if (!provider) return setError("Compatible injected EVM wallet not found.");
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await refreshWallet();
      setError("");
    } catch (cause) {
      setError(walletErrorMessage(cause, "Wallet connection failed."));
    }
  }

  async function switchChain() {
    const provider = getInjectedProvider();
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
      await refreshWallet();
      setError("");
    } catch (cause) {
      setError(walletErrorMessage(cause, "Could not switch to Robinhood Chain."));
    }
  }

  async function send(label: string, to: Address, data: Hex) {
    const provider = getInjectedProvider();
    if (!provider) return setError("Wallet provider not found.");
    if (!authorized || !correctChain || !poolVerified) return setError("Owner wallet, Robinhood Chain, and verified PoolKey are required.");
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const hash = await provider.request<Hex>({
        method: "eth_sendTransaction",
        params: [{ from: OWNER, to, data, value: "0x0" }],
      });
      setNotice(`${label} submitted: ${hash}. Waiting for confirmation…`);
      const receipt = await waitForReceipt(provider, hash);
      if (!receipt) {
        setNotice(`${label} is still pending. Do not resend; refresh status later.`);
        return;
      }
      if (receipt.status !== "0x1" && receipt.status !== "0x01") throw new Error(`${label} failed on-chain.`);
      await refreshState();
      setNotice(`${label} confirmed and verified on-chain.`);
    } catch (cause) {
      setError(walletErrorMessage(cause, `${label} failed.`));
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshWallet().catch(() => {});
      fetch("/api/route-readiness").then(async (r) => {
        const body = await r.json();
        setRouteCheck(body);
      }).catch(() => setRouteCheck(null));
      refreshState().catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="shell">
      <Nav />
      <div className="wrap">
        <span className="kicker">Routy production route</span>
        <h1 style={{ fontSize: 56 }}>Prepare AAPL / USDG safely.</h1>
        <p className="muted">This page performs only the owner configuration that can be completed before a creator launches a Pons token. SwapExecutor remains paused.</p>

        <div className="launch-form">
          <section className="form-card">
            <h2>Wallet</h2>
            <p>Required owner: <code>{OWNER}</code></p>
            <p>Connected: <b>{account || "Not connected"}</b></p>
            <p>Network: <b>{chainId ? Number.parseInt(chainId, 16) : "Not connected"}</b></p>
            {!account ? <button className="primary" onClick={connect}>Connect wallet</button>
              : !correctChain ? <button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button>
              : !authorized ? <div className="notice danger">Wrong wallet. Owner configuration is locked.</div>
              : <div className="notice">Owner wallet and Robinhood Chain verified.</div>}
          </section>

          <section className="form-card">
            <h2>Locked route</h2>
            <p>AAPL: <code>{FIRST_PRODUCTION_ROUTE.target}</code></p>
            <p>USDG: <code>{FIRST_PRODUCTION_ROUTE.quote}</code></p>
            <p>Pool ID: <code className="mono-wrap">{FIRST_PRODUCTION_ROUTE.poolId}</code></p>
            <p>Fee / tick spacing: <b>{FIRST_PRODUCTION_ROUTE.poolKey.fee} / {FIRST_PRODUCTION_ROUTE.poolKey.tickSpacing}</b></p>
            <p>Hooks: <code>{FIRST_PRODUCTION_ROUTE.poolKey.hooks}</code></p>
            <div className={poolVerified ? "notice" : "notice danger"}>
              PoolKey verification: <b>{poolVerified ? "MATCHED" : "NOT VERIFIED"}</b>
            </div>
          </section>
        </div>

        <section className="form-card" style={{ marginTop: 24 }}>
          <h2>Owner configuration</h2>
          <p className="muted">Each action is a separate wallet transaction and is verified again from chain state after confirmation.</p>

          <div style={{ borderTop: "1px solid var(--line)", padding: "18px 0" }}>
            <strong>1. Approve AAPL in AssetRegistry</strong>
            <p>Status: <b>{state.assetApproved ? "Configured" : "Pending"}</b></p>
            {!state.assetApproved && <button className="primary" disabled={!authorized || !correctChain || !poolVerified || Boolean(busy)} onClick={() => send(
              "Approve AAPL",
              ROUTY_DEPLOYMENT.assetRegistry,
              encodeFunctionData({ abi: registryAbi, functionName: "setApproved", args: [FIRST_PRODUCTION_ROUTE.target, true] }),
            )}>Approve AAPL</button>}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", padding: "18px 0" }}>
            <strong>2. Configure AAPL/USD Chainlink feed</strong>
            <p>Expected: <code>{FIRST_PRODUCTION_ROUTE.targetFeed}</code></p>
            <p>Status: <b>{targetFeedConfigured ? "Configured" : "Pending"}</b></p>
            {!targetFeedConfigured && <button className="primary" disabled={!authorized || !correctChain || !poolVerified || Boolean(busy)} onClick={() => send(
              "Configure AAPL feed",
              ROUTY_DEPLOYMENT.oracleRegistry,
              encodeFunctionData({ abi: oracleAbi, functionName: "setFeed", args: [FIRST_PRODUCTION_ROUTE.target, FIRST_PRODUCTION_ROUTE.targetFeed] }),
            )}>Set AAPL feed</button>}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", padding: "18px 0" }}>
            <strong>3. Configure USDG/USD Chainlink feed</strong>
            <p>Expected: <code>{FIRST_PRODUCTION_ROUTE.quoteFeed}</code></p>
            <p>Status: <b>{quoteFeedConfigured ? "Configured" : "Pending"}</b></p>
            {!quoteFeedConfigured && <button className="primary" disabled={!authorized || !correctChain || !poolVerified || Boolean(busy)} onClick={() => send(
              "Configure USDG feed",
              ROUTY_DEPLOYMENT.oracleRegistry,
              encodeFunctionData({ abi: oracleAbi, functionName: "setFeed", args: [FIRST_PRODUCTION_ROUTE.quote, FIRST_PRODUCTION_ROUTE.quoteFeed] }),
            )}>Set USDG feed</button>}
          </div>

          <button className="secondary" onClick={() => refreshState().catch((cause) => setError(walletErrorMessage(cause, "Could not refresh chain state.")))} disabled={Boolean(busy)}>
            Refresh on-chain status
          </button>

          {complete && <div className="notice" style={{ marginTop: 16 }}>
            AAPL/USDG registry and oracle prerequisites are complete. SwapExecutor is still paused. The next step requires an actual Pons-launched token whose creator will provision a vault, then the owner can set this verified PoolKey.
          </div>}
          {notice && <p className="notice" role="status">{notice}</p>}
          {error && <p className="notice danger" role="alert">{error}</p>}
          <p className="muted">Explorer: <a href={EXPLORER} target="_blank" rel="noreferrer">{EXPLORER}</a></p>
        </section>
      </div>
    </main>
  );
}
