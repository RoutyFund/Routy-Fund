"use client";

import Nav from "@/components/Nav";
import { useEffect, useMemo, useState } from "react";
import {
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { DEPLOY_BYTECODE } from "@/lib/deploy-artifacts";
import { ROUTY_DEPLOYMENT } from "@/lib/deployment";
import {
  getInjectedProvider,
  type EthereumProvider,
  type EthereumTransactionReceipt,
} from "@/lib/ethereum-provider";

const OWNER = "0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const CHAIN_ID = "0x1237";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const STORAGE_KEY = "routy-reward-v2-continuation-v1";

const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address;
const PONS_FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address;

const addressCtor = [
  { type: "constructor", inputs: [{ name: "admin_", type: "address" }] },
] as const;

const launcherV2Ctor = [
  {
    type: "constructor",
    inputs: [
      { name: "registry_", type: "address" },
      { name: "ponsFactory_", type: "address" },
      { name: "rewardFactory_", type: "address" },
      { name: "vaultFactory_", type: "address" },
      { name: "routerFactory_", type: "address" },
      { name: "feeEscrow_", type: "address" },
      { name: "treasury_", type: "address" },
      { name: "executor_", type: "address" },
    ],
  },
] as const;

const setLauncherAbi = [
  {
    type: "function",
    name: "setLauncher",
    stateMutability: "nonpayable",
    inputs: [{ name: "launcher_", type: "address" }],
    outputs: [],
  },
] as const;

const configureDependenciesAbi = [
  {
    type: "function",
    name: "configureDependencies",
    stateMutability: "nonpayable",
    inputs: [
      { name: "registry_", type: "address" },
      { name: "guard_", type: "address" },
      { name: "quoter_", type: "address" },
      { name: "adapter_", type: "address" },
      { name: "deviation_", type: "uint16" },
    ],
    outputs: [],
  },
] as const;

type StepId =
  | "routerFactoryV2"
  | "swapExecutorV2"
  | "protocolLauncherV2"
  | "rewardFactoryLauncher"
  | "vaultFactoryLauncher"
  | "routerFactoryLauncher"
  | "executorLauncher"
  | "executorDependencies";

type SavedStep = { hash: Hex; address?: Address };
type Saved = Partial<Record<StepId, SavedStep>>;

type Step = {
  id: StepId;
  title: string;
  kind: "deploy" | "call";
  details: string;
};

const STEPS: Step[] = [
  {
    id: "routerFactoryV2",
    title: "Deploy FeeRouterFactory V2",
    kind: "deploy",
    details: "A new factory is required because the V1 factory is already locked to the V1 launcher.",
  },
  {
    id: "swapExecutorV2",
    title: "Deploy SwapExecutor V2",
    kind: "deploy",
    details: "The new executor starts paused and cannot execute swaps until it is activated separately.",
  },
  {
    id: "protocolLauncherV2",
    title: "Deploy ProtocolLauncherV2",
    kind: "deploy",
    details: "The new launcher orchestrates the distributor, vault, fee router, and V2 vault registration.",
  },
  {
    id: "rewardFactoryLauncher",
    title: "Bind RewardDistributorFactory V2",
    kind: "call",
    details: "Set the launcher once to ProtocolLauncherV2.",
  },
  {
    id: "vaultFactoryLauncher",
    title: "Bind AssetVaultV2Factory",
    kind: "call",
    details: "Set the launcher once to ProtocolLauncherV2.",
  },
  {
    id: "routerFactoryLauncher",
    title: "Bind FeeRouterFactory V2",
    kind: "call",
    details: "Set the launcher once to ProtocolLauncherV2.",
  },
  {
    id: "executorLauncher",
    title: "Bind SwapExecutor V2",
    kind: "call",
    details: "Set the launcher once so V2 vaults can be registered.",
  },
  {
    id: "executorDependencies",
    title: "Configure SwapExecutor V2 dependencies",
    kind: "call",
    details: "Reuse the verified registry, oracle guard/quoter, and canonical adapter. The executor remains paused.",
  },
];

function valid(value: unknown): value is Address {
  return (
    typeof value === "string" &&
    isAddress(value, { strict: false }) &&
    value.toLowerCase() !== "0x0000000000000000000000000000000000000000"
  );
}

function readSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSaved(value: Saved) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function isSuccess(receipt: EthereumTransactionReceipt) {
  return receipt.status === "0x1" || receipt.status === "0x01";
}

export default function RewardV2Deploy() {
  const [account, setAccount] = useState("");
  const [chain, setChain] = useState("");
  const [balance, setBalance] = useState("0");
  const [saved, setSaved] = useState<Saved>({});
  const [busy, setBusy] = useState<StepId | "resume" | "">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [errorStep, setErrorStep] = useState<StepId | "">("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSaved(readSaved());
      refresh().catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const addresses = useMemo(() => {
    return {
      rewardFactoryV2: ROUTY_DEPLOYMENT.rewardDistributorFactoryV2 as Address,
      vaultFactoryV2: ROUTY_DEPLOYMENT.assetVaultFactoryV2 as Address,
      routerFactoryV2: saved.routerFactoryV2?.address,
      swapExecutorV2: saved.swapExecutorV2?.address,
      protocolLauncherV2: saved.protocolLauncherV2?.address,
    };
  }, [saved]);

  async function refresh() {
    const provider = getInjectedProvider();
    if (!provider) return;
    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] || "");
    setChain(chainId || "");
    if (accounts?.[0]) {
      const amount = await provider.request<string>({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      });
      setBalance(formatEther(BigInt(amount)));
    }
  }

  async function connect() {
    const provider = getInjectedProvider();
    if (!provider) {
      setErr("EVM wallet not found.");
      return;
    }
    await provider.request({ method: "eth_requestAccounts" });
    await refresh();
  }

  async function switchChain() {
    const provider = getInjectedProvider();
    if (!provider) return;
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID }],
    });
    await refresh();
  }

  async function assertWallet() {
    const provider = getInjectedProvider();
    if (!provider) throw new Error("EVM wallet not found.");
    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] || "");
    setChain(chainId || "");
    if (accounts?.[0]?.toLowerCase() !== OWNER.toLowerCase()) {
      throw new Error("Use the Routy owner wallet.");
    }
    if (chainId?.toLowerCase() !== CHAIN_ID) {
      throw new Error("Use Robinhood Chain (4663).");
    }
    return provider;
  }

  async function verifyCode(provider: EthereumProvider, address: Address) {
    if (!valid(address)) throw new Error("The contract address is invalid.");
    const code = await provider.request<string>({
      method: "eth_getCode",
      params: [address, "latest"],
    });
    if (!code || code === "0x") throw new Error(`No bytecode was found at ${address}.`);
  }

  function targetFor(step: Step): Address | undefined {
    if (step.id === "rewardFactoryLauncher") return addresses.rewardFactoryV2;
    if (step.id === "vaultFactoryLauncher") return addresses.vaultFactoryV2;
    if (step.id === "routerFactoryLauncher") return addresses.routerFactoryV2;
    if (step.id === "executorLauncher" || step.id === "executorDependencies") return addresses.swapExecutorV2;
    return undefined;
  }

  function buildData(step: Step): Hex {
    if (step.id === "routerFactoryV2") {
      const bytecode = DEPLOY_BYTECODE.FeeRouterFactory as Hex;
      return encodeDeployData({ bytecode, abi: addressCtor, args: [OWNER] });
    }
    if (step.id === "swapExecutorV2") {
      const bytecode = DEPLOY_BYTECODE.SwapExecutor as Hex;
      return encodeDeployData({ bytecode, abi: addressCtor, args: [OWNER] });
    }
    if (step.id === "protocolLauncherV2") {
      if (!addresses.routerFactoryV2 || !addresses.swapExecutorV2) {
        throw new Error("The V2 router factory and executor have not been verified yet.");
      }
      const bytecode = DEPLOY_BYTECODE.ProtocolLauncherV2 as Hex;
      return encodeDeployData({
        bytecode,
        abi: launcherV2Ctor,
        args: [
          ROUTY_DEPLOYMENT.assetRegistry as Address,
          PONS_FACTORY,
          addresses.rewardFactoryV2,
          addresses.vaultFactoryV2,
          addresses.routerFactoryV2,
          PONS_FEE_ESCROW,
          ROUTY_DEPLOYMENT.treasury as Address,
          addresses.swapExecutorV2,
        ],
      });
    }
    if (
      step.id === "rewardFactoryLauncher" ||
      step.id === "vaultFactoryLauncher" ||
      step.id === "routerFactoryLauncher" ||
      step.id === "executorLauncher"
    ) {
      if (!addresses.protocolLauncherV2) throw new Error("ProtocolLauncherV2 has not been verified yet.");
      return encodeFunctionData({
        abi: setLauncherAbi,
        functionName: "setLauncher",
        args: [addresses.protocolLauncherV2],
      });
    }
    if (step.id === "executorDependencies") {
      return encodeFunctionData({
        abi: configureDependenciesAbi,
        functionName: "configureDependencies",
        args: [
          ROUTY_DEPLOYMENT.oracleRegistry as Address,
          ROUTY_DEPLOYMENT.oracleGuard as Address,
          ROUTY_DEPLOYMENT.swapOracleQuoter as Address,
          ROUTY_DEPLOYMENT.swapRouterAdapter as Address,
          200,
        ],
      });
    }
    throw new Error("Unknown step.");
  }

  function previousConfirmed(index: number) {
    if (index === 0) return true;
    const prev = STEPS[index - 1];
    return Boolean(saved[prev.id]?.address);
  }

  async function submit(step: Step, index: number) {
    setBusy(step.id);
    setErr("");
    setErrorStep("");
    setMsg("");
    try {
      if (!previousConfirmed(index)) throw new Error("Complete and verify the previous step first.");
      if (saved[step.id]?.hash) throw new Error("This step already has a transaction hash. Verify it first; do not resubmit.");

      const provider = await assertWallet();

      await verifyCode(provider, addresses.rewardFactoryV2);
      await verifyCode(provider, addresses.vaultFactoryV2);

      if (step.id === "protocolLauncherV2") {
        if (!addresses.routerFactoryV2 || !addresses.swapExecutorV2) throw new Error("V2 dependencies are incomplete.");
        await verifyCode(provider, addresses.routerFactoryV2);
        await verifyCode(provider, addresses.swapExecutorV2);
      }

      const target = targetFor(step);
      if (step.kind === "call" && !target) throw new Error("The target address is not available yet.");
      if (target) await verifyCode(provider, target);

      const data = buildData(step);
      const tx = {
        from: OWNER,
        ...(target ? { to: target } : {}),
        data,
        value: "0x0",
      };

      let gas: Hex;
      try {
        const estimated = await provider.request<Hex>({
          method: "eth_estimateGas",
          params: [tx],
        });
        const padded = (BigInt(estimated) * 125n) / 100n;
        gas = (`0x${padded.toString(16)}`) as Hex;
      } catch (estimateCause) {
        const detail = estimateCause instanceof Error ? estimateCause.message : "unknown estimate error";
        throw new Error(`Gas estimation failed before the wallet prompt: ${detail}`);
      }

      const hash = await provider.request<Hex>({
        method: "eth_sendTransaction",
        params: [{ ...tx, gas }],
      });
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("The wallet did not return a valid transaction hash.");

      const next = { ...saved, [step.id]: { hash } };
      writeSaved(next);
      setSaved(next);
      setMsg("Transaction submitted. Wait for confirmation, then press Verify.");
    } catch (cause) {
      setErrorStep(step.id);
      setErr(cause instanceof Error ? cause.message : "Transaction failed.");
    } finally {
      setBusy("");
      refresh().catch(() => {});
    }
  }

  async function verify(step: Step) {
    setBusy(step.id);
    setErr("");
    setMsg("");
    try {
      const provider = await assertWallet();
      const record = saved[step.id];
      if (!record?.hash) throw new Error("No transaction hash is available yet.");

      const receipt = await provider.request<EthereumTransactionReceipt | null>({
        method: "eth_getTransactionReceipt",
        params: [record.hash],
      });
      if (!receipt) throw new Error("The receipt is not available yet.");
      if (!isSuccess(receipt)) throw new Error("The transaction failed on-chain.");

      let address: Address | undefined;
      if (step.kind === "deploy") {
        if (!valid(receipt.contractAddress)) throw new Error("The receipt does not contain a valid contract address.");
        address = receipt.contractAddress;
      } else {
        address = targetFor(step);
        if (!address) throw new Error("The contract target is not available.");
      }

      await verifyCode(provider, address);

      const next = { ...saved, [step.id]: { hash: record.hash, address } };
      writeSaved(next);
      setSaved(next);
      setMsg(`${step.title} verified on-chain.`);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Verification failed.");
    } finally {
      setBusy("");
    }
  }

  async function resume() {
    setBusy("resume");
    setErr("");
    setMsg("");
    try {
      const provider = await assertWallet();
      const next = { ...readSaved() };
      for (const step of STEPS) {
        const record = next[step.id];
        if (!record?.hash) break;
        const receipt = await provider.request<EthereumTransactionReceipt | null>({
          method: "eth_getTransactionReceipt",
          params: [record.hash],
        });
        if (!receipt || !isSuccess(receipt)) break;

        const address =
          step.kind === "deploy"
            ? receipt.contractAddress
            : targetFor(step);

        if (!valid(address)) break;
        await verifyCode(provider, address);
        next[step.id] = { hash: record.hash, address };
        writeSaved(next);
        setSaved({ ...next });
      }
      setMsg("V2 progress was restored and available receipts were verified.");
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Failed to restore progress.");
    } finally {
      setBusy("");
    }
  }

  const authorized = account.toLowerCase() === OWNER.toLowerCase();
  const correctChain = chain.toLowerCase() === CHAIN_ID;
  const allDone = STEPS.every((step) => Boolean(saved[step.id]?.address));

  return (
    <>
      <Nav />
      <main className="page-shell">
        <section className="hero compact">
          <div className="eyebrow">REWARD V2 / CONTINUATION</div>
          <h1>Complete Reward V2 infrastructure</h1>
          <p>
            The V2 reward and vault factories are already deployed. This wizard completes the router factory,
            executor, launcher, and required bindings. SwapExecutor V2 remains paused after
            all steps are complete.
          </p>
        </section>

        <section className="panel">
          <h2>Existing verified V2 factories</h2>
          <p>RewardDistributorFactory V2: <code>{addresses.rewardFactoryV2}</code></p>
          <p>AssetVaultV2Factory: <code>{addresses.vaultFactoryV2}</code></p>
          <p className="muted">V1 contracts are unchanged and the previous deployment continues to run as before.</p>
        </section>

        <section className="panel">
          <h2>Wallet guard</h2>
          <p>Owner: <code>{OWNER}</code></p>
          <p>Connected: <code>{account || "not connected"}</code> · chain <code>{chain || "-"}</code></p>
          <p>Gas balance: <b>{balance} ETH</b></p>
          {!account ? (
            <button className="primary" onClick={connect}>Connect wallet</button>
          ) : !correctChain ? (
            <button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button>
          ) : !authorized ? (
            <p className="error">The active wallet is not the Routy owner.</p>
          ) : (
            <p className="success">Wallet and chain verified.</p>
          )}
          <button className="secondary" disabled={!!busy} onClick={resume}>
            {busy === "resume" ? "Checking…" : "Resume / verify progress"}
          </button>
        </section>

        {STEPS.map((step, index) => {
          const record = saved[step.id];
          const ready = previousConfirmed(index);
          return (
            <section className="panel" key={step.id}>
              <div className="eyebrow">STEP {index + 1}</div>
              <h2>{step.title}</h2>
              <p className="muted">{step.details}</p>
              {record?.hash ? (
                <>
                  <p>
                    Tx:{" "}
                    <a href={`${EXPLORER}/tx/${record.hash}`} target="_blank" rel="noreferrer">
                      {record.hash}
                    </a>
                  </p>
                  {record.address ? (
                    <p>
                      Verified:{" "}
                      <a href={`${EXPLORER}/address/${record.address}`} target="_blank" rel="noreferrer">
                        <code>{record.address}</code>
                      </a>
                    </p>
                  ) : (
                    <button className="primary" disabled={!!busy} onClick={() => verify(step)}>
                      Verify receipt
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="primary"
                    disabled={!!busy || !ready || !authorized || !correctChain}
                    title={!ready ? "Verify the previous step first" : !authorized ? "Use the Routy owner wallet" : !correctChain ? "Use Robinhood Chain" : ""}
                    onClick={() => submit(step, index)}
                  >
                    {busy === step.id
                      ? "Awaiting wallet…"
                      : !ready
                        ? "Locked — verify previous step"
                        : step.kind === "deploy"
                          ? `Deploy ${step.title.replace("Deploy ", "")}`
                          : "Submit transaction"}
                  </button>
                  {!ready && <p className="muted">This step unlocks automatically after the previous step is Verified.</p>}
                </>
              )}
              {errorStep === step.id && err && (
                <p className="error" role="alert" style={{ marginTop: 12 }}>
                  {err}
                </p>
              )}
            </section>
          );
        })}

        <section className="panel">
          <h2>Activation lock</h2>
          <p>
            This wizard does not call <code>setPaused(false)</code>. After all steps are green,
            V2 is connected but still cannot execute swaps. PoolKey, oracle feed, and route tests
            and security checks must still be completed before production activation.
          </p>
          {allDone && <p className="success">Reward V2 infrastructure terhubung. Swap masih paused.</p>}
        </section>

        {msg && <p className="success">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </main>
    </>
  );
}
