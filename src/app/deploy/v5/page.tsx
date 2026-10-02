"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {decodeFunctionResult, encodeFunctionData, type Address, type Hex} from "viem";
import Nav from "@/components/Nav";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {PONS_V2} from "@/lib/pons";
import {
  getInjectedProvider, walletErrorMessage,
  type EthereumProvider, type EthereumTransaction, type EthereumTransactionReceipt,
} from "@/lib/ethereum-provider";
import {
  V5_STEPS, assertV5Transaction, buildV5Transaction, parseV5Progress,
  validV5Address, v5StepReady, type V5Configuration, type V5Progress, type V5StepId,
} from "@/lib/v5-deployment";

const OWNER = ROUTY_DEPLOYMENT.automationOperatorV4 as Address;
const CHAIN = "0x1237";
const KEY = "routy-v5-deployment-v1";
const CONFIG: V5Configuration = {
  owner: OWNER, operator: OWNER, treasury: ROUTY_DEPLOYMENT.treasury as Address,
  registry: ROUTY_DEPLOYMENT.assetRegistry as Address, ponsFactory: PONS_V2.factory,
  escrow: PONS_V2.feeEscrow, oracleRegistry: ROUTY_DEPLOYMENT.oracleRegistry as Address,
  oracleGuard: ROUTY_DEPLOYMENT.oracleGuard as Address,
  quoter: ROUTY_DEPLOYMENT.swapOracleQuoter as Address, adapter: ROUTY_DEPLOYMENT.swapRouterAdapter as Address,
};
const launcherReadAbi = [{type: "function", name: "launcher", stateMutability: "view", inputs: [], outputs: [{type: "address"}]}] as const;
type LiveConfig = {generation?: string; launchReady?: boolean; deployment?: {missing?: string[]}};
type Busy = V5StepId | "connect" | "restore" | "";

function save(progress: V5Progress) {
  localStorage.setItem(KEY, JSON.stringify(progress));
}
async function guardedProvider(): Promise<EthereumProvider> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error("Open this page in your EVM wallet browser.");
  const [accounts, chain] = await Promise.all([
    provider.request<string[]>({method: "eth_accounts"}),
    provider.request<string>({method: "eth_chainId"}),
  ]);
  if (accounts?.[0]?.toLowerCase() !== OWNER.toLowerCase()) throw new Error("Connect the Routy deployment wallet shown above.");
  if (chain.toLowerCase() !== CHAIN) throw new Error("Switch to Robinhood Chain (4663).");
  return provider;
}
async function verifyReceipt(provider: EthereumProvider, id: V5StepId, progress: V5Progress): Promise<Address> {
  const hash = progress[id]?.hash;
  if (!hash) throw new Error("No transaction hash saved.");
  const receipt = await provider.request<EthereumTransactionReceipt | null>({method: "eth_getTransactionReceipt", params: [hash]});
  if (!receipt) throw new Error("Transaction is pending. Check its receipt again after confirmation.");
  if (receipt.status !== "0x1" && receipt.status !== "0x01") throw new Error("Transaction reverted. Retry this step after checking the explorer.");
  const expected = buildV5Transaction(id, progress, CONFIG, DEPLOY_BYTECODE);
  const transaction = await provider.request<EthereumTransaction | null>({method: "eth_getTransactionByHash", params: [hash]});
  if (!transaction) throw new Error("Transaction could not be read.");
  assertV5Transaction(expected, transaction);
  const address = expected.to || receipt.contractAddress;
  if (!validV5Address(address)) throw new Error("The receipt has no valid contract address.");
  const code = await provider.request<string>({method: "eth_getCode", params: [address, "latest"]});
  if (!code || code === "0x" || code === "0x0") throw new Error("No deployed contract found.");
  if (id.startsWith("bind")) {
    const data = encodeFunctionData({abi: launcherReadAbi, functionName: "launcher"});
    const result = await provider.request<Hex>({method: "eth_call", params: [{to: address, data}, "latest"]});
    const launcher = decodeFunctionResult({abi: launcherReadAbi, functionName: "launcher", data: result});
    if (launcher.toLowerCase() !== progress.launcher?.address?.toLowerCase()) throw new Error("On-chain launcher binding does not match.");
  }
  return address;
}

