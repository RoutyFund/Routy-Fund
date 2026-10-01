"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, isAddress, keccak256, toHex, type Address, type Hex } from "viem";
import Nav from "@/components/Nav";
import {
  addressFromStorageWord,
  decodeAdapterSafetyWord,
  EXECUTOR_STORAGE_SLOTS,
  sameAddress,
} from "@/lib/adapter-repair";
import { DEPLOY_BYTECODE } from "@/lib/deploy-artifacts";
import {
  canCheckStep,
  canSubmitStep,
  encodeDeployment,
  encodeExecutorConfigureDependencies,
  type DeploymentStatus,
} from "@/lib/deploy-encoding";
import { ROUTY_DEPLOYMENT } from "@/lib/deployment";
import {
  getInjectedProvider,
  type EthereumProvider,
  type EthereumTransaction,
  type EthereumTransactionReceipt,
} from "@/lib/ethereum-provider";

const DEPLOYER = "0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const CHAIN_ID = "0x1237";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const MAX_DEVIATION_BPS = 200;
const ADAPTER_BYTECODE = DEPLOY_BYTECODE.SwapRouterAdapter as Hex;
const ARTIFACT_HASH = keccak256(ADAPTER_BYTECODE);
const STORAGE_KEY = `routy-adapter-repair-v1:${ARTIFACT_HASH}`;
const STEP_IDS = ["deployAdapter", "configureExecutor"] as const;

type StepId = (typeof STEP_IDS)[number];
type SavedStep = { hash: Hex; address?: Address };
type SavedProgress = Partial<Record<StepId, SavedStep>>;
type ExecutorState = {
  owner: Address;
  oracleRegistry: Address;
  oracleGuard: Address;
  oracleQuoter: Address;
  adapter: Address;
  maxDeviationBps: number;
  paused: boolean;
};

const STEPS = [
  {
    id: "deployAdapter" as const,
    title: "Deploy corrected SwapRouterAdapter",
    details: "Deploys only the CI-verified adapter containing the TAKE_ALL output-forwarding fix.",
  },
  {
    id: "configureExecutor" as const,
    title: "Point SwapExecutor to the corrected adapter",
    details: "Keeps the existing registry, guard, quoter, launcher, factories, and executor unchanged.",
  },
];

const statusLabel: Record<DeploymentStatus, string> = {
  pending: "Pending",
  "awaiting wallet signature": "Awaiting wallet signature",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
};

function validAddress(value: unknown): value is Address {
  return typeof value === "string"
    && isAddress(value, { strict: false })
    && value.toLowerCase() !== "0x0000000000000000000000000000000000000000";
}

function readSavedProgress(): SavedProgress {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, unknown>;
    const progress: SavedProgress = {};
    for (const id of STEP_IDS) {
      const candidate = value[id] as { hash?: unknown; address?: unknown } | undefined;
      if (candidate && typeof candidate.hash === "string" && /^0x[0-9a-f]{64}$/i.test(candidate.hash)) {
        progress[id] = {
          hash: candidate.hash as Hex,
          ...(validAddress(candidate.address) ? { address: candidate.address } : {}),
        };
      }
    }
    return progress;
  } catch {
    return {};
  }
}

function writeSavedProgress(progress: SavedProgress) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

async function storageWord(provider: EthereumProvider, slot: string): Promise<string> {
  return provider.request<string>({
    method: "eth_getStorageAt",
    params: [ROUTY_DEPLOYMENT.swapExecutor, slot, "latest"],
  });
}

async function readExecutorState(provider: EthereumProvider): Promise<ExecutorState> {
  const [ownerWord, registryWord, guardWord, quoterWord, adapterWord] = await Promise.all([
    storageWord(provider, EXECUTOR_STORAGE_SLOTS.owner),
    storageWord(provider, EXECUTOR_STORAGE_SLOTS.oracleRegistry),
    storageWord(provider, EXECUTOR_STORAGE_SLOTS.oracleGuard),
    storageWord(provider, EXECUTOR_STORAGE_SLOTS.oracleQuoter),
    storageWord(provider, EXECUTOR_STORAGE_SLOTS.adapterAndSafety),
  ]);
  const adapterSafety = decodeAdapterSafetyWord(adapterWord);
  return {
    owner: addressFromStorageWord(ownerWord),
    oracleRegistry: addressFromStorageWord(registryWord),
    oracleGuard: addressFromStorageWord(guardWord),
    oracleQuoter: addressFromStorageWord(quoterWord),
    ...adapterSafety,
  };
}

