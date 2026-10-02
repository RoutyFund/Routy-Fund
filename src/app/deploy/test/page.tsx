"use client";

import {useEffect,useState} from "react";
import {decodeFunctionResult,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import Nav from "@/components/Nav";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {getInjectedProvider,type EthereumProvider} from "@/lib/ethereum-provider";

const ZERO="0x0000000000000000000000000000000000000000" as Address;

const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[
 {name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},
 {name:"vault",type:"address"},{name:"router",type:"address"},{name:"distributor",type:"address"},{name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}
]}] as const;
const executorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"approvedVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{type:"bool"}]},
 {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[
  {name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}
 ]},
] as const;
const vaultAbi=[{type:"function",name:"availableEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}] as const;

type TestState={
 tokenValid:boolean;
 routeMatched:boolean;
 symbol:string;
 vault:Address;
 router:Address;
 vaultApproved:boolean;
 poolKeyMatched:boolean;
 executorPaused:boolean;
 availableEarned:string;
};

async function call(provider:EthereumProvider,to:Address,data:Hex){
 return provider.request<Hex>({method:"eth_call",params:[{to,data},"latest"]});
}

export default function LiveTestPage(){
 const[token,setToken]=useState("");
 const[state,setState]=useState<TestState|null>(null);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");

 async function inspect(){
  setError("");setState(null);
  const provider=getInjectedProvider();
  if(!provider){setError("Compatible EVM wallet not found.");return}
  if(!isAddress(token)){setError("Enter a valid provisioned token address.");return}
  setBusy(true);
  try{
   const routeRaw=await call(provider,ROUTY_DEPLOYMENT.protocolLauncherV2,encodeFunctionData({abi:launcherAbi,functionName:"routes",args:[token as Address]}));
   const route=decodeFunctionResult({abi:launcherAbi,functionName:"routes",data:routeRaw}) as readonly [Address,Address,Address,Address,Address,Address,number,bigint];
   const matched=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===route[1].toLowerCase());
   if(route[3]===ZERO||!matched){
    setState({tokenValid:false,routeMatched:Boolean(matched),symbol:matched?.symbol||"—",vault:route[3],router:route[4],vaultApproved:false,poolKeyMatched:false,executorPaused:true,availableEarned:"0"});
    return;
   }
   const [pausedRaw,approvedRaw,keyRaw,earnedRaw]=await Promise.all([
    call(provider,ROUTY_DEPLOYMENT.swapExecutorV2,encodeFunctionData({abi:executorAbi,functionName:"paused"})),
    call(provider,ROUTY_DEPLOYMENT.swapExecutorV2,encodeFunctionData({abi:executorAbi,functionName:"approvedVault",args:[route[3]]})),
    call(provider,ROUTY_DEPLOYMENT.swapExecutorV2,encodeFunctionData({abi:executorAbi,functionName:"poolKeyForVault",args:[route[3]]})),
    call(provider,route[3],encodeFunctionData({abi:vaultAbi,functionName:"availableEarned"})),
   ]);
   const paused=decodeFunctionResult({abi:executorAbi,functionName:"paused",data:pausedRaw});
   const approved=decodeFunctionResult({abi:executorAbi,functionName:"approvedVault",data:approvedRaw});
   const key=decodeFunctionResult({abi:executorAbi,functionName:"poolKeyForVault",data:keyRaw}) as readonly [Address,Address,number,number,Address];
   const earned=decodeFunctionResult({abi:vaultAbi,functionName:"availableEarned",data:earnedRaw}) as bigint;
   const poolKeyMatched=
    key[0].toLowerCase()===matched.poolKey.currency0.toLowerCase()&&
    key[1].toLowerCase()===matched.poolKey.currency1.toLowerCase()&&
    Number(key[2])===matched.poolKey.fee&&
    Number(key[3])===matched.poolKey.tickSpacing&&
    key[4].toLowerCase()===matched.poolKey.hooks.toLowerCase();
   setState({
    tokenValid:true,routeMatched:true,symbol:matched.symbol,vault:route[3],router:route[4],
    vaultApproved:Boolean(approved),poolKeyMatched,executorPaused:Boolean(paused),availableEarned:earned.toString()
   });
  }catch(cause){
   setError(cause instanceof Error?cause.message:"Could not inspect route readiness.");
  }finally{setBusy(false)}
 }

 useEffect(()=>{const id=window.setTimeout(()=>{const q=new URLSearchParams(window.location.search);const t=q.get("token");if(t&&isAddress(t))setToken(t)},0);return()=>window.clearTimeout(id)},[]);
 useEffect(()=>{if(isAddress(token)&&new URLSearchParams(window.location.search).get("token")===token){const id=window.setTimeout(()=>inspect(),250);return()=>window.clearTimeout(id)}},[token]);
 const ready=Boolean(state?.tokenValid&&state.routeMatched&&state.vaultApproved&&state.poolKeyMatched&&state.executorPaused);

 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Final validation</span><h1>Live-test readiness.</h1><p className="lead">Run read-only onchain checks before the final constrained swap test. This page never unpauses the executor and never sends a swap.</p></div><span className="pill">Safe preflight</span></header>
  <section className="form-card">
   <label>Provisioned token address<input value={token} onChange={e=>{setToken(e.target.value);setState(null)}} placeholder="0x…"/></label>
   <button className="primary" disabled={!isAddress(token)||busy} onClick={inspect}>{busy?"Checking…":"Run onchain preflight"}</button>
   {state&&<div className="proof-grid" style={{marginTop:8}}>
    <article className="proof-card"><span className="micro">ROUTE</span><strong>{state.routeMatched?state.symbol:"Missing"}</strong><p>{state.tokenValid?"Provisioned route found":"No provisioned vault"}</p></article>
    <article className="proof-card"><span className="micro">VAULT</span><strong>{state.vaultApproved?"Approved":"Pending"}</strong><p>{state.vault===ZERO?"No vault":state.vault.slice(0,10)+"…"}</p></article>
    <article className="proof-card"><span className="micro">POOLKEY</span><strong>{state.poolKeyMatched?"Matched":"Pending"}</strong><p>Must equal the verified market route</p></article>
    <article className="proof-card"><span className="micro">EXECUTOR</span><strong>{state.executorPaused?"Paused":"Active"}</strong><p>Should stay paused before the test window</p></article>
   </div>}
   {state&&<div className="notice"><p>Available earned quote: <code>{state.availableEarned}</code> raw units.</p>{state.vault!==ZERO&&<p>Vault: <a target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/address/"+state.vault}><code>{state.vault}</code> ↗</a></p>}{state.router!==ZERO&&<p>Router: <a target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/address/"+state.router}><code>{state.router}</code> ↗</a></p>}</div>}
   {ready&&<div className="notice">Preflight passed. The route is structurally ready for a constrained live test while SwapExecutor remains paused.</div>}
   {state&&!ready&&<div className="notice danger">Preflight is incomplete. Resolve the pending item before any live swap test.</div>}
   {error&&<div className="notice danger">{error}</div>}
   <a className="secondary" href="/deploy/release">Back to release status →</a>
  </section>
 </div></main>
}