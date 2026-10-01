"use client";
import {useState} from "react";
import Nav from "@/components/Nav";
import {isAddress} from "viem";

export default function Launch(){
 const[token,setToken]=useState(""); const[policy,setPolicy]=useState("0");
 const ready=isAddress(token);
 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Launch on Routy</span><h1>Route your token.</h1><p className="lead">Connect a Pons-launched token to Routy, choose how its acquired Stock Tokens are distributed, and prepare an auditable route on Robinhood Chain.</p></div><span className="pill">AAPL route ready</span></header>
  <div className="launch-form">
   <section className="form-card">
    <div><span className="micro">TOKEN</span><h3 style={{marginTop:8}}>Pons launch</h3></div>
    <label>Token contract<input value={token} onChange={e=>setToken(e.target.value)} placeholder="0x…"/></label>
    <p className="muted" style={{fontSize:12,margin:0}}>Use the contract address of the token launched through Pons with USDG as its pair. Routy verifies eligibility onchain during provisioning.</p>
    <div className="notice">Token creation stays on Pons for now. Routy handles the routing layer without exposing oracle, PoolKey or executor setup in the public launch flow.</div>
   </section>
   <section className="form-card">
    <div><span className="micro">ROUTE</span><h3 style={{marginTop:8}}>Configure rewards</h3></div>
    <label>Target Stock Token<select disabled><option>AAPL · Apple</option></select></label>
    <label>Reward policy<select value={policy} onChange={e=>setPolicy(e.target.value)}><option value="0">Weighted raffle</option><option value="1">Equal lottery</option><option value="2">Pro-rata</option></select></label>
    <div className="route-summary"><div><span className="data-label">Pair</span><b>AAPL / USDG</b></div><div><span className="data-label">Network</span><b>Robinhood Chain</b></div></div>
    <a className={"primary"+(!ready?" disabled-link":"")} href={ready?"/deploy/provision":"#"} aria-disabled={!ready}>Continue to route setup <span>→</span></a>
    {!ready&&<span className="muted" style={{fontSize:11}}>Enter a valid token contract to continue.</span>}
   </section>
  </div>
  <section className="section"><div className="section-head"><div><span className="micro">WHAT HAPPENS NEXT</span><h2>Simple outside. Guarded underneath.</h2></div></div>
   <div className="flow"><div className="flow-step"><span>01</span><div><b>Verify</b><p>Routy checks the Pons token and creator route requirements.</p></div></div><div className="flow-step"><span>02</span><div><b>Provision</b><p>A dedicated vault and fee router are created for the launch.</p></div></div><div className="flow-step"><span>03</span><div><b>Route</b><p>Creator-fee flow is assigned to the verified Stock Token route.</p></div></div><div className="flow-step"><span>04</span><div><b>Reward</b><p>Acquired assets follow the selected community reward policy.</p></div></div></div>
  </section>
 </div></main>
}