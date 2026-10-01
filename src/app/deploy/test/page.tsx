"use client";

import {useState} from "react";
import {isAddress} from "viem";
import Nav from "@/components/Nav";

export default function LiveTestPage(){
 const[token,setToken]=useState("");
 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Final validation</span><h1>Live-test readiness.</h1><p className="lead">Use this page after a token has been launched and provisioned. SwapExecutor remains paused until the final constrained test.</p></div><span className="pill">Safe preflight</span></header>
  <section className="form-card">
   <label>Provisioned token address<input value={token} onChange={e=>setToken(e.target.value)} placeholder="0x…"/></label>
   <div className={isAddress(token)?"notice":"notice danger"}>{isAddress(token)?"Token address format is valid. Continue only after provisioning and PoolKey setup are complete.":"Enter a valid provisioned token address."}</div>
   <div className="route-summary">
    <div><span className="data-label">Route</span><b>Provisioned</b></div>
    <div><span className="data-label">PoolKey</span><b>Required</b></div>
    <div><span className="data-label">Executor</span><b>Paused</b></div>
    <div><span className="data-label">Live swap</span><b>Not started</b></div>
   </div>
   <p className="muted" style={{fontSize:12,margin:0}}>This console is intentionally read-only. It does not unpause SwapExecutor or send a swap transaction.</p>
  </section>
 </div></main>
}