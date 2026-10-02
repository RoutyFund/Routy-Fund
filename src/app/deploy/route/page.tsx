"use client";

import {useEffect,useState} from "react";
import {decodeFunctionResult,encodeFunctionData,type Address,type Hex} from "viem";
import Nav from "@/components/Nav";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {ROUTE_CATALOG} from "@/lib/route-catalog";
import {getInjectedProvider,type EthereumProvider,type EthereumTransactionReceipt,walletErrorMessage} from "@/lib/ethereum-provider";

const OWNER="0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const CHAIN_ID="0x1237";
const ZERO="0x0000000000000000000000000000000000000000" as Address;

const registryAbi=[
 {type:"function",name:"approved",stateMutability:"view",inputs:[{name:"asset",type:"address"}],outputs:[{type:"bool"}]},
 {type:"function",name:"setApproved",stateMutability:"nonpayable",inputs:[{name:"asset",type:"address"},{name:"ok",type:"bool"}],outputs:[]},
] as const;
const oracleAbi=[
 {type:"function",name:"feedForAsset",stateMutability:"view",inputs:[{name:"asset",type:"address"}],outputs:[{type:"address"}]},
 {type:"function",name:"setFeed",stateMutability:"nonpayable",inputs:[{name:"asset",type:"address"},{name:"feed",type:"address"}],outputs:[]},
] as const;

type RouteCheck={readyForOwnerConfiguration?:boolean;routes?:Array<{symbol:string;poolKeyMatches?:boolean}>};
type State={assetApproved:boolean;targetFeed:Address;quoteFeed:Address};

async function ethCall(provider:EthereumProvider,to:Address,data:Hex){
 return provider.request<Hex>({method:"eth_call",params:[{to,data},"latest"]});
}
async function waitForReceipt(provider:EthereumProvider,hash:Hex){
 for(let i=0;i<40;i++){const receipt=await provider.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[hash]});if(receipt)return receipt;await new Promise(r=>window.setTimeout(r,1500))}
 return null;
}

