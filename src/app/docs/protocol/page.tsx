import Nav from "@/components/Nav";
export default function ProtocolDocs(){return <main className="shell"><Nav/><div className="wrap console-page">
<header className="page-head"><div className="page-head-copy"><span className="eyebrow">Docs / protocol</span><h1>Protocol.</h1><p className="lead">How Routy Fund connects token launches, fee routing, Stock Token acquisition and community rewards.</p></div><a className="secondary" href="/docs">← Docs</a></header>
<section className="section"><div className="terminal-doc-article">
<h2 id="launch">Launch & provisioning</h2><p>Tokens are launched through the configured Pons V2 factory. Routy does not custody creator wallets or private keys. After launch, the creator provisions a Routy route against one verified target market.</p>
<h2>Verified markets</h2><p>Current production routes are AAPL/USDG, TSLA/USDG and NVDA/USDG. Each route is tied to an approved AssetRegistry entry, oracle configuration and a verified PoolKey.</p>
<h2>Fee routing</h2><p>Routy separates routed creator-fee flow between the asset-vault path and protocol treasury according to the configured protocol split. The current interface displays the 80/20 allocation used by the deployed system.</p>
<h2>Execution controls</h2><p>Value-moving execution is guarded by registry checks, oracle feeds, deviation controls, verified PoolKey data and a pausable SwapExecutor. The executor remains paused until final production validation is completed.</p>
<h2 id="rewards">Reward policies</h2><p>Each route selects one reward mode: weighted raffle, equal lottery or pro-rata. Reward data is only displayed once a corresponding verified onchain state or event exists.</p>
<h2>Data policy</h2><p>Routy intentionally avoids fabricated market cap, volume, fee, reward or claim balances. Empty or unavailable metrics remain blank until a reliable source exists.</p>
</div></section></div></main>}