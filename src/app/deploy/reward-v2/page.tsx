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
    details: "Factory baru diperlukan karena factory V1 sudah terkunci ke launcher V1.",
  },
  {
    id: "swapExecutorV2",
    title: "Deploy SwapExecutor V2",
    kind: "deploy",
    details: "Executor baru dimulai paused dan tidak dapat mengeksekusi swap sebelum aktivasi terpisah.",
  },
  {
    id: "protocolLauncherV2",
    title: "Deploy ProtocolLauncherV2",
    kind: "deploy",
    details: "Launcher baru mengorkestrasi distributor, vault, fee router, dan registrasi vault V2.",
  },
  {
    id: "rewardFactoryLauncher",
    title: "Bind RewardDistributorFactory V2",
    kind: "call",
    details: "Set launcher satu kali ke ProtocolLauncherV2.",
  },
  {
    id: "vaultFactoryLauncher",
    title: "Bind AssetVaultV2Factory",
    kind: "call",
    details: "Set launcher satu kali ke ProtocolLauncherV2.",
  },
  {
    id: "routerFactoryLauncher",
    title: "Bind FeeRouterFactory V2",
    kind: "call",
    details: "Set launcher satu kali ke ProtocolLauncherV2.",
  },
  {
    id: "executorLauncher",
    title: "Bind SwapExecutor V2",
    kind: "call",
    details: "Set launcher satu kali agar vault V2 dapat diregistrasikan.",
  },
  {
    id: "executorDependencies",
    title: "Configure SwapExecutor V2 dependencies",
    kind: "call",
    details: "Reuse registry, oracle guard/quoter, dan canonical adapter yang sudah terverifikasi. Executor tetap paused.",
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
      setErr("Wallet EVM tidak ditemukan.");
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
    if (!provider) throw new Error("Wallet EVM tidak ditemukan.");
    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] || "");
    setChain(chainId || "");
    if (accounts?.[0]?.toLowerCase() !== OWNER.toLowerCase()) {
      throw new Error("Gunakan wallet owner Routy.");
    }
    if (chainId?.toLowerCase() !== CHAIN_ID) {
      throw new Error("Gunakan Robinhood Chain (4663).");
    }
    return provider;
  }

  async function verifyCode(provider: EthereumProvider, address: Address) {
    if (!valid(address)) throw new Error("Alamat kontrak tidak valid.");
    const code = await provider.request<string>({
      method: "eth_getCode",
      params: [address, "latest"],
    });
    if (!code || code === "0x") throw new Error(`Bytecode tidak ditemukan pada ${address}.`);
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
        throw new Error("Factory router dan executor V2 belum terverifikasi.");
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
      if (!addresses.protocolLauncherV2) throw new Error("ProtocolLauncherV2 belum terverifikasi.");
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
    throw new Error("Step tidak dikenal.");
  }

  function previousConfirmed(index: number) {
    if (index === 0) return true;
    const prev = STEPS[index - 1];
    return Boolean(saved[prev.id]?.address);
  }

  async function submit(step: Step, index: number) {
    setBusy(step.id);
    setErr("");
    setMsg("");
    try {
      if (!previousConfirmed(index)) throw new Error("Selesaikan dan verify langkah sebelumnya terlebih dahulu.");
      if (saved[step.id]?.hash) throw new Error("Step ini sudah memiliki transaction hash. Verify dulu; jangan kirim ulang.");

      const provider = await assertWallet();

      await verifyCode(provider, addresses.rewardFactoryV2);
      await verifyCode(provider, addresses.vaultFactoryV2);

      if (step.id === "protocolLauncherV2") {
        if (!addresses.routerFactoryV2 || !addresses.swapExecutorV2) throw new Error("Dependency V2 belum lengkap.");
        await verifyCode(provider, addresses.routerFactoryV2);
        await verifyCode(provider, addresses.swapExecutorV2);
      }

      const target = targetFor(step);
      if (step.kind === "call" && !target) throw new Error("Alamat target belum tersedia.");
      if (target) await verifyCode(provider, target);

      const data = buildData(step);
      const hash = await provider.request<Hex>({
        method: "eth_sendTransaction",
        params: [
          {
            from: OWNER,
            ...(target ? { to: target } : {}),
            data,
            value: "0x0",
          },
        ],
      });
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Wallet tidak mengembalikan transaction hash valid.");

      const next = { ...saved, [step.id]: { hash } };
      writeSaved(next);
      setSaved(next);
      setMsg("Transaksi dikirim. Tunggu konfirmasi lalu tekan Verify.");
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Transaksi gagal.");
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
      if (!record?.hash) throw new Error("Belum ada transaction hash.");

      const receipt = await provider.request<EthereumTransactionReceipt | null>({
        method: "eth_getTransactionReceipt",
        params: [record.hash],
      });
      if (!receipt) throw new Error("Receipt belum tersedia.");
      if (!isSuccess(receipt)) throw new Error("Transaksi gagal on-chain.");

      let address: Address | undefined;
      if (step.kind === "deploy") {
        if (!valid(receipt.contractAddress)) throw new Error("Receipt tidak memiliki contract address valid.");
        address = receipt.contractAddress;
      } else {
        address = targetFor(step);
        if (!address) throw new Error("Target kontrak tidak tersedia.");
      }

      await verifyCode(provider, address);

      const next = { ...saved, [step.id]: { hash: record.hash, address } };
      writeSaved(next);
      setSaved(next);
      setMsg(`${step.title} terverifikasi on-chain.`);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Verifikasi gagal.");
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
      setMsg("Progress V2 dipulihkan dan receipt yang tersedia sudah diverifikasi.");
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Gagal memulihkan progress.");
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
            Factory reward dan vault V2 sudah deployed. Wizard ini melengkapi router factory,
            executor, launcher, dan binding yang diperlukan. SwapExecutor V2 tetap paused setelah
            seluruh langkah selesai.
          </p>
        </section>

        <section className="panel">
          <h2>Existing verified V2 factories</h2>
          <p>RewardDistributorFactory V2: <code>{addresses.rewardFactoryV2}</code></p>
          <p>AssetVaultV2Factory: <code>{addresses.vaultFactoryV2}</code></p>
          <p className="muted">Kontrak V1 tidak diubah dan deployment lama tetap berjalan seperti sebelumnya.</p>
        </section>

        <section className="panel">
          <h2>Wallet guard</h2>
          <p>Owner: <code>{OWNER}</code></p>
          <p>Connected: <code>{account || "not connected"}</code> · chain <code>{chain || "-"}</code></p>
          <p>Gas balance: <b>{balance} ETH</b></p>
          {!account ? (
            <button onClick={connect}>Connect wallet</button>
          ) : !correctChain ? (
            <button onClick={switchChain}>Switch to Robinhood Chain</button>
          ) : !authorized ? (
            <p className="error">Wallet aktif bukan owner Routy.</p>
          ) : (
            <p className="success">Wallet dan chain benar.</p>
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
                    <button disabled={!!busy} onClick={() => verify(step)}>
                      Verify receipt
                    </button>
                  )}
                </>
              ) : (
                <button
                  disabled={!!busy || !ready || !authorized || !correctChain}
                  onClick={() => submit(step, index)}
                >
                  {busy === step.id ? "Awaiting wallet…" : step.kind === "deploy" ? "Deploy" : "Submit transaction"}
                </button>
              )}
            </section>
          );
        })}

        <section className="panel">
          <h2>Activation lock</h2>
          <p>
            Wizard ini tidak memanggil <code>setPaused(false)</code>. Setelah semua langkah hijau,
            V2 sudah tersambung tetapi belum dapat mengeksekusi swap. PoolKey, oracle feed, route test,
            dan pemeriksaan keamanan tetap harus selesai sebelum aktivasi produksi.
          </p>
          {allDone && <p className="success">Reward V2 infrastructure terhubung. Swap masih paused.</p>}
        </section>

        {msg && <p className="success">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </main>
    </>
  );
}