async function verifyCode(provider: EthereumProvider, address: Address) {
  const code = await provider.request<string>({ method: "eth_getCode", params: [address, "latest"] });
  if (code === "0x" || code.length <= 2) throw new Error(`No contract bytecode found at ${address}.`);
}

async function waitForReceipt(
  provider: EthereumProvider,
  hash: Hex,
  attempts = 30,
): Promise<EthereumTransactionReceipt | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = await provider.request<EthereumTransactionReceipt | null>({
      method: "eth_getTransactionReceipt",
      params: [hash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
  return null;
}

export default function AdapterRepairPage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("0");
  const [records, setRecords] = useState<SavedProgress>({});
  const [statuses, setStatuses] = useState<DeploymentStatus[]>(["pending", "pending"]);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const authorized = account.toLowerCase() === DEPLOYER.toLowerCase();
  const correctChain = chainId.toLowerCase() === CHAIN_ID;
  const newAdapter = records.deployAdapter?.address;
  const allConfirmed = statuses.every((status) => status === "confirmed") && Boolean(newAdapter);

  async function refreshWallet() {
    const provider = getInjectedProvider();
    if (!provider) return;
    const [accounts, chain] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    const nextAccount = accounts?.[0] || "";
    setAccount(nextAccount);
    setChainId(chain || "");
    if (nextAccount) {
      const amount = await provider.request<string>({ method: "eth_getBalance", params: [nextAccount, "latest"] });
      setBalance(formatEther(BigInt(amount)));
    }
  }

  async function connect() {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Compatible injected EVM wallet not found.");
      return;
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await refreshWallet();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
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
      setError(cause instanceof Error ? cause.message : "Could not switch to Robinhood Chain.");
    }
  }

  async function assertWallet(provider: EthereumProvider) {
    const [accounts, chain] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    const active = accounts?.[0] || "";
    setAccount(active);
    setChainId(chain || "");
    if (!sameAddress(active, DEPLOYER)) throw new Error(`Active wallet must be ${DEPLOYER}.`);
    if (chain.toLowerCase() !== CHAIN_ID) throw new Error("Wallet must be on Robinhood Chain (4663).");
  }

  async function verifyExecutorFoundation(provider: EthereumProvider): Promise<ExecutorState> {
    await verifyCode(provider, ROUTY_DEPLOYMENT.swapExecutor);
    const state = await readExecutorState(provider);
    if (!sameAddress(state.owner, DEPLOYER)) throw new Error("SwapExecutor owner does not match the authorized deployer.");
    if (!sameAddress(state.oracleRegistry, ROUTY_DEPLOYMENT.oracleRegistry)) throw new Error("Unexpected OracleRegistry configured on SwapExecutor.");
    if (!sameAddress(state.oracleGuard, ROUTY_DEPLOYMENT.oracleGuard)) throw new Error("Unexpected OracleGuard configured on SwapExecutor.");
    if (!sameAddress(state.oracleQuoter, ROUTY_DEPLOYMENT.swapOracleQuoter)) throw new Error("Unexpected SwapOracleQuoter configured on SwapExecutor.");
    if (!state.paused) throw new Error("SwapExecutor must remain paused during repair.");
    if (state.maxDeviationBps !== MAX_DEVIATION_BPS) throw new Error("Unexpected max price deviation configured on SwapExecutor.");
    return state;
  }

  async function verifyConfiguredAdapter(provider: EthereumProvider, address: Address) {
    const state = await verifyExecutorFoundation(provider);
    if (!sameAddress(state.adapter, address)) throw new Error("SwapExecutor does not point to the new adapter yet.");
  }

  async function verifyMinedStep(
    provider: EthereumProvider,
    index: number,
    receipt: EthereumTransactionReceipt,
    current: SavedProgress,
  ): Promise<SavedProgress> {
    if (receipt.status !== "0x1" && receipt.status !== "0x01") {
      throw new Error(`${STEPS[index].title} failed on-chain.`);
    }
    const saved = current[STEPS[index].id];
    if (!saved) throw new Error("Saved transaction metadata is missing.");
    const transaction = await provider.request<EthereumTransaction | null>({
      method: "eth_getTransactionByHash",
      params: [saved.hash],
    });
    if (!transaction || !sameAddress(transaction.from, DEPLOYER)) {
      throw new Error("Transaction sender does not match the authorized deployer.");
    }
    const next = { ...current };
    if (index === 0) {
      if (transaction.to) throw new Error("Adapter deployment transaction unexpectedly has a target address.");
      if (transaction.input.toLowerCase() !== ADAPTER_BYTECODE.toLowerCase()) {
        throw new Error("Adapter deployment input does not match the CI-verified artifact.");
      }
      if (!validAddress(receipt.contractAddress)) throw new Error("Deployment receipt has no valid contract address.");
      await verifyCode(provider, receipt.contractAddress);
      next.deployAdapter = { hash: saved.hash, address: receipt.contractAddress };
    } else {
      const address = current.deployAdapter?.address;
      if (!address) throw new Error("New adapter address is missing from saved deployment progress.");
      const expectedInput = encodeExecutorConfigureDependencies([
        ROUTY_DEPLOYMENT.oracleRegistry,
        ROUTY_DEPLOYMENT.oracleGuard,
        ROUTY_DEPLOYMENT.swapOracleQuoter,
        address,
        MAX_DEVIATION_BPS,
      ]);
      if (!transaction.to || !sameAddress(transaction.to, ROUTY_DEPLOYMENT.swapExecutor)) {
        throw new Error("Dependency configuration transaction targeted an unexpected contract.");
      }
      if (transaction.input.toLowerCase() !== expectedInput.toLowerCase()) {
        throw new Error("Dependency configuration calldata does not match the locked repair plan.");
      }
      await verifyConfiguredAdapter(provider, address);
    }
    return next;
  }

  async function applyReceipt(
    index: number,
    receipt: EthereumTransactionReceipt,
    current: SavedProgress,
  ): Promise<SavedProgress> {
    const provider = getInjectedProvider();
    if (!provider) throw new Error("Wallet provider disappeared while checking the receipt.");
    await assertWallet(provider);
    const next = await verifyMinedStep(provider, index, receipt, current);
    writeSavedProgress(next);
    setRecords(next);
    setStatuses((currentStatuses) => currentStatuses.map((status, position) => position === index ? "confirmed" : status));
    return next;
  }

  async function resumeProgress() {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Compatible injected EVM wallet not found.");
      return;
    }
    setError("");
    setNotice("");
    setActiveStep(-1);
    try {
      await assertWallet(provider);
      await verifyExecutorFoundation(provider);
      let loaded = readSavedProgress();
      const nextStatuses: DeploymentStatus[] = ["pending", "pending"];
      for (let index = 0; index < STEPS.length; index += 1) {
        const saved = loaded[STEPS[index].id];
        if (!saved) break;
        nextStatuses[index] = "submitted";
        const receipt = await provider.request<EthereumTransactionReceipt | null>({
          method: "eth_getTransactionReceipt",
          params: [saved.hash],
        });
        if (!receipt) break;
        loaded = await verifyMinedStep(provider, index, receipt, loaded);
        nextStatuses[index] = "confirmed";
      }
      writeSavedProgress(loaded);
      setRecords(loaded);
      setStatuses(nextStatuses);
      setNotice("Saved receipts and current SwapExecutor storage were verified on-chain. No transaction was sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify repair progress.");
    } finally {
      setActiveStep(null);
    }
  }

  async function sendStep(index: number) {
    if (!canSubmitStep(statuses, index) || activeStep !== null) return;
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Compatible injected EVM wallet not found.");
      return;
    }
    setActiveStep(index);
    setError("");
    setNotice("");
    let returnedHash: Hex | null = null;
    try {
      await assertWallet(provider);
      await verifyExecutorFoundation(provider);
      const current = readSavedProgress();
      if (current[STEPS[index].id]?.hash && statuses[index] !== "failed") {
        throw new Error("This step already has a transaction hash. Resume and verify it before retrying.");
      }

      let data: Hex;
      let to: Address | undefined;
      if (index === 0) {
        data = encodeDeployment("SwapRouterAdapter", ADAPTER_BYTECODE, []);
      } else {
        const address = current.deployAdapter?.address;
        if (!address) throw new Error("Deploy and confirm the corrected adapter first.");
        await verifyCode(provider, address);
        data = encodeExecutorConfigureDependencies([
          ROUTY_DEPLOYMENT.oracleRegistry,
          ROUTY_DEPLOYMENT.oracleGuard,
          ROUTY_DEPLOYMENT.swapOracleQuoter,
          address,
          MAX_DEVIATION_BPS,
        ]);
        to = ROUTY_DEPLOYMENT.swapExecutor;
      }

      const transaction = { from: DEPLOYER, ...(to ? { to } : {}), data, value: "0x0" };
      const estimate = await provider.request<Hex>({ method: "eth_estimateGas", params: [transaction] });
      const gas = toHex((BigInt(estimate) * 120n) / 100n);
      setStatuses((currentStatuses) => currentStatuses.map((status, position) => position === index ? "awaiting wallet signature" : status));
      const hash = await provider.request<Hex>({
        method: "eth_sendTransaction",
        params: [{ ...transaction, gas }],
      });
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Wallet did not return a valid transaction hash.");
      returnedHash = hash;
      const updated = { ...current, [STEPS[index].id]: { hash } };
      writeSavedProgress(updated);
      setRecords(updated);
      setStatuses((currentStatuses) => currentStatuses.map((status, position) => position === index ? "submitted" : status));
      setNotice("Transaction submitted. Waiting for its receipt…");
      const receipt = await waitForReceipt(provider, hash);
      if (!receipt) {
        setNotice("Transaction is still pending. Use Check status or Resume after it is mined.");
        return;
      }
      await applyReceipt(index, receipt, updated);
      setNotice(`${STEPS[index].title} confirmed and verified on-chain.`);
    } catch (cause) {
      if (returnedHash) {
        setError(`Transaction ${returnedHash} was submitted but could not be fully verified yet. Do not resend it; use Resume.`);
      } else {
        setStatuses((currentStatuses) => currentStatuses.map((status, position) => position === index ? "failed" : status));
        setError(cause instanceof Error ? cause.message : "Transaction failed or was rejected by the wallet.");
      }
    } finally {
      setActiveStep(null);
      refreshWallet().catch(() => {});
    }
  }

  async function checkStep(index: number) {
    if (!canCheckStep(statuses, index) || activeStep !== null) return;
    const provider = getInjectedProvider();
    const saved = records[STEPS[index].id];
    if (!provider || !saved) return;
    setActiveStep(index);
    setError("");
    setNotice("");
    try {
      await assertWallet(provider);
      const receipt = await provider.request<EthereumTransactionReceipt | null>({
        method: "eth_getTransactionReceipt",
        params: [saved.hash],
      });
      if (!receipt) {
        setNotice("Receipt is not available yet. The next step remains locked.");
        return;
      }
      await applyReceipt(index, receipt, readSavedProgress());
      setNotice(`${STEPS[index].title} confirmed and verified on-chain.`);
    } catch (cause) {
      setStatuses((currentStatuses) => currentStatuses.map((status, position) => position === index ? "failed" : status));
      setError(cause instanceof Error ? cause.message : "Could not verify the transaction receipt.");
    } finally {
      setActiveStep(null);
    }
  }

  async function copyCompletionReport() {
    if (!newAdapter || !records.deployAdapter?.hash || !records.configureExecutor?.hash) return;
    const report = {
      chainId: 4663,
      artifactHash: ARTIFACT_HASH,
      swapExecutor: ROUTY_DEPLOYMENT.swapExecutor,
      previousSwapRouterAdapter: ROUTY_DEPLOYMENT.swapRouterAdapter,
      swapRouterAdapter: newAdapter,
      deployTransaction: records.deployAdapter.hash,
      configureTransaction: records.configureExecutor.hash,
      maxDeviationBps: MAX_DEVIATION_BPS,
      swapExecutorPaused: true,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setNotice("Verified repair report copied. Paste it into our chat so the canonical deployment config can be finalized.");
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refreshWallet().catch(() => {});
      const saved = readSavedProgress();
      setRecords(saved);
      setStatuses(STEPS.map((step) => saved[step.id] ? "submitted" : "pending"));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="shell">
      <Nav />
      <div className="wrap">
        <span className="kicker">Routy protocol repair</span>
        <h1 style={{ fontSize: 56 }}>Update the swap adapter safely.</h1>
        <p className="muted">This repair performs exactly two explicit wallet transactions. It does not redeploy the launcher, factories, registries, vault system, or SwapExecutor.</p>

        <div className="launch-form">
          <section className="form-card" aria-labelledby="repair-wallet-title">
            <h2 id="repair-wallet-title">Deployer wallet</h2>
            <p>Authorized: <code className="mono-wrap">{DEPLOYER}</code></p>
            <p>Connected: <b>{account || "Not connected"}</b></p>
            <p>Network: <b>{chainId ? `${Number.parseInt(chainId, 16)}${correctChain ? " (Robinhood Chain)" : " (wrong chain)"}` : "Not connected"}</b></p>
            <p>Gas balance: <b>{balance} ETH</b></p>
            {!account
              ? <button className="primary" onClick={connect}>Connect wallet</button>
              : !correctChain
                ? <button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button>
                : !authorized
                  ? <div className="notice danger">Wrong wallet. Repair is locked.</div>
                  : <div className="notice">Authorized deployer and chain verified.</div>}
          </section>

          <section className="form-card" aria-labelledby="repair-scope-title">
            <h2 id="repair-scope-title">Locked repair scope</h2>
            <p>SwapExecutor: <code className="mono-wrap">{ROUTY_DEPLOYMENT.swapExecutor}</code></p>
            <p>Current adapter: <code className="mono-wrap">{ROUTY_DEPLOYMENT.swapRouterAdapter}</code></p>
            <p>Verified artifact: <code className="mono-wrap">{ARTIFACT_HASH}</code></p>
            <div className="notice">SwapExecutor must stay paused. This page contains no unpause or value-moving transaction.</div>
            <Link className="secondary inline-action" href="/deploy">View original deployment</Link>
          </section>
        </div>

        <section className="form-card repair-steps" aria-labelledby="repair-steps-title">
          <div className="section-head compact-head">
            <div>
              <h2 id="repair-steps-title">Two-step repair</h2>
              <p className="muted">Every receipt and the executor storage configuration are checked before continuing.</p>
            </div>
            <button className="secondary" onClick={resumeProgress} disabled={activeStep !== null}>Resume / verify</button>
          </div>
          <ol className="clean-steps">
            {STEPS.map((step, index) => {
              const status = statuses[index];
              const saved = records[step.id];
              const isNext = canSubmitStep(statuses, index);
              return (
                <li key={step.id} className="repair-step-row">
                  <div className="repair-step-copy">
                    <strong>{index + 1}. {step.title}</strong>
                    <p className="muted">{step.details}</p>
                    <p><b>Status:</b> {statusLabel[status]}</p>
                    {saved?.hash && <p>Transaction: <a href={`${EXPLORER}/tx/${saved.hash}`} target="_blank" rel="noreferrer"><code className="mono-wrap">{saved.hash}</code> ↗</a></p>}
                    {saved?.address && <p>New adapter: <a href={`${EXPLORER}/address/${saved.address}`} target="_blank" rel="noreferrer"><code className="mono-wrap">{saved.address}</code> ↗</a></p>}
                  </div>
                  <div className="repair-step-actions">
                    {status === "submitted" && <button className="secondary" onClick={() => checkStep(index)} disabled={activeStep !== null || !canCheckStep(statuses, index)}>Check status</button>}
                    {(status === "pending" || status === "failed") && <button className="primary" onClick={() => sendStep(index)} disabled={!authorized || !correctChain || !isNext || activeStep !== null}>{status === "failed" ? "Retry failed step" : "Submit transaction"}</button>}
                  </div>
                </li>
              );
            })}
          </ol>
          {error && <p role="alert" className="notice danger">{error}</p>}
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>

        {allConfirmed && newAdapter && (
          <section className="form-card repair-complete" aria-labelledby="repair-complete-title">
            <span className="kicker">On-chain verified</span>
            <h2 id="repair-complete-title">Adapter repair complete.</h2>
            <p>SwapExecutor now points to <a href={`${EXPLORER}/address/${newAdapter}`} target="_blank" rel="noreferrer"><code className="mono-wrap">{newAdapter}</code> ↗</a>.</p>
            <p className="muted">The executor remains paused. Copy the verified report so the repository and public API can be updated to this canonical address.</p>
            <button className="primary" onClick={copyCompletionReport}>Copy verified repair report</button>
          </section>
        )}
      </div>
    </main>
  );
}
