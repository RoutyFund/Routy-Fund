"use client";
import {useMemo,useState} from "react";
import TokenLogo from "@/components/TokenLogo";
import DataNotice from "@/components/DataNotice";
import {useApiResource} from "@/lib/use-api-resource";
import Nav from "@/components/Nav";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

type Asset={id:string;tokenSymbol:string;tokenName:string;currentMultiplier?:string;logoUrl?:string;contractAddress?:string};
const EMPTY_ASSETS:Asset[]=[];
export default function Assets(){
 const resource=useApiResource<{assets:Asset[]}>("/api/assets");const assets=resource.data?.assets||EMPTY_ASSETS;const loaded=!resource.loading&&!resource.error;const[query,setQuery]=useState("");const[mode,setMode]=useState<"all"|"routable"|"registry">("all");const[page,setPage]=useState(1);const pageSize=10;

 const rows=useMemo(()=>assets.filter(a=>{const routable=EXECUTABLE_ROUTES.some(r=>r.target.toLowerCase()===(a.contractAddress||"").toLowerCase());const q=query.trim().toLowerCase();const matches=!q||a.tokenSymbol?.toLowerCase().includes(q)||a.tokenName?.toLowerCase().includes(q)||a.contractAddress?.toLowerCase().includes(q);return matches&&(mode==="all"||(mode==="routable"?routable:!routable))}),[assets,query,mode]);
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));const safePage=Math.min(page,totalPages);const pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize);
 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Underlying market registry</span><h1>Assets.</h1><p className="lead">Stock Tokens available on Robinhood Chain. This registry is separate from tokens launched through Routy Fund.</p></div><span className="pill">{loaded?assets.length+" canonical":"Loading registry"}</span></header><DataNotice error={resource.error} retry={resource.reload}/>
  <section className="proof-grid">
   <article className="proof-card"><span className="micro">ROUTY MARKETS</span><strong>{EXECUTABLE_ROUTES.length}</strong><p>{EXECUTABLE_ROUTES.map(r=>r.symbol).join(" · ")}</p></article>
   <article className="proof-card"><span className="micro">REGISTRY</span><strong>{loaded?assets.length:"—"}</strong><p>Robinhood Chain Stock Tokens</p></article>
   <article className="proof-card"><span className="micro">QUOTE</span><strong>USDG</strong><p>Current Routy route pair</p></article>
   <article className="proof-card"><span className="micro">NETWORK</span><strong>4663</strong><p>Robinhood Chain</p></article>
  </section>
  <section className="section">
   <div className="section-head"><div><span className="micro">ROUTY MARKETS</span><h2>Verified routing targets.</h2></div><p className="section-copy">Only these markets are currently executable by Routy. Registry-only assets below are reference assets, not active Routy routes.</p></div>
   <div className="market-directory">{EXECUTABLE_ROUTES.map(r=><article key={r.symbol}><div className="market-icon"><TokenLogo src={"/api/company-logo?symbol="+r.symbol} symbol={r.symbol} size={38}/></div><div><b>{r.symbol}</b><span>{r.name} · {r.quoteSymbol}</span></div><span className="pill">Routable</span></article>)}</div>
  </section>
  <section className="section">
   <div className="terminal-filterbar">
    <div className="terminal-search"><span>/</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Search symbol, company or address"/></div>
    <div className="tabs"><button className={"tab "+(mode==="all"?"active":"")} onClick={()=>{setMode("all");setPage(1)}}>All</button><button className={"tab "+(mode==="routable"?"active":"")} onClick={()=>{setMode("routable");setPage(1)}}>Routable</button><button className={"tab "+(mode==="registry"?"active":"")} onClick={()=>{setMode("registry");setPage(1)}}>Registry only</button></div>
    <span className="terminal-count">{rows.length} RESULTS</span>
   </div>
   <div className="asset-terminal-head"><span>ASSET</span><span>CLASS</span><span>MULTIPLIER</span><span>ADDRESS</span><span>STATUS</span></div>
   <div className="data-list">{pagedRows.map(a=>{const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===(a.contractAddress||"").toLowerCase());return <article className="asset-terminal-row" key={a.id}>
    <div className="asset-terminal-name"><div className="asset-logo">{a.logoUrl&&a.contractAddress?<TokenLogo src={"/api/company-logo?symbol="+encodeURIComponent(a.tokenSymbol)} symbol={a.tokenSymbol} size={38}/>:a.tokenSymbol?.[0]||"R"}</div><div><b>{a.tokenSymbol}</b><span>{a.tokenName}</span></div></div>
    <span>STOCK TOKEN</span><strong>{a.currentMultiplier&&Number.isFinite(Number(a.currentMultiplier))?Number(a.currentMultiplier).toFixed(4):"—"}</strong>
    <code title={a.contractAddress}>{a.contractAddress?a.contractAddress.slice(0,8)+"…"+a.contractAddress.slice(-6):"—"}</code>
    <span className={route?"terminal-ok":"terminal-registry"}>{route?"● ROUTABLE":"○ REGISTRY"}</span>
   </article>})}</div>
   {loaded&&!rows.length&&<div className="empty-state"><h3>No matching assets.</h3><p className="muted">Try another symbol, company name, address or filter.</p></div>}
   {loaded&&rows.length>0&&<div className="terminal-pagination"><span>{(safePage-1)*pageSize+1}-{Math.min(safePage*pageSize,rows.length)} OF {rows.length}</span><div><button className="tab" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← PREV</button><span>PAGE {safePage} / {totalPages}</span><button className="tab" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>NEXT →</button></div></div>}
  </section>
 </div></main>
}