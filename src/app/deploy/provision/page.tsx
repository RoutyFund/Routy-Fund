"use client";

import { useEffect, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import Nav from "@/components/Nav";
import { ROUTY_DEPLOYMENT } from "@/lib/deployment";
import { FIRST_PRODUCTION_ROUTE } from "@/lib/production-route";
import { getInjectedProvider, type EthereumProvider, type EthereumTransactionReceipt, walletErrorMessage } from "@/lib/ethereum-provider";

const CHAIN_ID = "0x1237";
const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const launcherAbi = [
  {type:"function",name:"provision",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"},{name:"asset",type:"address"},{name:"policy",type:"uint8"}],outputs:[{name:"vault",type:"address"},{name:"router",type:"address"}]},
  {type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},{name:"vault",type:"address"},{name:"router",type:"address"},{name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}]},
] as const;
const executorAbi = [
  {type:"function",name:"setPoolKey",stateMutability:"nonpayable",inputs:[{name:"vault",type:"address"},{name:"key",type:"tuple",components:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]}],outputs:[]},
  {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]},
] as const;

type Route = {creator:Address;targetAsset:Address;quoteToken:Address;vault:Address;router:Address;policy:number;createdAt:bigint};

async function call(provider:EthereumProvider,to:Address,data:Hex){return provider.request<Hex>({method:"eth_call",params:[{to,data},"latest"]})}
async function receipt(provider:EthereumProvider,hash:Hex){for(let i=0;i<40;i++){const r=await provider.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[hash]});if(r)return r;await new Promise(x=>setTimeout(x,1500))}return null}

export default function ProvisionPage(){
 const[token,setToken]=useState("");const[policy,setPolicy]=useState(0);const[account,setAccount]=useState("");const[chain,setChain]=useState("");const[route,setRoute]=useState<Route|null>(null);const[poolSet,setPoolSet]=useState(false);const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");const[error,setError]=useState("");
 const correctChain=chain.toLowerCase()===CHAIN_ID;const owner=account.toLowerCase()==="0x866d5d863381efe9e10ccb2e44f388611f781212";
 async function wallet(){const p=getInjectedProvider();if(!p)return;const[a,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChain(c||"")}
 async function connect(){const p=getInjectedProvider();if(!p)return setError("Compatible EVM wallet not found.");try{await p.request({method:"eth_requestAccounts"});await wallet()}catch(e){setError(walletErrorMessage(e,"Wallet connection failed."))}}
 async function readRoute(){const p=getInjectedProvider();if(!p||!isAddress(token))return setRoute(null);const raw=await call(p,ROUTY_DEPLOYMENT.protocolLauncher,encodeFunctionData({abi:launcherAbi,functionName:"routes",args:[token as Address]}));const d=decodeFunctionResult({abi:launcherAbi,functionName:"routes",data:raw}) as readonly [Address,Address,Address,Address,Address,number,bigint];const next={creator:d[0],targetAsset:d[1],quoteToken:d[2],vault:d[3],router:d[4],policy:d[5],createdAt:d[6]};setRoute(next);if(next.vault!==ZERO){const pk=await call(p,ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"poolKeyForVault",args:[next.vault]}));const k=decodeFunctionResult({abi:executorAbi,functionName:"poolKeyForVault",data:pk}) as readonly [Address,Address,number,number,Address];setPoolSet(k[0].toLowerCase()===FIRST_PRODUCTION_ROUTE.poolKey.currency0.toLowerCase()&&k[1].toLowerCase()===FIRST_PRODUCTION_ROUTE.poolKey.currency1.toLowerCase()&&Number(k[2])===FIRST_PRODUCTION_ROUTE.poolKey.fee&&Number(k[3])===FIRST_PRODUCTION_ROUTE.poolKey.tickSpacing&&k[4]===ZERO)}}
 async function send(label:string,to:Address,data:Hex){const p=getInjectedProvider();if(!p||!account||!correctChain)return setError("Connect wallet on Robinhood Chain first.");setBusy(label);setError("");try{const h=await p.request<Hex>({method:"eth_sendTransaction",params:[{from:account,to,data,value:"0x0"}]});setMsg(label+" submitted. Waiting for confirmation…");const r=await receipt(p,h);if(!r||(r.status!=="0x1"&&r.status!=="0x01"))throw new Error(label+" failed on-chain.");await readRoute();setMsg(label+" confirmed and verified.")}catch(e){setError(walletErrorMessage(e,label+" failed."))}finally{setBusy("")}}
 useEffect(()=>{const t=setTimeout(()=>wallet().catch(()=>{}),0);return()=>clearTimeout(t)},[]);
 const provisioned=Boolean(route&&route.vault!==ZERO);
 return <main className="shell"><Nav/><div className="wrap"><span className="kicker">Routy provisioning</span><h1 style={{fontSize:56}}>Provision the first live route.</h1><p className="muted">Use this only after a real Pons token is launched with USDG as pair token. The Pons creator fee recipient must submit provisioning.</p>
 <section className="form-card"><label>Pons token address<input value={token} onChange={e=>{setToken(e.target.value);setRoute(null);setPoolSet(false)}} placeholder="0x…"/></label><label>Reward policy<select value={policy} onChange={e=>setPolicy(Number(e.target.value))}><option value={0}>Weighted raffle</option><option value={1}>Equal lottery</option><option value={2}>Pro-rata</option></select></label>
 {!account?<button className="primary" onClick={connect}>Connect wallet</button>:<p>Connected: <b>{account}</b> · chain {chain?parseInt(chain,16):"—"}</p>}
 <button className="secondary" disabled={!isAddress(token)} onClick={()=>readRoute().catch(e=>setError(walletErrorMessage(e,"Could not read route.")))}>Check token</button>
 {!provisioned&&<button className="primary" disabled={!isAddress(token)||!account||!correctChain||Boolean(busy)} onClick={()=>send("Provision Routy vault",ROUTY_DEPLOYMENT.protocolLauncher,encodeFunctionData({abi:launcherAbi,functionName:"provision",args:[token as Address,FIRST_PRODUCTION_ROUTE.target,policy]}))}>Provision AAPL route</button>}
 {provisioned&&<div className="notice"><p>Vault: <code>{route?.vault}</code></p><p>Router: <code>{route?.router}</code></p><p>Quote: <code>{route?.quoteToken}</code></p><p>PoolKey: <b>{poolSet?"Configured":"Pending owner configuration"}</b></p></div>}
 {provisioned&&!poolSet&&owner&&<button className="primary" disabled={Boolean(busy)} onClick={()=>send("Set verified AAPL/USDG PoolKey",ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"setPoolKey",args:[route!.vault,FIRST_PRODUCTION_ROUTE.poolKey]}))}>Set verified PoolKey</button>}
 {provisioned&&!poolSet&&!owner&&<div className="notice">Provisioning is complete. PoolKey configuration must be submitted by the SwapExecutor owner wallet.</div>}
 {poolSet&&<div className="notice">Vault and verified PoolKey are ready. Keep SwapExecutor paused until the constrained live swap test is performed.</div>}
 {msg&&<p className="notice">{msg}</p>}{error&&<p className="notice danger">{error}</p>}</section></div></main>
}