export default function ProductionRouteSetupPage(){
 const[selectedSymbol,setSelectedSymbol]=useState(ROUTE_CATALOG[0].symbol);
 const route=ROUTE_CATALOG.find(r=>r.symbol===selectedSymbol)||ROUTE_CATALOG[0];
 const[account,setAccount]=useState("");const[chainId,setChainId]=useState("");const[routeCheck,setRouteCheck]=useState<RouteCheck|null>(null);
 const[state,setState]=useState<State>({assetApproved:false,targetFeed:ZERO,quoteFeed:ZERO});
 const[busy,setBusy]=useState("");const[notice,setNotice]=useState("");const[error,setError]=useState("");

 const authorized=account.toLowerCase()===OWNER.toLowerCase();
 const correctChain=chainId.toLowerCase()===CHAIN_ID;
 const selectedCheck=routeCheck?.routes?.find(r=>r.symbol===route.symbol);
 const poolVerified=routeCheck?.readyForOwnerConfiguration===true&&selectedCheck?.poolKeyMatches===true;
 const targetFeedConfigured=state.targetFeed.toLowerCase()===route.targetFeed.toLowerCase();
 const quoteFeedConfigured=state.quoteFeed.toLowerCase()===route.quoteFeed.toLowerCase();
 const complete=poolVerified&&state.assetApproved&&targetFeedConfigured&&quoteFeedConfigured;

 async function refreshWallet(){const p=getInjectedProvider();if(!p)return;const[a,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChainId(c||"")}
 async function refreshState(){const p=getInjectedProvider();if(!p)return;
  const [approvedRaw,targetRaw,quoteRaw]=await Promise.all([
   ethCall(p,ROUTY_DEPLOYMENT.assetRegistry,encodeFunctionData({abi:registryAbi,functionName:"approved",args:[route.target]})),
   ethCall(p,ROUTY_DEPLOYMENT.oracleRegistry,encodeFunctionData({abi:oracleAbi,functionName:"feedForAsset",args:[route.target]})),
   ethCall(p,ROUTY_DEPLOYMENT.oracleRegistry,encodeFunctionData({abi:oracleAbi,functionName:"feedForAsset",args:[route.quote]})),
  ]);
  setState({
   assetApproved:decodeFunctionResult({abi:registryAbi,functionName:"approved",data:approvedRaw}),
   targetFeed:decodeFunctionResult({abi:oracleAbi,functionName:"feedForAsset",data:targetRaw}) as Address,
   quoteFeed:decodeFunctionResult({abi:oracleAbi,functionName:"feedForAsset",data:quoteRaw}) as Address,
  });
 }
 async function connect(){const p=getInjectedProvider();if(!p)return setError("Compatible injected EVM wallet not found.");try{await p.request({method:"eth_requestAccounts"});await refreshWallet();setError("")}catch(c){setError(walletErrorMessage(c,"Wallet connection failed."))}}
 async function switchChain(){const p=getInjectedProvider();if(!p)return;try{await p.request({method:"wallet_switchEthereumChain",params:[{chainId:CHAIN_ID}]});await refreshWallet();setError("")}catch(c){setError(walletErrorMessage(c,"Could not switch to Robinhood Chain."))}}
 async function send(label:string,to:Address,data:Hex){const p=getInjectedProvider();if(!p)return setError("Wallet provider not found.");if(!authorized||!correctChain||!poolVerified)return setError("Owner wallet, Robinhood Chain, and verified PoolKey are required.");
  setBusy(label);setError("");setNotice("");
  try{const hash=await p.request<Hex>({method:"eth_sendTransaction",params:[{from:OWNER,to,data,value:"0x0"}]});setNotice(label+" submitted. Waiting for confirmation…");const receipt=await waitForReceipt(p,hash);if(!receipt)return setNotice(label+" is still pending. Do not resend.");if(receipt.status!=="0x1"&&receipt.status!=="0x01")throw new Error(label+" failed on-chain.");await refreshState();setNotice(label+" confirmed and verified on-chain.")}catch(c){setError(walletErrorMessage(c,label+" failed."))}finally{setBusy("")}
 }

 useEffect(()=>{const t=window.setTimeout(()=>{refreshWallet().catch(()=>{});fetch("/api/route-readiness").then(r=>r.json()).then(setRouteCheck).catch(()=>setRouteCheck(null));refreshState().catch(()=>{})},0);return()=>window.clearTimeout(t)},[selectedSymbol]);

 return <main className="shell"><Nav/><div className="wrap console-page">
  <span className="kicker">Routy production route</span><h1 style={{fontSize:56}}>Prepare verified routes safely.</h1>
  <p className="muted">Configure AssetRegistry and oracle prerequisites for verified routes. SwapExecutor remains paused.</p>
  <div className="launch-form">
   <section className="form-card"><h2>Wallet</h2><p>Required owner: <code>{OWNER}</code></p><p>Connected: <b>{account||"Not connected"}</b></p><p>Network: <b>{chainId?Number.parseInt(chainId,16):"Not connected"}</b></p>
    {!account?<button className="primary" onClick={connect}>Connect wallet</button>:!correctChain?<button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button>:!authorized?<div className="notice danger">Wrong wallet.</div>:<div className="notice">Owner wallet and chain verified.</div>}
   </section>
   <section className="form-card"><h2>Verified route</h2><div className="route-tabs" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:8,marginBottom:16}}>{ROUTE_CATALOG.map(r=><button type="button" key={r.symbol} className={r.symbol===selectedSymbol?"primary":"secondary"} onClick={()=>setSelectedSymbol(r.symbol)}>{r.symbol}</button>)}</div><label>Stock Token<select value={selectedSymbol} onChange={e=>setSelectedSymbol(e.target.value)}>{ROUTE_CATALOG.map(r=><option key={r.symbol} value={r.symbol}>{r.symbol} · {r.name}</option>)}</select></label>
    <p>{route.symbol}: <code>{route.target}</code></p><p>USDG: <code>{route.quote}</code></p><p>Pool ID: <code>{route.poolId}</code></p><p>Fee / tick spacing: <b>{route.poolKey.fee} / {route.poolKey.tickSpacing}</b></p>
    <div className={poolVerified?"notice":"notice danger"}>PoolKey verification: <b>{poolVerified?"MATCHED":"NOT VERIFIED"}</b></div>
   </section>
  </div>
  <section className="form-card" style={{marginTop:24}}><h2>Owner configuration</h2>
   <div style={{borderTop:"1px solid var(--line)",padding:"18px 0"}}><strong>1. Approve {route.symbol} in AssetRegistry</strong><p>Status: <b>{state.assetApproved?"Configured":"Pending"}</b></p>
    {!state.assetApproved&&<button className="primary" disabled={!authorized||!correctChain||!poolVerified||Boolean(busy)} onClick={()=>send("Approve "+route.symbol,ROUTY_DEPLOYMENT.assetRegistry,encodeFunctionData({abi:registryAbi,functionName:"setApproved",args:[route.target,true]}))}>Approve {route.symbol}</button>}
   </div>
   <div style={{borderTop:"1px solid var(--line)",padding:"18px 0"}}><strong>2. Configure {route.symbol}/USD feed</strong><p>Expected: <code>{route.targetFeed}</code></p><p>Status: <b>{targetFeedConfigured?"Configured":"Pending"}</b></p>
    {!targetFeedConfigured&&<button className="primary" disabled={!authorized||!correctChain||!poolVerified||Boolean(busy)} onClick={()=>send("Configure "+route.symbol+" feed",ROUTY_DEPLOYMENT.oracleRegistry,encodeFunctionData({abi:oracleAbi,functionName:"setFeed",args:[route.target,route.targetFeed]}))}>Set {route.symbol} feed</button>}
   </div>
   <div style={{borderTop:"1px solid var(--line)",padding:"18px 0"}}><strong>3. Configure USDG/USD feed</strong><p>Expected: <code>{route.quoteFeed}</code></p><p>Status: <b>{quoteFeedConfigured?"Configured":"Pending"}</b></p>
    {!quoteFeedConfigured&&<button className="primary" disabled={!authorized||!correctChain||!poolVerified||Boolean(busy)} onClick={()=>send("Configure USDG feed",ROUTY_DEPLOYMENT.oracleRegistry,encodeFunctionData({abi:oracleAbi,functionName:"setFeed",args:[route.quote,route.quoteFeed]}))}>Set USDG feed</button>}
   </div>
   <button className="secondary" onClick={()=>refreshState().catch(c=>setError(walletErrorMessage(c,"Could not refresh chain state.")))} disabled={Boolean(busy)}>Refresh on-chain status</button>
   {complete&&<div className="notice" style={{marginTop:16}}>{route.symbol}/USDG prerequisites are complete. SwapExecutor is still paused.</div>}
   {notice&&<p className="notice">{notice}</p>}{error&&<p className="notice danger">{error}</p>}
  </section>
 </div></main>
}
