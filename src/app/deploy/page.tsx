"use client";

import Link from "next/link";
import Nav from "@/components/Nav";
import { useEffect, useState } from "react";
import { formatEther, isAddress, type Address, type Hex } from "viem";
import { DEPLOY_BYTECODE } from "@/lib/deploy-artifacts";
import {
  getInjectedProvider,
  type EthereumProvider,
  type EthereumTransactionReceipt,
} from "@/lib/ethereum-provider";
import {
  canCheckStep,
  canSubmitStep,
  DEPLOYMENT_STEP_IDS,
  encodeDeployment,
  encodeExecutorConfigureDependencies,
  encodeSetLauncher,
  type DeployableContract,
  type DeploymentStatus,
} from "@/lib/deploy-encoding";

const DEPLOYER = "0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const TREASURY = "0xdA8ffb66f37E940c894Ea9ec3DCeEd858d81a4b0" as Address;
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address;
const PONS_FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address;
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;
const UNIVERSAL_ROUTER = "0x204FAca1764B154221e35c0d20aBb3c525710498" as Address;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
const CHAIN_ID = "0x1237";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const STORAGE_KEY = "routy-mainnet-deployment-v1";

type SavedStep = { hash: Hex; address?: Address };
type SavedProgress = Partial<Record<(typeof DEPLOYMENT_STEP_IDS)[number], SavedStep>>;
type StepDefinition = {
  id: (typeof DEPLOYMENT_STEP_IDS)[number];
  title: string;
  kind: "deploy" | "call";
  contract: string;
  details: string;
};

const STEPS: StepDefinition[] = [
  { id: "assetRegistry", title: "Deploy AssetRegistry", kind: "deploy", contract: "AssetRegistry", details: "AssetRegistry(deployer)" },
  { id: "oracleRegistry", title: "Deploy OracleRegistry", kind: "deploy", contract: "OracleRegistry", details: "OracleRegistry(deployer)" },
  { id: "swapExecutor", title: "Deploy SwapExecutor", kind: "deploy", contract: "SwapExecutor", details: "SwapExecutor(deployer); paused by default" },
  { id: "oracleGuard", title: "Deploy OracleGuard", kind: "deploy", contract: "OracleGuard", details: "OracleGuard(3600)" },
  { id: "swapOracleQuoter", title: "Deploy SwapOracleQuoter", kind: "deploy", contract: "SwapOracleQuoter", details: "Small oracle quoting helper" },
  { id: "swapRouterAdapter", title: "Deploy SwapRouterAdapter", kind: "deploy", contract: "SwapRouterAdapter", details: "Small constrained Uniswap V4 adapter" },
  { id: "feeRouterFactory", title: "Deploy FeeRouterFactory", kind: "deploy", contract: "FeeRouterFactory", details: "FeeRouterFactory(deployer)" },
  { id: "assetVaultFactory", title: "Deploy AssetVaultFactory", kind: "deploy", contract: "AssetVaultFactory", details: "AssetVaultFactory(deployer)" },
  { id: "protocolLauncher", title: "Deploy ProtocolLauncher", kind: "deploy", contract: "ProtocolLauncher", details: "Registry, Pons Factory, both factories, Pons Fee Escrow, Treasury, SwapExecutor" },
  { id: "feeRouterLauncher", title: "Set FeeRouterFactory launcher", kind: "call", contract: "FeeRouterFactory", details: "setLauncher(ProtocolLauncher)" },
  { id: "assetVaultLauncher", title: "Set AssetVaultFactory launcher", kind: "call", contract: "AssetVaultFactory", details: "setLauncher(ProtocolLauncher)" },
  { id: "swapExecutorLauncher", title: "Set SwapExecutor launcher", kind: "call", contract: "SwapExecutor", details: "setLauncher(ProtocolLauncher)" },
  { id: "swapDependencies", title: "Configure SwapExecutor dependencies", kind: "call", contract: "SwapExecutor", details: "OracleRegistry, OracleGuard, SwapOracleQuoter, SwapRouterAdapter, 200 bps" },
];

