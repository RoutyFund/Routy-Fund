"use client";

import {useEffect,useMemo,useState} from "react";
import {decodeFunctionResult,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import Nav from "@/components/Nav";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {getInjectedProvider,type EthereumProvider,type EthereumTransactionReceipt,walletErrorMessage} from "@/lib/ethereum-provider";

const CHAIN_ID="0x1237";
const ZERO="0x0000000000000000000000000000000000000000" as Address;
const OWNER="0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;

const launcherAbi=[
 {type:"function",name:"provision",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"},{name:"asset",type:"address"},{name:"policy",type:"uint8"}],outputs:[{name:"vault",type:"address"},{name:"router",type:"address"}]},
 {type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},{name:"vault",type:"address"},{name:"router",type:"address"},{name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}]},
] as const;
const executorAbi=[
 {type:"function",name:"setPoolKey",stateMutability:"nonpayable",inputs:[{name:"vault",type:"address"},{name:"key",type:"tuple",components:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]}],outputs:[]},
 {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]},
] as const;

type RouteState={creator:Address;targetAsset:Address;quoteToken:Address;vault:Address;router:Address;policy:number;createdAt:bigint};
type PonsLaunchState={exists:boolean;creatorFeeRecipient:Address;pairToken:Address};

async function call(provider:EthereumProvider,to:Address,data:Hex){return provider.request<Hex>({method:"eth_call",params:[{to,data},"latest"]})}
async function receipt(provider:EthereumProvider,hash:Hex){for(let i=0;i<40;i++){const r=await provider.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[hash]});if(r)return r;await new Promise(x=>setTimeout(x,1500))}return null}

