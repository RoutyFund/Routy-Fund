"use client";

import {useCallback,useEffect,useState} from "react";
import Nav from "@/components/Nav";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {fetchJson} from "@/lib/fetch-json";

type ReadinessResponse={
 infrastructureReady?:boolean;
 blockers?:string[];
};
type RouteStatusRow={symbol?:string;configurationComplete?:boolean};
type RouteStatusResponse={routes?:RouteStatusRow[]};
type PoolStatusRow={symbol?:string;poolKeyMatches?:boolean};
type PoolStatusResponse={routes?:PoolStatusRow[]};
type ConfigResponse={routy?:{swapExecutionEnabled?:boolean;swapExecutorPaused?:boolean|null}};
type HealthResponse={protocolConfigured?:boolean;generation?:string};
type AutomationResponse={ok?:boolean;configurationReady?:boolean;automationEnabled?:boolean;keeperMatches?:boolean;keeperSecretConfigured?:boolean};
type Data={
 readiness:ReadinessResponse;
 routes:RouteStatusResponse;
 pool:PoolStatusResponse;
 config:ConfigResponse;
 health:HealthResponse;
 automation:AutomationResponse;
};

export default function ReleasePage(){
 const[data,setData]=useState<Data|null>(null);
 const[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setError("");
  setData(null);
  try{
   const [readiness,routes,pool,config,health,automation]=await Promise.all([
    fetchJson<ReadinessResponse>("/api/readiness"),
    fetchJson<RouteStatusResponse>("/api/route-status"),
    fetchJson<PoolStatusResponse>("/api/route-readiness"),
    fetchJson<ConfigResponse>("/api/config"),
    fetchJson<HealthResponse>("/api/health"),
    fetchJson<AutomationResponse>("/api/reward-automation/status"),
   ]);
   setData({readiness,routes,pool,config,health,automation});
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load release status.")}
 },[]);
 useEffect(()=>{const id=window.setTimeout(()=>{void refresh()},0);return()=>window.clearTimeout(id)},[refresh]);

 const routeRows=data?.routes.routes??[];
 const readyRoutes=routeRows.filter(r=>r.configurationComplete===true).length;
 const poolRows=data?.pool.routes??[];
 const matchedPools=poolRows.filter(r=>r.poolKeyMatches===true).length;
 const generation=data?.health.generation?.toUpperCase()||"Routy";
 const infra=data?.readiness.infrastructureReady===true;
 const protocol=data?.health.protocolConfigured===true;
 const swapEnabled=data?.config.routy?.swapExecutionEnabled===true;
 const loaded=Boolean(data);
 const totalRoutes=EXECUTABLE_ROUTES.length;
 const automationReady=data?.automation.ok===true&&data?.automation.configurationReady===true;
 const allStatic=infra&&protocol&&readyRoutes===totalRoutes&&matchedPools===totalRoutes;

 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Operator release console</span><h1>Release status.</h1><p className="lead">One screen for the active deployment, route setup, PoolKey verification and automation status.</p></div><button className="secondary" onClick={()=>void refresh()}>Refresh status</button></header>
  <div className="proof-grid">
   <article className="proof-card"><span className="micro">INFRASTRUCTURE</span><strong>{!loaded?"Checking…":infra?"Ready":"Blocked"}</strong><p>Environment + deployment checks</p></article>
   <article className="proof-card"><span className="micro">ROUTES</span><strong>{!loaded?"—":readyRoutes+"/"+totalRoutes}</strong><p>{EXECUTABLE_ROUTES.map(r=>r.symbol).join(" · ")} configured</p></article>
   <article className="proof-card"><span className="micro">POOLKEYS</span><strong>{!loaded?"—":matchedPools+"/"+totalRoutes}</strong><p>Verified route hashes matched</p></article>
   <article className="proof-card"><span className="micro">SWAP EXECUTION</span><strong>{!loaded?"Checking…":data?.config.routy?.swapExecutorPaused===null?"Unavailable":swapEnabled?"Enabled":"Paused"}</strong><p>Active on-chain SwapExecutor state</p></article><article className="proof-card"><span className="micro">REWARD AUTOMATION</span><strong>{!loaded?"Checking…":automationReady?"Configured":"Pending"}</strong><p>{automationReady?"Keeper + cron + swap worker configured":"Keeper/controller/worker check required"}</p></article>
  </div>
  <section className="section"><div className="section-head"><div><span className="micro">VERIFIED MARKETS</span><h2>Route-by-route status.</h2></div></div><div className="market-directory">{EXECUTABLE_ROUTES.map(({symbol})=>{const route=routeRows.find(r=>r.symbol===symbol);const pool=poolRows.find(r=>r.symbol===symbol);const ok=route?.configurationComplete===true&&pool?.poolKeyMatches===true;return <article key={symbol}><div className="market-icon">{symbol[0]}</div><div><b>{symbol}</b><span>{!loaded?"Checking…":ok?"Registry + oracle + PoolKey verified":"Action required"}</span></div><span className="pill">{!loaded?"Checking":ok?"Ready":"Pending"}</span></article>})}</div></section>
  <section className="section">
   <div className="section-head"><div><span className="micro">FINAL CHECKLIST</span><h2>Deployment and automation.</h2></div><p className="section-copy">This console never signs transactions. It only reports state and links to explicit owner or user steps.</p></div>
   <a className="secondary" href="/deploy/v5">Deploy direct fee routing →</a>
   <div className="flow">
    <div className="flow-step"><span>01</span><div><b>Route setup</b><p>{readyRoutes===totalRoutes?"All verified routes configured.":"Finish missing AssetRegistry/oracle setup."}</p><a href="/deploy/route">Open route setup →</a></div></div>
    <div className="flow-step"><span>02</span><div><b>Launch</b><p>Launch a real Pons V2 token using a Ready market.</p><a href="/launch">Open launch →</a></div></div>
    <div className="flow-step"><span>03</span><div><b>Auto provision</b><p>Queued launches are provisioned and matched to their verified PoolKey automatically.</p><a href="/explore">Inspect routed launches →</a></div></div>
    <div className="flow-step"><span>04</span><div><b>Automation status</b><p>Verify infrastructure, executor state and reward keeper alignment from this release console.</p><a href="/rewards">Open rewards →</a></div></div>
   </div>
  </section>
  {allStatic&&<div className="notice">{generation} infrastructure, route catalog and PoolKey checks are green. Runtime execution and reward automation status are reported separately above.</div>}
  {(data?.readiness.blockers?.length??0)>0&&<div className="notice danger">Blockers: {data?.readiness.blockers?.join(" · ")}</div>}
  {error&&<div className="notice danger">{error}</div>}
 </div></main>
}