function validAddress(value: unknown): value is Address {
  return typeof value === "string"
    && isAddress(value, { strict: false })
    && value.toLowerCase() !== "0x0000000000000000000000000000000000000000";
}

function emptyStatuses(): DeploymentStatus[] {
  return STEPS.map(() => "pending");
}

function readSavedProgress(): SavedProgress {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const saved: SavedProgress = {};
    for (const step of STEPS) {
      const record = value?.[step.id];
      if (record && typeof record.hash === "string" && /^0x[0-9a-f]{64}$/i.test(record.hash)) {
        saved[step.id] = {
          hash: record.hash as Hex,
          ...(validAddress(record.address) ? { address: record.address } : {}),
        };
      }
    }
    return saved;
  } catch {
    return {};
  }
}

function writeSavedProgress(progress: SavedProgress) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function stepAddress(id: StepDefinition["id"], verified: Partial<Record<string, Address>>): Address | undefined {
  if (id === "feeRouterLauncher") return verified.feeRouterFactory;
  if (id === "assetVaultLauncher") return verified.assetVaultFactory;
  if (id === "swapExecutorLauncher" || id === "swapDependencies") return verified.swapExecutor;
  return verified[id];
}

function deploymentArguments(id: StepDefinition["id"], verified: Partial<Record<string, Address>>) {
  switch (id) {
    case "assetRegistry":
    case "oracleRegistry":
    case "swapExecutor":
    case "feeRouterFactory":
    case "assetVaultFactory":
      return [DEPLOYER] as const;
    case "oracleGuard":
      return [3600n] as const;
    case "swapOracleQuoter":
    case "swapRouterAdapter":
      return [] as const;
    case "protocolLauncher":
      return [
        verified.assetRegistry,
        PONS_FACTORY,
        verified.assetVaultFactory,
        verified.feeRouterFactory,
        PONS_FEE_ESCROW,
        TREASURY,
        verified.swapExecutor,
      ] as const;
    default:
      throw new Error("Langkah ini bukan deployment.");
  }
}

function requiredAddresses(id: StepDefinition["id"], verified: Partial<Record<string, Address>>): Address[] {
  if (id === "protocolLauncher") {
    return [
      verified.assetRegistry,
      verified.oracleRegistry,
      verified.swapExecutor,
      verified.oracleGuard,
      verified.feeRouterFactory,
      verified.assetVaultFactory,
      PONS_FACTORY,
      PONS_FEE_ESCROW,
      TREASURY,
    ].filter((address): address is Address => Boolean(address));
  }
  if (id === "feeRouterLauncher") return [verified.protocolLauncher, verified.feeRouterFactory].filter((address): address is Address => Boolean(address));
  if (id === "assetVaultLauncher") return [verified.protocolLauncher, verified.assetVaultFactory].filter((address): address is Address => Boolean(address));
  if (id === "swapExecutorLauncher") return [verified.protocolLauncher, verified.swapExecutor].filter((address): address is Address => Boolean(address));
  if (id === "swapDependencies") {
    return [verified.swapExecutor, verified.oracleRegistry, verified.oracleGuard, verified.swapOracleQuoter, verified.swapRouterAdapter]
      .filter((address): address is Address => Boolean(address));
  }
  return [];
}