export default function ProvisionPage(){
 const[token,setToken]=useState("");const[selectedSymbol,setSelectedSymbol]=useState(EXECUTABLE_ROUTES[0].symbol);const[policy,setPolicy]=useState(0);
 const[account,setAccount]=useState("");const[chain,setChain]=useState("");const[routeState,setRouteState]=useState<RouteState|null>(null);const[ponsLaunch,setPonsLaunch]=useState<PonsLaunchState|null>(null);const[poolSet,setPoolSet]=useState(false);
 const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");const[error,setError]=useState("");
 const selected=useMemo(()=>EXECUTABLE_ROUTES.find(r=>r.symbol===selectedSymbol)||EXECUTABLE_ROUTES[0],[selectedSymbol]);
 const correctChain=chain.toLowerCase()===CHAIN_ID;const owner=account.toLowerCase()===OWNER.toLowerCase();

 async function wallet(){const p=getInjectedProvider();if(!p)return;const[a,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChain(c||"")}
 async function connect(){const p=getInjectedProvider();if(!p)return setError("Compatible EVM wallet not found.");try{await p.request({method:"eth_requestAccounts"});await wallet();setError("")}catch(e){setError(walletErrorMessage(e,"Wallet connection failed."))}}
 async function switchChain(){const p=getInjectedProvider();if(!p)return;try{await p.request({method:"wallet_switchEthereumChain",params:[{chainId:CHAIN_ID}]});await wallet();setError("")}catch(e){setError(walletErrorMessage(e,"Could not switch to Robinhood Chain."))}}
 async function readPonsLaunch(){
  const p=getInjectedProvider();if(!p||!isAddress(token)){setPonsLaunch(null);return}
  const raw=await call(p,PONS_V2.factory,encodeFunctionData({abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token as Address]}));
  const launch=decodeFunctionResult({abi:factoryReadAbi,functionName:"getLaunchedToken",data:raw});
  setPonsLaunch({exists:Boolean(launch.exists),creatorFeeRecipient:launch.creatorFeeRecipient,pairToken:launch.pairToken});
 }
 async function readRoute(){
  const p=getInjectedProvider();if(!p||!isAddress(token)){setRouteState(null);setPonsLaunch(null);return}
  const raw=await call(p,ROUTY_DEPLOYMENT.protocolLauncher,encodeFunctionData({abi:launcherAbi,functionName:"routes",args:[token as Address]}));
  const d=decodeFunctionResult({abi:launcherAbi,functionName:"routes",data:raw}) as readonly [Address,Address,Address,Address,Address,number,bigint];
  const next={creator:d[0],targetAsset:d[1],quoteToken:d[2],vault:d[3],router:d[4],policy:d[5],createdAt:d[6]};setRouteState(next);
  if(next.targetAsset!==ZERO){const matched=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===next.targetAsset.toLowerCase());if(matched)setSelectedSymbol(matched.symbol)}
  if(next.vault!==ZERO){
   const pk=await call(p,ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"poolKeyForVault",args:[next.vault]}));
   const k=decodeFunctionResult({abi:executorAbi,functionName:"poolKeyForVault",data:pk}) as readonly [Address,Address,number,number,Address];
   const cfg=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===next.targetAsset.toLowerCase())||selected;
   setPoolSet(k[0].toLowerCase()===cfg.poolKey.currency0.toLowerCase()&&k[1].toLowerCase()===cfg.poolKey.currency1.toLowerCase()&&Number(k[2])===cfg.poolKey.fee&&Number(k[3])===cfg.poolKey.tickSpacing&&k[4].toLowerCase()===cfg.poolKey.hooks.toLowerCase());
  }else setPoolSet(false)
 }
 async function send(label:string,to:Address,data:Hex){
  const p=getInjectedProvider();if(!p||!account||!correctChain)return setError("Connect wallet on Robinhood Chain first.");
  setBusy(label);setError("");setMsg("");
  try{const h=await p.request<Hex>({method:"eth_sendTransaction",params:[{from:account,to,data,value:"0x0"}]});setMsg(label+" submitted. Waiting for confirmation…");const r=await receipt(p,h);if(!r||(r.status!=="0x1"&&r.status!=="0x01"))throw new Error(label+" failed on-chain.");await readRoute();setMsg(label+" confirmed and verified.")}catch(e){setError(walletErrorMessage(e,label+" failed."))}finally{setBusy("")}
 }

 useEffect(()=>{const t=setTimeout(()=>{wallet().catch(()=>{});const q=new URLSearchParams(window.location.search);const qt=q.get("token");const qa=q.get("asset");const qp=q.get("policy");if(qt&&isAddress(qt))setToken(qt);if(qa){const found=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===qa.toLowerCase()||r.symbol.toLowerCase()===qa.toLowerCase());if(found)setSelectedSymbol(found.symbol)}if(qp&&["0","1","2"].includes(qp))setPolicy(Number(qp))},0);return()=>clearTimeout(t)},[]);
 useEffect(()=>{if(isAddress(token)){readPonsLaunch().catch(()=>setPonsLaunch(null));readRoute().catch(()=>{})}},[token,selectedSymbol]);

 const provisioned=Boolean(routeState&&routeState.vault!==ZERO);
 const creatorMatches=Boolean(account&&routeState&&routeState.creator.toLowerCase()===account.toLowerCase());
 const ponsExists=Boolean(ponsLaunch?.exists);
 const feeRecipientMatches=Boolean(account&&ponsLaunch?.creatorFeeRecipient&&ponsLaunch.creatorFeeRecipient.toLowerCase()===account.toLowerCase());
 const pairMatches=Boolean(ponsLaunch?.pairToken&&ponsLaunch.pairToken.toLowerCase()===selected.quote.toLowerCase());
 const preflightReady=ponsExists&&feeRecipientMatches&&pairMatches;

 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Routy provisioning</span><h1>Finish the route.</h1><p className="lead">Provision a verified Stock Token route after a successful Pons launch, then attach the matching PoolKey.</p></div><span className="pill">Step 2</span></header>
  <div className="launch-form">
   <section className="form-card"><span className="micro">LAUNCHED TOKEN</span><h3>Provision vault</h3>
    <label>Pons token address<input value={token} onChange={e=>{setToken(e.target.value);setRouteState(null);setPoolSet(false)}} placeholder="0x…"/></label>
    <label>Stock Token target<select value={selectedSymbol} disabled={provisioned} onChange={e=>setSelectedSymbol(e.target.value)}>{EXECUTABLE_ROUTES.map(r=><option value={r.symbol} key={r.symbol}>{r.symbol} · {r.name}</option>)}</select></label>
    <label>Reward policy<select value={policy} disabled={provisioned} onChange={e=>setPolicy(Number(e.target.value))}><option value={0}>Weighted raffle</option><option value={1}>Equal lottery</option><option value={2}>Pro-rata</option></select></label>
    {!account?<button className="primary" onClick={connect}>Connect wallet</button>:!correctChain?<><div className="notice danger">Connected {account.slice(0,6)}…{account.slice(-4)} · Wrong network</div><button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button></>:<div className="notice">Connected {account.slice(0,6)}…{account.slice(-4)} · Robinhood Chain</div>}
    <button className="secondary" disabled={!isAddress(token)} onClick={()=>Promise.all([readPonsLaunch(),readRoute()]).catch(e=>setError(walletErrorMessage(e,"Could not verify token.")))}>Check token</button>
    {isAddress(token)&&<div className="route-summary"><div><span className="data-label">Pons token</span><b>{ponsExists?"Verified":"Not verified"}</b></div><div><span className="data-label">Fee recipient</span><b>{feeRecipientMatches?"Matches wallet":"Check wallet"}</b></div><div><span className="data-label">Pair token</span><b>{pairMatches?"USDG verified":"Wrong pair"}</b></div><div><span className="data-label">Preflight</span><b>{preflightReady?"Ready":"Blocked"}</b></div></div>}
    {isAddress(token)&&!preflightReady&&<div className="notice danger">Provisioning requires a real Pons V2 token, the connected wallet must be its creator fee recipient, and the Pons pair must be USDG.</div>}
    {!provisioned&&<button className="primary" disabled={!isAddress(token)||!account||!correctChain||!preflightReady||Boolean(busy)} onClick={()=>send("Provision Routy vault",ROUTY_DEPLOYMENT.protocolLauncher,encodeFunctionData({abi:launcherAbi,functionName:"provision",args:[token as Address,selected.target,policy]}))}>Provision {selected.symbol} route →</button>}
   </section>
   <section className="form-card"><span className="micro">ROUTE STATUS</span><h3>{selected.symbol} / USDG</h3>
    <div className="route-summary"><div><span className="data-label">Market</span><b>{selected.symbol}</b></div><div><span className="data-label">Policy</span><b>{["Weighted raffle","Equal lottery","Pro-rata"][routeState?.policy??policy]}</b></div><div><span className="data-label">Vault</span><b>{provisioned?"Created":"Pending"}</b></div><div><span className="data-label">PoolKey</span><b>{poolSet?"Configured":"Pending"}</b></div></div>
    {provisioned&&<div className="notice"><p>Vault: <a target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/address/"+routeState?.vault}><code>{routeState?.vault}</code> ↗</a></p><p>Router: <a target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/address/"+routeState?.router}><code>{routeState?.router}</code> ↗</a></p><p>Quote: <code>{routeState?.quoteToken}</code></p></div>}
    {provisioned&&!creatorMatches&&!owner&&<div className="notice">This route exists. Only the SwapExecutor owner can attach its verified PoolKey.</div>}
    {provisioned&&!poolSet&&owner&&<button className="primary" disabled={Boolean(busy)} onClick={()=>send("Set verified "+selected.symbol+"/USDG PoolKey",ROUTY_DEPLOYMENT.swapExecutor,encodeFunctionData({abi:executorAbi,functionName:"setPoolKey",args:[routeState!.vault,selected.poolKey]}))}>Set verified PoolKey →</button>}
    {poolSet&&<><div className="notice">Vault + verified PoolKey are ready. SwapExecutor remains paused until the final constrained live test.</div><a className="primary" href={"/deploy/test?token="+token}>Continue to live-test preflight →</a></>}
   </section>
  </div>
  {msg&&<p className="notice" style={{marginTop:16}}>{msg}</p>}{error&&<p className="notice danger" style={{marginTop:16}}>{error}</p>}
 </div></main>
}