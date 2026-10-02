"use client";
import {useEffect,useMemo,useState} from "react";
import Nav from "@/components/Nav";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

type Asset={id:string;tokenSymbol:string;tokenName:string;currentMultiplier?:string;logoUrl?:string;contractAddress?:string};
export default function Assets(){
 const[assets,setAssets]=useState<Asset[]>([]);const[loaded,setLoaded]=useState(false);const[query,setQuery]=useState("");const[mode,setMode]=useState<"all"|"routable"|"registry">("all");
 useEffect(()=>{fetch("/api/assets").then(r=>r.json()).then(d=>setAssets(d.assets||[])).catch(()=>setAssets([])).finally(()=>setLoaded(true))},[]);
 const rows=useMemo(()=>assets.filter(a=>{const routable=EXECUTABLE_ROUTES.some(r=>r.target.toLowerCase()===(a.contractAddress||"").toLowerCase());const q=query.trim().toLowerCase();const matches=!q||a.tokenSymbol?.toLowerCase().includes(q)||a.tokenName?.toLowerCase().includes(q)||a.contractAddress?.toLowerCase().includes(q);return matches&&(mode==="all"||(mode==="routable"?routable:!routable))}),[assets,query,mode]);
 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Underlying market registry</span><h1>Assets.</h1><p className="lead">Stock Tokens available on Robinhood Chain. This registry is separate from tokens launched through Routy Fund.</p></div><span className="pill">{loaded?assets.length+" canonical":"Loading registry"}</span></header>
  <section className="proof-grid">
   <article className="proof-card"><span className="micro">ROUTY MARKETS</span><strong>{EXECUTABLE_ROUTES.length}</strong><p>AAPL · TSLA · NVDA</p></article>
   <article className="proof-card"><span className="micro">REGISTRY</span><strong>{loaded?assets.length:"—"}</strong><p>Robinhood Chain Stock Tokens</p></article>
   <article className="proof-card"><span className="micro">QUOTE</span><strong>USDG</strong><p>Current Routy route pair</p></article>
   <article className="proof-card"><span className="micro">NETWORK</span><strong>4663</strong><p>Robinhood Chain</p></article>
  </section>
  <section className="section">
   <div className="section-head"><div><span className="micro">ROUTY MARKETS</span><h2>Verified routing targets.</h2></div><p className="section-copy">Only these markets are currently executable by Routy. Registry-only assets below are reference assets, not active Routy routes.</p></div>
   <div className="market-directory">{EXECUTABLE_ROUTES.map(r=><article key={r.symbol}><div className="market-icon">{assets.find(a=>a.contractAddress?.toLowerCase()===r.target.toLowerCase())?.logoUrl?<img src={"/api/company-logo?symbol="+r.symbol} alt={r.symbol+" logo"}/>:r.symbol[0]}</div><div><b>{r.symbol}</b><span>{r.name} · {r.quoteSymbol}</span></div><span className="pill">Routable</span></article>)}</div>
  </section>
  <section className="section">
   <div className="terminal-filterbar">
    <div className="terminal-search"><span>/</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search symbol, company or address"/></div>
    <div className="tabs"><button className={"tab "+(mode==="all"?"active":"")} onClick={()=>setMode("all")}>All</button><button className={"tab "+(mode==="routable"?"active":"")} onClick={()=>setMode("routable")}>Routable</button><button className={"tab "+(mode==="registry"?"active":"")} onClick={()=>setMode("registry")}>Registry only</button></div>
    <span className="terminal-count">{rows.length} RESULTS</span>
   </div>
   <div className="asset-terminal-head"><span>ASSET</span><span>CLASS</span><span>MULTIPLIER</span><span>ADDRESS</span><span>STATUS</span></div>
   <div className="data-list">{rows.slice(0,194).map(a=>{const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===(a.contractAddress||"").toLowerCase());return <article className="asset-terminal-row" key={a.id}>
    <div className="asset-terminal-name"><div className="asset-logo">{a.logoUrl&&a.contractAddress?<img src={"/api/company-logo?symbol="+a.tokenSymbol} alt={a.tokenSymbol+" logo"}/>:a.tokenSymbol?.[0]||"R"}</div><div><b>{a.tokenSymbol}</b><span>{a.tokenName}</span></div></div>
    <span>STOCK TOKEN</span><strong>{Number(a.currentMultiplier||1).toFixed(4)}</strong>
    <code title={a.contractAddress}>{a.contractAddress?a.contractAddress.slice(0,8)+"…"+a.contractAddress.slice(-6):"—"}</code>
    <span className={route?"terminal-ok":"terminal-registry"}>{route?"● ROUTABLE":"○ REGISTRY"}</span>
   </article>})}</div>
   {loaded&&!rows.length&&<div className="empty-state"><h3>No matching assets.</h3><p className="muted">Try another symbol, company name, address or filter.</p></div>}
  </section>
 </div></main>
}