function transactionData(step: StepDefinition, verified: Partial<Record<string, Address>>): Hex {
  if (step.kind === "deploy") {
    const bytecode = DEPLOY_BYTECODE[step.contract as keyof typeof DEPLOY_BYTECODE];
    if (typeof bytecode !== "string" || !bytecode.startsWith("0x") || bytecode.length <= 2) {
      throw new Error(`Bytecode ${step.contract} tidak tersedia.`);
    }
    return encodeDeployment(step.contract as DeployableContract, bytecode as Hex, deploymentArguments(step.id, verified));
  }
  if (step.id === "feeRouterLauncher" || step.id === "assetVaultLauncher" || step.id === "swapExecutorLauncher") {
    const launcher = verified.protocolLauncher;
    if (!launcher) throw new Error("Alamat ProtocolLauncher belum terverifikasi.");
    return encodeSetLauncher(launcher);
  }
  if (step.id === "swapDependencies") {
    if (!verified.oracleRegistry || !verified.oracleGuard || !verified.swapOracleQuoter || !verified.swapRouterAdapter) throw new Error("Alamat dependency swap belum terverifikasi.");
    return encodeExecutorConfigureDependencies([
      verified.oracleRegistry,
      verified.oracleGuard,
      verified.swapOracleQuoter!,
      verified.swapRouterAdapter!,
      200,
    ]);
  }
  throw new Error("Encoding transaksi tidak dikenal.");
}

