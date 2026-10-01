"use client";
import {useEffect,useMemo,useState} from "react";
import {decodeFunctionResult,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import Nav from "@/components/Nav";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {getInjectedProvider,type EthereumProvider} from "@/lib/ethereum-provider";

const ZERO="0x0000000000000000000000000000000000000000" as Address;
const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},{name:"vault",type:"address"},{name:"router",type:"address"},{name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}]}] as const;
const vaultAbi=[{type:"function",name:"availableEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}] as const;
const executorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"approvedVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{type:"bool"}]},
 {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]},
] as const;

async function call(provider:EthereumProvider,to:Address,data:Hex){return provider.request<Hex>({method:"eth_call",params:[{to,data},"latest"]})}

export default function LiveTestPage(){
 const[token,setToken]=useState("");const[status,setStatus]=useState<any>(null);const[error,setError]=useState("");
 const ready=useMemo(()=>Boolean(status?.tokenValid&&status?.routeMatched&&status?.vaultApproved&&status?.poolKeyMatched&&status?.executorPaused),[status]);
 async function inspect(){
  setError("");setStatus(null);const p=getInjectedProvider();if(!p)return setError("Connect an EVM wallet browser first.");if(!isAddress(token))return setError("Enter a valid launched token address.");
  try{
   const routeRaw=await call(p,ROUTY_DEPLOYMENT.protocolLauncher,encodeFunctionData({abi:launcherAbi,functionName:"routes",args:[token as Address]}));
   const d=decodeFunctionResult({abi:launcherAbi,functionName:"routes",data:routeRaw}) as readonly [Address,Address,Address,Address,Address,number,bigint];
   const route={creator:d[0],targetAsset:d[1],quoteToken:d[2],vault:d[3],router:d[4],policy:d[5],createdAt:d[6]};
   const matched=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===route.targetAsset.toLowerCase());
   if(route.vault===ZERO||!matched){setStatus({tokenValid:false,routeMatched:Boolean(matched),executorPaused:true});return}
   const [pausedRaw,approvedRaw,poolRaw,earnedRaw]=await Promise.all([
    call(p,ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"paused"})),
    call(p,ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"approvedVault",args:[route.vault]})),
    call(p,ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"poolKeyForVault",args:[route.vault]})),
    call(p,route.vault,encodeFunctionData({abi:vaultAbi,functionName:"availableEarned"})),
   ]);
   const paused=decodeFunctionResult({abi:executorAbi,functionName:"paused",data:pausedRaw});
   const approved=decodeFunctionResult({abi:executorAbi,functionName:"approvedVault",data:approvedRaw});
   const key=decodeFunctionResult({abi:executorAbi,functionName:"poolKeyForVault",data:poolRaw}) as readonly [Address,Address,number,number,Address];
   const earned=decodeFunctionResult({abi:vaultAbi,functionName:"availableEarned",data:earnedRaw}) as bigint;
   const poolKeyMatched=key[0].toLowerCase()===matched.poolKey.currency0.toLowerCase()&&key[1].toLowerCase()===matched.poolKey.currency1.toLowerCase()&&Number(key[2])===matched.poolKey.fee&&Number(key[3])===matched.poolKey.tickSpacing&&key[4].toLowerCase()===matched.poolKey.hooks.toLowerCase();
   setStatus({tokenValid:true,routeMatched:true,symbol:matched.symbol,vault:route.vault,router:route.router,vaultApproved:Boolean(approved),poolKeyMatched,executorPaused:Boolean(paused),availableEarned:earned.toString()});
  }catch(e){setError(e instanceof Error?e.message:"Could not inspect live-test readiness.")}
 }
 useEffect(()=>{const q=new URLSearchParams(window.location.search);const t=q.get("token");if(t&&isAddress(t))setToken(t)},[]);
 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Final validation</span><h1>Live-test readiness.</h1><p className="lead">Read-only checks for a provisioned Routy token. This page does not unpause SwapExecutor or execute a swap.</p></div><span className="pill">Safe preflight</span></header>
  <section className="form-card"><label>Provisioned token address<input value={token} onChange={e=>setToken(e.target.value)} placeholder="0x…"/></label><button className="primary" onClick={inspect} disabled={!isAddress(token)}>Run readiness check</button>
   {status&&<div className="proof-grid" style={{marginTop:8}}>
    <article className="proof-card"><span className="micro">ROUTE</span><strong>{status.routeMatched?status.symbol||"Matched":"Missing"}</strong><p>{status.tokenValid?"Provisioned route found":"No provisioned route"}</p></article>
    <article className="proof-card"><span className="micro">VAULT</span><strong>{status.vaultApproved?"Approved":"Pending"}</strong><p>{status.vault?status.vault.slice(0,10)+"…":"No vault"}</p></article>
    <article className="proof-card"><span className="micro">POOLKEY</span><strong>{status.poolKeyMatched?"Matched":"Pending"}</strong><p>Must match the verified market route</p></article>
    <article className="proof-card"><span className="micro">EXECUTOR</span><strong>{status.executorPaused?"Paused":"Active"}</strong><p>Should remain paused until the final test window</p></article>
   </div>}
   {status?.availableEarned!==undefined&&<div className="notice">Available earned quote in vault: <code>{status.availableEarned}</code> raw units.</div>}
   {ready&&<div className="notice">Preflight passed. The route is structurally ready for a constrained live test, while SwapExecutor is still paused.</div>}
   {status&&!ready&&<div className="notice danger">Preflight is not complete. Resolve the pending item before any live swap test.</div>}
   {error&&<div className="notice danger">{error}</div>}
  </section>
 </div></main>