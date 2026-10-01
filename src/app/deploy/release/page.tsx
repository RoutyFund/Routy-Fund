"use client";

import {useCallback,useEffect,useState} from "react";
import Nav from "@/components/Nav";

type ReadinessResponse={
 infrastructureReady?:boolean;
 blockers?:string[];
};
type RouteStatusRow={symbol?:string;configurationComplete?:boolean};
type RouteStatusResponse={routes?:RouteStatusRow[]};
type PoolStatusRow={symbol?:string;poolKeyMatches?:boolean};
type PoolStatusResponse={routes?:PoolStatusRow[]};
type ConfigResponse={routy?:{swapExecutionEnabled?:boolean}};
type HealthResponse={protocolConfigured?:boolean};
type Data={
 readiness:ReadinessResponse;
 routes:RouteStatusResponse;
 pool:PoolStatusResponse;
 config:ConfigResponse;
 health:HealthResponse;
};

export default function ReleasePage(){
 const[data,setData]=useState<Data|null>(null);
 const[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setError("");
  try{
   const [readiness,routes,pool,config,health]=await Promise.all([
    fetch("/api/readiness",{cache:"no-store"}).then(r=>r.json() as Promise<ReadinessResponse>),
    fetch("/api/route-status",{cache:"no-store"}).then(r=>r.json() as Promise<RouteStatusResponse>),
    fetch("/api/route-readiness",{cache:"no-store"}).then(r=>r.json() as Promise<PoolStatusResponse>),
    fetch("/api/config",{cache:"no-store"}).then(r=>r.json() as Promise<ConfigResponse>),
    fetch("/api/health",{cache:"no-store"}).then(r=>r.json() as Promise<HealthResponse>),
   ]);
   setData({readiness,routes,pool,config,health});
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load release status.")}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);

 const routeRows=data?.routes.routes??[];
 const readyRoutes=routeRows.filter(r=>r.configurationComplete===true).length;
 const poolRows=data?.pool.routes??[];
 const matchedPools=poolRows.filter(r=>r.poolKeyMatches===true).length;
 const infra=data?.readiness.infrastructureReady===true;
 const protocol=data?.health.protocolConfigured===true;
 const swapEnabled=data?.config.routy?.swapExecutionEnabled===true;
 const allStatic=infra&&protocol&&readyRoutes===3&&matchedPools===3&&!swapEnabled;

 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Operator release console</span><h1>Release status.</h1><p className="lead">One screen for infrastructure, route setup, PoolKey verification and the final live-test gate.</p></div><button className="secondary" onClick={()=>void refresh()}>Refresh status</button></header>
  <div className="proof-grid">
   <article className="proof-card"><span className="micro">INFRASTRUCTURE</span><strong>{infra?"Ready":"Blocked"}</strong><p>Environment + deployment checks</p></article>
   <article className="proof-card"><span className="micro">ROUTES</span><strong>{readyRoutes}/3</strong><p>AAPL · TSLA · NVDA configured</p></article>
   <article className="proof-card"><span className="micro">POOLKEYS</span><strong>{matchedPools}/3</strong><p>Verified route hashes matched</p></article>
   <article className="proof-card"><span className="micro">SWAP EXECUTION</span><strong>{swapEnabled?"Enabled":"Paused"}</strong><p>{swapEnabled?"Live execution flag is on":"Safe pre-test state"}</p></article>
  </div>
  <section className="section">
   <div className="section-head"><div><span className="micro">FINAL CHECKLIST</span><h2>Everything before live test.</h2></div><p className="section-copy">This console never signs transactions. It only reports state and links to explicit owner or user steps.</p></div>
   <div className="flow">
    <div className="flow-step"><span>01</span><div><b>Route setup</b><p>{readyRoutes===3?"All verified routes configured.":"Finish missing AssetRegistry/oracle setup."}</p><a href="/deploy/route">Open route setup →</a></div></div>
    <div className="flow-step"><span>02</span><div><b>Launch</b><p>Launch a real Pons V2 token using a Ready market.</p><a href="/launch">Open launch →</a></div></div>
    <div className="flow-step"><span>03</span><div><b>Provision</b><p>Create the Routy vault/router and attach the verified PoolKey.</p><a href="/deploy/provision">Open provisioning →</a></div></div>
    <div className="flow-step"><span>04</span><div><b>Preflight</b><p>Verify vault, PoolKey, executor state and available earned quote.</p><a href="/deploy/test">Open preflight →</a></div></div>
   </div>
  </section>
  {allStatic&&<div className="notice">Static release checks are green. The remaining gate is the real-token constrained live test; SwapExecutor is still paused.</div>}
  {(data?.readiness.blockers?.length??0)>0&&<div className="notice danger">Blockers: {data?.readiness.blockers?.join(" · ")}</div>}
  {error&&<div className="notice danger">{error}</div>}
 </div></main>
}