export default function V5DeploymentPage() {
  const [account, setAccount] = useState("");
  const [chain, setChain] = useState("");
  const [progress, setProgress] = useState<V5Progress>({});
  const [verified, setVerified] = useState<Partial<Record<V5StepId, boolean>>>({});
  const [busy, setBusy] = useState<Busy>("");
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backup, setBackup] = useState("");
  const [live, setLive] = useState<LiveConfig | null>(null);
  const working = useRef(false);
  const refreshWallet = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({method: "eth_accounts"}),
      provider.request<string>({method: "eth_chainId"}),
    ]);
    setAccount(accounts?.[0] || "");
    setChain(chainId || "");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {setProgress(parseV5Progress(JSON.parse(localStorage.getItem(KEY) || "{}"))); setLoaded(true); }
      catch {setError("Saved deployment progress could not be read. Restore your deployment backup.");}
      void refreshWallet().catch(() => {});
    }, 0);
    const provider = getInjectedProvider();
    const changed = () => {setVerified({}); void refreshWallet().catch(() => {});};
    provider?.on?.("accountsChanged", changed);
    provider?.on?.("chainChanged", changed);
    let stopped = false;
    void fetch("/api/auto-setup/config", {cache: "no-store"}).then(r => r.json()).then(data => {if (!stopped) setLive(data);}).catch(() => {});
    return () => {
      stopped = true; window.clearTimeout(timer);
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", changed);
    };
  }, [refreshWallet]);

  async function run(id: Busy, action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(id); setError(""); setMessage("");
    try {await action();}
    catch (cause) {setError(walletErrorMessage(cause, "Could not complete this step."));}
    finally {working.current = false; setBusy("");}
  }
  function persist(next: V5Progress) {save(next); setProgress(next);}
  async function connect() {
    await run("connect", async () => {
      const provider = getInjectedProvider();
      if (!provider) throw new Error("Open this page in your EVM wallet browser.");
      await provider.request({method: "eth_requestAccounts"});
      await provider.request({method: "wallet_switchEthereumChain", params: [{chainId: CHAIN}]});
      await refreshWallet();
      await guardedProvider();
    });
  }
  async function submit(id: V5StepId) {
    await run(id, async () => {
      if (!v5StepReady(id, verified)) throw new Error("Verify all earlier steps first.");
      if (progress[id]?.hash) throw new Error("A transaction is already saved. Check its receipt before submitting again.");
      save(progress); // Check that durable browser storage works before requesting a signature.
      const provider = await guardedProvider();
      const transaction = buildV5Transaction(id, progress, CONFIG, DEPLOY_BYTECODE);
      const estimate = await provider.request<Hex>({method: "eth_estimateGas", params: [transaction]});
      // Robinhood Chain can consume materially more gas for contract creation than eth_estimateGas reports.
      // Use a larger deployment buffer so large V5 factories do not fail by exhausting the exact gas limit.
      const estimatedGas = BigInt(estimate);
      const deployStep = !transaction.to;
      const bufferedGas = deployStep ? estimatedGas * 250n / 100n : estimatedGas * 150n / 100n;
      const minimumDeployGas = 3_000_000n;
      const gasLimit = deployStep && bufferedGas < minimumDeployGas ? minimumDeployGas : bufferedGas;
      const gas = ("0x" + gasLimit.toString(16)) as Hex;
      const hash = await provider.request<Hex>({method: "eth_sendTransaction", params: [{...transaction, gas}]});
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Wallet returned an invalid transaction hash.");
      const next = {...progress, [id]: {hash}};
      setProgress(next);
      try {save(next);} catch {throw new Error("Transaction submitted: " + hash + ". Save this hash; browser storage is unavailable.");}
      setMessage("Transaction saved. Waiting for its receipt…");
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          const address = await verifyReceipt(provider, id, next);
          persist({...next, [id]: {hash, address}});
          setVerified(current => ({...current, [id]: true}));
          setMessage("Confirmed on-chain. Continue to the next step.");
          return;
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.startsWith("Transaction is pending.")) throw cause;
        }
        await new Promise(resolve => window.setTimeout(resolve, 1500));
      }
      setMessage("Transaction is still pending. Use Check receipt; its hash is saved.");
    });
  }
  async function verify(id: V5StepId) {
    await run(id, async () => {
      if (!v5StepReady(id, verified)) throw new Error("Verify all earlier steps first.");
      const provider = await guardedProvider();
      const address = await verifyReceipt(provider, id, progress);
      persist({...progress, [id]: {...progress[id]!, address}});
      setVerified(current => ({...current, [id]: true}));
      setMessage("Transaction and deployed contract verified.");
    });
  }
  async function restore() {
    await run("restore", async () => {
      const provider = await guardedProvider();
      let next = {...progress};
      const confirmed: Partial<Record<V5StepId, boolean>> = {};
      for (const {id} of V5_STEPS) {
        if (!next[id]?.hash) break;
        const address = await verifyReceipt(provider, id, next);
        next = {...next, [id]: {...next[id]!, address}};
        persist(next); confirmed[id] = true; setVerified({...confirmed});
      }
      setMessage("Saved receipts verified. Continue from the first unfinished step.");
    });
  }
  function importBackup() {
    try {
      const next = parseV5Progress(JSON.parse(backup));
      if (Object.keys(next).length === 0) throw new Error("The backup has no deployment transactions.");
      // Never overwrite existing submitted transactions with a different backup.
      for (const {id} of V5_STEPS) if (progress[id]?.hash && progress[id]?.hash !== next[id]?.hash) throw new Error("This browser already has a different transaction for " + id + ". Keep its backup and use a separate browser session for another deployment.");
      persist(next); setVerified({}); setBackup(""); setError(""); setLoaded(true);
      setMessage("Backup loaded. Check saved receipts before continuing.");
    } catch (cause) {setError(walletErrorMessage(cause, "Invalid backup."));}
  }
  async function retryReverted(id: V5StepId) {
    await run(id, async () => {
      const provider = await guardedProvider();
      const receipt = await provider.request<EthereumTransactionReceipt | null>({method: "eth_getTransactionReceipt", params: [progress[id]!.hash]});
      if (!receipt || BigInt(receipt.status || "0x1") !== 0n) throw new Error("Only a confirmed reverted transaction can be retried.");
      const next = {...progress}; delete next[id]; persist(next);
      setVerified(current => ({...current, [id]: false})); setMessage("Reverted transaction cleared. This step can be retried.");
    });
  }

  const authorized = account.toLowerCase() === OWNER.toLowerCase() && chain.toLowerCase() === CHAIN;
  const complete = V5_STEPS.every(({id}) => verified[id]);
  const completed = V5_STEPS.filter(({id}) => verified[id]).length;
  const configuration = complete ? {
    ROUTY_REWARD_CONTROLLER_V5_ADDRESS: progress.controller!.address!,
    ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS: progress.routerFactory!.address!,
    ROUTY_SWAP_EXECUTOR_V5_ADDRESS: progress.executor!.address!,
    ROUTY_LAUNCHER_V5_ADDRESS: progress.launcher!.address!,
    ROUTY_REWARD_DISTRIBUTOR_FACTORY_V5_ADDRESS: progress.rewardFactory!.address!,
    ROUTY_ASSET_VAULT_FACTORY_V5_ADDRESS: progress.vaultFactory!.address!,
  } : null;
  const envText = configuration ? Object.entries(configuration).map(([key, address]) => key + "=" + address).join("\n") : "";
  const backupText = JSON.stringify({version: 1, chainId: 4663, owner: OWNER, steps: progress}, null, 2);
  async function copy(text: string) {
    await run("restore", async () => {await navigator.clipboard.writeText(text); setMessage("Copied.");});
  }

  return <main className="shell"><Nav/><div className="wrap console-page">
    <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Routy deployment</span><h1>Activate direct fee routing.</h1><p className="lead">Deploy V5 from your wallet. Pons fees go directly to each route’s FeeRouter. Each transaction is saved so you can resume after closing this page.</p></div><a className="secondary" href="/deploy/release">Release status →</a></header>
    <div className="proof-grid">
      <article className="proof-card"><span className="micro">PRODUCTION</span><strong>{live ? live.generation?.toUpperCase() || "Unknown" : "Checking…"}</strong><p>{live?.launchReady ? "Direct fee launches activated" : "V5 activation pending"}</p></article>
      <article className="proof-card"><span className="micro">DEPLOYMENT</span><strong>{completed}/{V5_STEPS.length}</strong><p>Receipts verified in this session</p></article>
    </div>
    <section className="section"><div className="section-head"><div><span className="micro">WALLET</span><h2>Deployment wallet.</h2></div></div><div className="form-card">
      <p>Use <code style={{overflowWrap: "anywhere"}}>{OWNER}</code> on Robinhood Chain (4663).</p>
      <p className="muted">Connected: <code style={{overflowWrap: "anywhere"}}>{account || "Not connected"}</code></p>
      <button className="primary" disabled={Boolean(busy)} onClick={() => void connect()}>{authorized ? "Refresh wallet" : "Connect wallet and switch network"}</button>
      {Object.keys(progress).length > 0 && <button className="secondary" disabled={!authorized || Boolean(busy)} onClick={() => void restore()}>Check saved receipts</button>}
    </div></section>
    {message && <div className="notice" role="status">{message}</div>}
    {error && <div className="notice danger" role="alert">{error}</div>}
    <section className="section"><div className="section-head"><div><span className="micro">V5 CONTRACTS</span><h2>Deploy and connect.</h2></div><p className="section-copy">Approve each wallet transaction. Progress is verified against its sender, destination, constructor data and receipt.</p></div>
      {V5_STEPS.map((step, index) => {
        const record = progress[step.id];
        const ready = v5StepReady(step.id, verified);
        return <div className="form-card" key={step.id} style={{marginBottom: 8}}>
          <span className="micro">STEP {index + 1}</span><h3>{step.title}</h3>
          {record?.address && <code style={{overflowWrap: "anywhere"}}>{record.address}</code>}
          {record?.hash && <a className="secondary" href={"https://robinhoodchain.blockscout.com/tx/" + record.hash} target="_blank" rel="noreferrer">View transaction ↗</a>}
          {verified[step.id] ? <span className="pill">Verified</span> : record?.hash
            ? <><button className="primary" disabled={Boolean(busy) || !authorized || !ready} onClick={() => void verify(step.id)}>Check receipt</button><button className="secondary" disabled={Boolean(busy) || !authorized || !ready} onClick={() => void retryReverted(step.id)}>Retry reverted transaction</button></>
            : <button className="primary" disabled={!loaded || Boolean(busy) || !authorized || !ready} onClick={() => void submit(step.id)}>{busy === step.id ? "Waiting for wallet or confirmation…" : ready ? "Submit transaction" : "Complete earlier steps"}</button>}
        </div>;
      })}
    </section>
    {complete && <section className="section"><div className="section-head"><div><span className="micro">CONFIGURATION</span><h2>Verified V5 addresses.</h2></div></div><div className="form-card">
      <p>All deployment receipts are verified. Add these addresses to Vercel and redeploy. The first four are required together for runtime. Include the two factory addresses for the readiness report.</p>
      <label>Vercel environment variables<textarea readOnly rows={8} value={envText}/></label>
      <button className="primary" disabled={Boolean(busy)} onClick={() => void copy(envText)}>Copy Vercel env</button>
    </div></section>}
    <section className="section"><div className="section-head"><div><span className="micro">RESUME</span><h2>Deployment backup.</h2></div></div><div className="form-card">
      <p>Keep a copy before changing devices or browsers. The backup contains transaction hashes and contract addresses.</p>
      <label>Current progress<textarea readOnly rows={6} value={backupText}/></label>
      <button className="secondary" disabled={Boolean(busy) || !Object.keys(progress).length} onClick={() => void copy(backupText)}>Copy deployment backup</button>
      <label>Restore a backup<textarea rows={4} value={backup} onChange={event => setBackup(event.target.value)} placeholder="Paste deployment backup JSON"/></label>
      <button className="secondary" disabled={Boolean(busy) || !backup.trim()} onClick={importBackup}>Load backup</button>
    </div></section>
  </div></main>;
}