export default function DeployPage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("0");
  const [records, setRecords] = useState<SavedProgress>({});
  const [statuses, setStatuses] = useState<DeploymentStatus[]>(emptyStatuses);
  const [verified, setVerified] = useState<Partial<Record<string, Address>>>({});
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshWallet() {
    const provider = getInjectedProvider();
    if (!provider) return;
    const accounts = await provider.request<string[]>({ method: "eth_accounts" });
    const chain = await provider.request<string>({ method: "eth_chainId" });
    setAccount(accounts?.[0] ?? "");
    setChainId(chain ?? "");
    if (accounts?.[0]) {
      const amount = await provider.request<string>({ method: "eth_getBalance", params: [accounts[0], "latest"] });
      setBalance(formatEther(BigInt(amount)));
    }
  }

  async function connect() {
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Wallet EVM injected tidak ditemukan.");
      return;
    }
    try {
      await provider.request({ method: "eth_requestAccounts" });
      await refreshWallet();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Koneksi wallet gagal.");
    }
  }

  async function switchChain() {
    const provider = getInjectedProvider();
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
      await refreshWallet();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal beralih ke Robinhood Chain.");
    }
  }

  async function assertWallet(provider: EthereumProvider) {
    const [accounts, chain] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }),
      provider.request<string>({ method: "eth_chainId" }),
    ]);
    setAccount(accounts?.[0] ?? "");
    setChainId(chain ?? "");
    if (accounts?.[0]?.toLowerCase() !== DEPLOYER.toLowerCase()) {
      throw new Error(`Wallet aktif harus tepat ${DEPLOYER}.`);
    }
    if (chain?.toLowerCase() !== CHAIN_ID) {
      throw new Error("Wallet harus berada di Robinhood Chain (4663).");
    }
  }

  async function verifyCode(provider: EthereumProvider, address: Address) {
    if (!validAddress(address)) throw new Error("Alamat nol atau tidak valid ditolak.");
    const code = await provider.request<string>({ method: "eth_getCode", params: [address, "latest"] });
    if (typeof code !== "string" || code === "0x" || code.length <= 2) {
      throw new Error(`Tidak ditemukan bytecode on-chain pada ${address}.`);
    }
  }

  async function verifyPreconditions(index: number, provider: EthereumProvider) {
    await assertWallet(provider);
    const step = STEPS[index];
    const needed = requiredAddresses(step.id, verified);
    const minimum = step.id === "protocolLauncher" ? 9 : step.id === "swapDependencies" ? 5 : step.kind === "call" ? 2 : 0;
    if (needed.length !== minimum || needed.some((address) => !validAddress(address))) {
      throw new Error("Alamat prasyarat belum lengkap atau mengandung alamat nol.");
    }
    for (const address of needed) {
      if (step.id === "protocolLauncher" && address.toLowerCase() === TREASURY.toLowerCase()) continue;
      await verifyCode(provider, address);
    }
    if (step.kind === "deploy") {
      const bytecode = DEPLOY_BYTECODE[step.contract as keyof typeof DEPLOY_BYTECODE];
      if (typeof bytecode !== "string" || bytecode.length <= 2) throw new Error(`Bytecode ${step.contract} tidak tersedia.`);
    }
  }

  async function resumeProgress() {
    setError("");
    setNotice("");
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Wallet EVM injected tidak ditemukan.");
      return;
    }
    try {
      await assertWallet(provider);
      const loaded = readSavedProgress();
      setRecords(loaded);
      const nextStatuses = emptyStatuses();
      const nextVerified: Partial<Record<string, Address>> = {};
      for (let index = 0; index < STEPS.length; index += 1) {
        const step = STEPS[index];
        const saved = loaded[step.id];
        if (!saved) break;
        nextStatuses[index] = "submitted";
        const receipt = await provider.request<EthereumTransactionReceipt | null>({ method: "eth_getTransactionReceipt", params: [saved.hash] });
        if (!receipt) break;
        if (receipt.status !== "0x1" && receipt.status !== "0x01") {
          nextStatuses[index] = "failed";
          setError(`${step.title} gagal on-chain. Hanya langkah ini yang dapat dicoba ulang.`);
          break;
        }
        let address: Address | undefined;
        if (step.kind === "deploy") {
          if (!validAddress(receipt.contractAddress)) {
            nextStatuses[index] = "failed";
            setError(`Receipt ${step.title} tidak memiliki contract address yang valid.`);
            break;
          }
          address = receipt.contractAddress;
        } else {
          address = stepAddress(step.id, nextVerified);
        }
        if (address) {
          await verifyCode(provider, address);
          nextVerified[step.kind === "deploy" ? step.id : step.contract === "SwapExecutor" ? "swapExecutor" : step.id] = address;
          if (step.kind === "deploy") loaded[step.id] = { hash: saved.hash, address };
        }
        nextStatuses[index] = "confirmed";
      }
      writeSavedProgress(loaded);
      setRecords(loaded);
      setVerified(nextVerified);
      setStatuses(nextStatuses);
      setNotice("Progress diverifikasi dari receipt dan eth_getCode. Tidak ada transaksi yang dikirim.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memulihkan progress deployment.");
    }
  }

  async function sendStep(index: number) {
    if (!canSubmitStep(statuses, index) || (activeStep !== null && activeStep !== index)) return;
    const provider = getInjectedProvider();
    if (!provider) {
      setError("Wallet EVM injected tidak ditemukan.");
      return;
    }
    setActiveStep(index);
    setError("");
    setNotice("");
    let returnedHash: Hex | null = null;
    try {
      await verifyPreconditions(index, provider);
      const step = STEPS[index];
      const data = transactionData(step, verified);
      const target = step.kind === "call" ? stepAddress(step.id, verified) : undefined;
      if (target && !validAddress(target)) throw new Error("Alamat tujuan transaksi tidak valid.");
      const preflightProgress = readSavedProgress();
      if (preflightProgress[step.id]?.hash && statuses[index] !== "failed") {
        throw new Error("Langkah ini sudah memiliki transaction hash. Resume dan periksa receipt sebelum mencoba lagi.");
      }
      writeSavedProgress(preflightProgress);
      setStatuses((current) => current.map((status, position) => position === index ? "awaiting wallet signature" : status));
      const hash = await provider.request<Hex>({
        method: "eth_sendTransaction",
        params: [{ from: DEPLOYER, ...(target ? { to: target } : {}), data, value: "0x0", ...(step.contract === "SwapExecutor" ? { gas: "0x124f80" } : {}) }],
      });
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Wallet tidak mengembalikan transaction hash yang valid.");
      returnedHash = hash;
      const updated = { ...records, [step.id]: { hash } };
      writeSavedProgress(updated);
      setRecords(updated);
      setStatuses((current) => current.map((status, position) => position === index ? "submitted" : status));
      setNotice("Transaksi dikirim oleh wallet. Periksa receipt sebelum melanjutkan.");
    } catch (cause) {
      if (returnedHash) {
        const updated = { ...readSavedProgress(), [STEPS[index].id]: { hash: returnedHash } };
        setRecords(updated);
        setStatuses((current) => current.map((status, position) => position === index ? "submitted" : status));
        setError(`Wallet mengembalikan hash ${returnedHash}, tetapi penyimpanan lokal gagal. Jangan kirim ulang; periksa receipt pada langkah ini.`);
      } else {
        setStatuses((current) => current.map((status, position) => position === index ? "failed" : status));
        setError(cause instanceof Error ? cause.message : "Transaksi gagal atau ditolak wallet.");
      }
    } finally {
      setActiveStep(null);
      refreshWallet().catch(() => {});
    }
  }

  async function checkStep(index: number) {
    if (!canCheckStep(statuses, index)) return;
    const step = STEPS[index];
    const saved = records[step.id];
    const provider = getInjectedProvider();
    if (!saved || !provider) return;
    setActiveStep(index);
    setError("");
    setNotice("");
    try {
      await assertWallet(provider);
      const receipt = await provider.request<EthereumTransactionReceipt | null>({ method: "eth_getTransactionReceipt", params: [saved.hash] });
      if (!receipt) {
        setNotice("Receipt belum tersedia. Langkah berikutnya tetap terkunci.");
        return;
      }
      if (receipt.status !== "0x1" && receipt.status !== "0x01") {
        setStatuses((current) => current.map((status, position) => position === index ? "failed" : status));
        setError(`${step.title} gagal on-chain. Hanya langkah ini yang dapat dicoba ulang.`);
        return;
      }
      let address: Address | undefined;
      if (step.kind === "deploy") {
        if (!validAddress(receipt.contractAddress)) throw new Error("Receipt tidak memiliki alamat kontrak valid.");
        address = receipt.contractAddress;
      } else {
        address = stepAddress(step.id, verified);
      }
      if (address) await verifyCode(provider, address);
      const nextVerified = { ...verified };
      if (address) nextVerified[step.kind === "deploy" ? step.id : step.contract === "SwapExecutor" ? "swapExecutor" : step.id] = address;
      const updated = { ...records, [step.id]: { hash: saved.hash, ...(step.kind === "deploy" && address ? { address } : {}) } };
      writeSavedProgress(updated);
      setRecords(updated);
      setVerified(nextVerified);
      setStatuses((current) => current.map((status, position) => position === index ? "confirmed" : status));
      setNotice(`${step.title} terkonfirmasi; kode kontrak telah diverifikasi.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Receipt atau kode kontrak belum dapat diverifikasi.");
    } finally {
      setActiveStep(null);
    }
  }

  async function copyAddress(address: Address) {
    await navigator.clipboard.writeText(address);
    setNotice("Alamat kontrak disalin.");
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refreshWallet().catch(() => {});
      const loaded = readSavedProgress();
      setRecords(loaded);
      setStatuses(STEPS.map((step) => loaded[step.id] ? "submitted" : "pending"));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const authorized = account.toLowerCase() === DEPLOYER.toLowerCase();
  const correctChain = chainId.toLowerCase() === CHAIN_ID;
  const allConfirmed = statuses.every((status) => status === "confirmed");
  const statusLabel: Record<DeploymentStatus, string> = {
    pending: "Pending",
    "awaiting wallet signature": "Awaiting wallet signature",
    submitted: "Submitted",
    confirmed: "Confirmed",
    failed: "Failed",
  };

  return (
    <main className="shell">
      <Nav />
      <div className="wrap">
        <span className="kicker">Routy deployment console</span>
        <h1 style={{ fontSize: 56 }}>Mainnet deployment</h1>
        <p className="muted">Robinhood Chain (4663). Transactions are initiated only by your injected wallet, one explicit confirmation at a time. No private key or seed phrase is requested or stored.</p>
        <div className="notice danger deployment-repair-callout">
          This historical deployment used an outdated SwapRouterAdapter. Do not repeat the full deployment. <Link href="/deploy/repair"><b>Open the two-step adapter repair →</b></Link>
        </div>

        <div className="launch-form">
          <section className="form-card" aria-labelledby="wallet-title">
            <h2 id="wallet-title">Deployer wallet</h2>
            <p>Authorized address: <b>{DEPLOYER}</b></p>
            <p>Connected: <b>{account || "Not connected"}</b></p>
            <p>Network: <b>{chainId ? `${parseInt(chainId, 16)}${correctChain ? " (Robinhood Chain)" : " (wrong chain)"}` : "Not connected"}</b></p>
            <p>Gas balance: <b>{balance} ETH</b></p>
            {!account ? <button className="primary" onClick={connect}>Connect wallet</button> : !correctChain ? <button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button> : !authorized ? <div className="notice">Wallet tidak berwenang. Deployment dikunci.</div> : <div className="notice">Wallet deployer dan chain cocok.</div>}
          </section>

          <section className="form-card" aria-labelledby="config-title">
            <h2 id="config-title">Immutable deployment config</h2>
            <p>Treasury: <b>{TREASURY}</b></p>
            <p>Pons Factory: <b>{PONS_FACTORY}</b></p>
            <p>Pons Fee Escrow: <b>{PONS_FEE_ESCROW}</b></p>
            <p>Uniswap V4 PoolManager: <b>{POOL_MANAGER}</b></p>
            <p>Universal Router: <b>{UNIVERSAL_ROUTER}</b></p>
            <p>Permit2: <b>{PERMIT2}</b></p>
            <p>Fee split: <b>80% Asset Vault / 20% Treasury</b></p>
            <div className="notice">SwapExecutor stays paused. No swap-enabling transaction is included.</div>
          </section>
        </div>

        <section className="form-card" style={{ marginTop: 24 }} aria-labelledby="steps-title">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 id="steps-title">Deployment checklist</h2>
              <p className="muted">Each transaction requires its own wallet approval and receipt check.</p>
            </div>
            <button className="secondary" onClick={resumeProgress} disabled={activeStep !== null}>Resume / verify saved progress</button>
          </div>
          <ol style={{ paddingLeft: 24 }}>
            {STEPS.map((step, index) => {
              const status = statuses[index];
              const saved = records[step.id];
              const targetAddress = stepAddress(step.id, verified);
              const isNext = canSubmitStep(statuses, index);
              return (
                <li key={step.id} style={{ borderTop: "1px solid var(--line)", padding: "18px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 260, flex: 1 }}>
                      <strong>{index + 1}. {step.title}</strong>
                      <p className="muted" style={{ margin: "6px 0" }}>{step.details}</p>
                      <p><b>Status:</b> {statusLabel[status]}</p>
                      {saved?.hash && <p>Transaction: <a href={`${EXPLORER}/tx/${saved.hash}`} target="_blank" rel="noreferrer"><code>{saved.hash}</code> ↗</a></p>}
                      {targetAddress && <p>Contract address: <a href={`${EXPLORER}/address/${targetAddress}`} target="_blank" rel="noreferrer"><code>{targetAddress}</code> ↗</a></p>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {status === "submitted" && <button className="secondary" onClick={() => checkStep(index)} disabled={activeStep !== null || !canCheckStep(statuses, index)}>Check status</button>}
                      {(status === "pending" || status === "failed") && <button className="primary" onClick={() => sendStep(index)} disabled={!authorized || !correctChain || !isNext || activeStep !== null}>{status === "failed" ? "Retry failed step" : "Submit transaction"}</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {error && <p role="alert" className="notice" style={{ borderColor: "#b42318", color: "#b42318" }}>{error}</p>}
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>

        {allConfirmed && <section className="form-card" style={{ marginTop: 24 }} aria-labelledby="summary-title">
          <h2 id="summary-title">Deployed contract addresses</h2>
          {STEPS.filter((step) => step.kind === "deploy").map((step) => {
            const address = verified[step.id];
            if (!address) return null;
            return <p key={step.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b>{step.contract}</b> <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer"><code>{address}</code> ↗</a> <button className="secondary" onClick={() => copyAddress(address)}>Copy</button></p>;
          })}
        </section>}
      </div>
    </main>
  );
}
