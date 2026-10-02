"use client";
import {useEffect,useMemo,useState} from "react";
import Nav from "@/components/Nav";
import {decodeErrorResult,decodeEventLog,encodeFunctionData,formatEther,type Hex} from "viem";
import {getInjectedProvider} from "@/lib/ethereum-provider";
import {PONS_V2,factoryLaunchAbi,factoryReadAbi} from "@/lib/pons";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {v5LaunchIntentSalt} from "@/lib/v5-launch-intent";

type Asset={tokenSymbol:string;tokenName:string;contractAddress:string};
type Pons={launchFee:string;maxCreatorTaxBps:string;configs:Array<{id:number;enabled:boolean}>};
type RouteStatus={symbol:string;configurationComplete:boolean};
type AutoSetup={stage:string;provisioned:boolean;poolKeyConfigured:boolean;rewardsActive:boolean;ready:boolean;symbol?:string|null};

function extractHexData(value:unknown):Hex|undefined{
 if(typeof value==="string"&&/^0x[0-9a-fA-F]+$/.test(value))return value as Hex;
 if(value&&typeof value==="object"){
  const v=value as Record<string,unknown>;
  return extractHexData(v.data)||extractHexData(v.cause)||extractHexData(v.error);
 }
 return undefined;
}
function walletErrorMessage(error:unknown){
 const revertData=extractHexData(error);
 if(revertData){
  try{
   const decoded=decodeErrorResult({abi:factoryLaunchAbi,data:revertData});
   return "Pons reverted: "+decoded.errorName;
  }catch{}
 }
 if(error instanceof Error)return error.message;
 if(typeof error==="string")return error;
 if(error&&typeof error==="object"){
  const e=error as {message?:unknown;code?:unknown;data?:unknown;cause?:unknown};
  const parts:string[]=[];
  if(typeof e.message==="string"&&e.message)parts.push(e.message);
  if(e.code!==undefined)parts.push("code "+String(e.code));
  if(e.data!==undefined){
   try{parts.push("data "+JSON.stringify(e.data))}catch{parts.push("data "+String(e.data))}
  }
  if(e.cause!==undefined){
   try{parts.push("cause "+JSON.stringify(e.cause))}catch{parts.push("cause "+String(e.cause))}
  }
  if(parts.length)return parts.join(" · ");
  try{return JSON.stringify(error)}catch{return String(error)}
 }
 return String(error);
}

export default function Launch(){
 const[name,setName]=useState(""); const[symbol,setSymbol]=useState(""); const[description,setDescription]=useState("");
 const[logo,setLogo]=useState(""); const[x,setX]=useState(""); const[website,setWebsite]=useState(""); const[telegram,setTelegram]=useState("");
 const[asset,setAsset]=useState<string>(EXECUTABLE_ROUTES[0].target); const[policy,setPolicy]=useState("0");
 const[tax,setTax]=useState("0"); const[assets,setAssets]=useState<Asset[]>([]); const[pons,setPons]=useState<Pons|null>(null); const[routeStatus,setRouteStatus]=useState<RouteStatus[]>([]); const[routeStatusLoaded,setRouteStatusLoaded]=useState(false);
 const[status,setStatus]=useState(""); const[busy,setBusy]=useState(false); const[launchedToken,setLaunchedToken]=useState(""); const[launchTx,setLaunchTx]=useState(""); const[autoSetup,setAutoSetup]=useState<AutoSetup|null>(null); const[autoSetupEnabled,setAutoSetupEnabled]=useState(false); const[launchReadinessLoaded,setLaunchReadinessLoaded]=useState(false);
 useEffect(()=>{fetch("/api/auto-setup/config").then(r=>r.json()).then(d=>setAutoSetupEnabled(d.launchReady===true)).catch(()=>setAutoSetupEnabled(false)).finally(()=>setLaunchReadinessLoaded(true));fetch("/api/assets").then(r=>r.json()).then(d=>setAssets((d.assets||[]).filter((a:Asset)=>a.contractAddress))).catch(()=>{});fetch("/api/pons").then(r=>r.json()).then(d=>d.ok&&setPons(d)).catch(()=>{});fetch("/api/route-status").then(r=>r.json()).then(d=>{if(d.ok)setRouteStatus(d.routes||[])}).catch(()=>{}).finally(()=>setRouteStatusLoaded(true))},[]);
 useEffect(()=>{if(!launchedToken)return;let stopped=false;async function poll(){try{const r=await fetch("/api/auto-setup/status?token="+launchedToken,{cache:"no-store"});const d=await r.json();if(!stopped&&d.ok)setAutoSetup(d)}catch{}}poll();const id=window.setInterval(poll,3000);return()=>{stopped=true;window.clearInterval(id)}},[launchedToken]);
 const config=useMemo(()=>pons?.configs?.find(c=>c.enabled),[pons]);
 const selectedRoute=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===asset.toLowerCase());
 const verifiedTarget=Boolean(selectedRoute);
 const routeConfigured=Boolean(routeStatusLoaded&&selectedRoute&&routeStatus.find(s=>s.symbol===selectedRoute.symbol)?.configurationComplete);
 const valid=autoSetupEnabled&&name.trim()&&symbol.trim()&&description.trim()&&logo.length<=512&&description.length<=2048&&x.length<=256&&website.length<=256&&telegram.length<=256&&config&&verifiedTarget&&routeStatusLoaded&&routeConfigured;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- injected wallets expose receipt payloads without a stable TS type.
 async function waitReceipt(hash:string,provider:ReturnType<typeof getInjectedProvider>){if(!provider)return null;for(let i=0;i<40;i++){const r=await provider.request<any>({method:"eth_getTransactionReceipt",params:[hash]});if(r)return r;await new Promise(x=>setTimeout(x,1500))}return null}
 async function launch(){
  if(!valid||busy)return; const provider=getInjectedProvider(); if(!provider){setStatus("Connect an EVM wallet first.");return}
  setBusy(true);setStatus("Preparing launch…");
  try{
   const accounts=await provider.request<string[]>({method:"eth_requestAccounts"});const account=accounts?.[0];if(!account)throw new Error("Wallet not connected");
   await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1237"}]});
   const pairToken=selectedRoute!.quote;

   const feeData=encodeFunctionData({abi:factoryReadAbi,functionName:"launchFee"});
   const canLaunchData=encodeFunctionData({abi:factoryReadAbi,functionName:"canLaunch",args:[account as `0x${string}`]});
   const maxTaxData=encodeFunctionData({abi:factoryReadAbi,functionName:"maxCreatorTaxBps"});
   const approvedData=encodeFunctionData({abi:factoryReadAbi,functionName:"approvedPairTokens",args:[pairToken]});
   const econData=encodeFunctionData({abi:factoryReadAbi,functionName:"previewLaunchEconomics",args:[BigInt(config!.id),pairToken]});

   const [feeRaw,maxTaxRaw,approvedRaw,economics,canLaunchRaw]=await Promise.all([
    provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:feeData},"latest"]}),
    provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:maxTaxData},"latest"]}),
    provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:approvedData},"latest"]}),
    provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:econData},"latest"]}),
    provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:canLaunchData},"latest"]}),
   ]);

   const freshLaunchFee=BigInt(feeRaw);
   const freshMaxTax=Number(BigInt(maxTaxRaw));
   const pairApproved=BigInt(approvedRaw)!==0n;
   const launchAllowed=BigInt(canLaunchRaw)!==0n;
   if(!pairApproved)throw new Error("Pons preflight: PairTokenNotApproved.");
   if(!launchAllowed)throw new Error("Pons preflight: canLaunch(account) returned false.");

   const intentNonce="0x"+Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,"0")).join("");
   const salt=v5LaunchIntentSalt({creator:account,targetAsset:asset,policy:Number(policy),nonce:intentNonce});
   const routerResponse=await fetch("/api/fee-router/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creator:account,salt})});
   const routerPrediction=await routerResponse.json() as {ok?:boolean;router?:string;error?:string};
   if(!routerResponse.ok||!routerPrediction.ok||!routerPrediction.router)throw new Error("Routy V5 fee routing is not ready: "+(routerPrediction.error||"router prediction failed"));
   const feeRouter=routerPrediction.router as `0x${string}`;
   const creatorTax=Math.max(0,Math.min(Number(tax||0),freshMaxTax));
   const data=encodeFunctionData({abi:factoryLaunchAbi,functionName:"launchToken",args:[{
    name:name.trim(),symbol:symbol.trim(),logo,description:description.trim(),
    socials:{twitter:x.trim(),telegram:telegram.trim(),discord:"",website:website.trim(),farcaster:""},
    creatorFeeRecipient:feeRouter,creatorTaxBps:creatorTax,buybackEnabled:false,expectedEconomics:economics as `0x${string}`,salt
   },BigInt(config!.id),pairToken]});

   const tx={from:account,to:PONS_V2.factory,data,value:"0x"+freshLaunchFee.toString(16)};
   setStatus("Running Pons preflight…");
   try{
    const estimated=await provider.request<string>({method:"eth_estimateGas",params:[tx]});
    const padded="0x"+((BigInt(estimated)*125n/100n).toString(16));
    setStatus("Preflight passed. Confirm the Pons launch in your wallet.");
    const hash=await provider.request<string>({method:"eth_sendTransaction",params:[{...tx,gas:padded}]});
    setLaunchTx(hash);setStatus("Launch submitted: "+hash.slice(0,10)+"… Waiting for confirmation.");
    const receipt=await waitReceipt(hash,provider);
    if(!receipt){setStatus("Launch is still pending. Do not resubmit.");return}
    if(receipt.status!=="0x1"&&receipt.status!=="0x01")throw new Error("Pons launch failed on-chain.");
    let tokenAddress="";
    for(const log of receipt.logs||[]){try{
     // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wallet log topics are untyped EIP-1193 data.
     const decoded=decodeEventLog({abi:factoryLaunchAbi,data:log.data as Hex,topics:log.topics as any});
     if(decoded.eventName==="TokenLaunched"){
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem event args are narrowed at runtime by eventName.
      tokenAddress=String((decoded.args as any).token||"");break
     }
    }catch{}}
    if(tokenAddress){
     setLaunchedToken(tokenAddress);
     if(autoSetupEnabled){
      setStatus("Launch confirmed. Adding Routy route setup to the automation queue…");
      try{
       const queued=await fetch("/api/auto-setup/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:tokenAddress,creator:account,targetAsset:asset,policy:Number(policy),launchTx:hash,setupNonce:salt,feeRouter,intentNonce})});
       const q=await queued.json();
       setStatus(queued.ok&&q.ok?(q.alreadyReady?"Launch confirmed. Routy route is already ready.":"Launch confirmed. Routy route setup is queued automatically."):"Launch confirmed, but automatic queueing is unavailable. Continue with provisioning.");
      }catch{setStatus("Launch confirmed, but automatic queueing is unavailable. Continue with provisioning.")}
     }else setStatus("Launch confirmed. Routy automatic setup is not enabled yet; continue with provisioning.");
    }
    else setStatus("Launch confirmed, but the token address could not be decoded automatically. Check the transaction on the explorer.");
    return;
   }catch(preflightError){
    const detail=walletErrorMessage(preflightError);
    throw new Error("Pons preflight failed before wallet submission: "+detail);
   }

  }catch(e){setStatus(walletErrorMessage(e)||"Launch cancelled or failed.");}finally{setBusy(false)}
 }
 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Launch on Routy</span><h1>Create your route.</h1><p className="lead">Launch through Routy with Pons infrastructure underneath. Choose the token identity, Stock Token target and community reward policy here.</p></div><span className="pill">Robinhood Chain</span></header>
  <div className="launch-form">
   <section className="form-card"><div><span className="micro">TOKEN</span><h3 style={{marginTop:8}}>Token details</h3></div>
    <label>Logo URI<input value={logo} onChange={e=>setLogo(e.target.value)} placeholder="https://... or ipfs://..." maxLength={512}/></label>
    <p className="muted" style={{fontSize:11,marginTop:-8}}>Pons V2 limits the on-chain logo field to 512 bytes. Use a short HTTPS or IPFS URI, not base64 image data.</p>
    <label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Token name"/></label>
    <label>Ticker<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="Ticker" maxLength={16}/></label>
    <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell the community what this launch is about."/></label>
    <label>X / Twitter<input value={x} onChange={e=>setX(e.target.value)} placeholder="https://x.com/..."/></label>
    <label>Website<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://..."/></label>
    <label>Telegram<input value={telegram} onChange={e=>setTelegram(e.target.value)} placeholder="https://t.me/..."/></label>
   </section>
   <section className="form-card"><div><span className="micro">ROUTE</span><h3 style={{marginTop:8}}>Route settings</h3></div>
    <label>Stock Token target<select value={asset} onChange={e=>setAsset(e.target.value)}>{EXECUTABLE_ROUTES.map(r=>{const canonical=assets.find(a=>a.contractAddress.toLowerCase()===r.target.toLowerCase());const ready=routeStatus.find(s=>s.symbol===r.symbol)?.configurationComplete;const state=!routeStatusLoaded?" · Checking…":ready?" · Ready":" · Setup required";return <option key={r.target} value={r.target}>{r.symbol} · {canonical?.tokenName||r.name}{state}</option>})}</select></label>
    {!routeStatusLoaded&&<div className="notice">Checking live route configuration…</div>}
    {routeStatusLoaded&&selectedRoute&&!routeConfigured&&<div className="notice danger">{selectedRoute.symbol} is verified, but its AssetRegistry/oracle owner setup is not complete yet. <a href="/deploy/route"><b>Finish route setup →</b></a></div>}
    <label>Reward policy<select value={policy} onChange={e=>setPolicy(e.target.value)}><option value="0">Weighted raffle</option><option value="1">Equal lottery</option><option value="2">Pro-rata</option></select></label>
    <label>Creator tax (BPS)<input type="number" min="0" max={pons?.maxCreatorTaxBps||"1000"} value={tax} onChange={e=>setTax(e.target.value)}/></label>
    <div className="route-summary"><div><span className="data-label">Pair</span><b>USDG</b></div><div><span className="data-label">Launch fee</span><b>{pons?formatEther(BigInt(pons.launchFee))+" ETH":"Loading…"}</b></div><div><span className="data-label">Rewards</span><b>{["Weighted raffle","Equal lottery","Pro-rata"][Number(policy)]}</b></div><div><span className="data-label">Network</span><b>Robinhood Chain</b></div></div>
    {launchReadinessLoaded&&!autoSetupEnabled&&<div className="notice">Launches open after direct fee routing and automatic setup are activated.</div>}
    <button className="primary" disabled={!valid||busy} onClick={launch}>{busy?"Preparing…":!launchReadinessLoaded?"Checking launch availability…":!autoSetupEnabled?"Launch setup pending":!routeStatusLoaded?"Checking route…":routeConfigured?"Launch token":"Route setup required"} <span>→</span></button>
    <p className="muted" style={{fontSize:11,margin:0}}>Your wallet signs the Pons launch directly. Routy never receives your private key or custody of your wallet.</p>
    {status&&<div className="notice">{status}</div>}
    {launchTx&&<a className="secondary" target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/tx/"+launchTx}>View launch transaction ↗</a>}
    {launchedToken&&<div className="notice"><b>Token:</b> <code>{launchedToken}</code></div>}
    {launchedToken&&<div className="notice"><b>Routy setup:</b> {autoSetup?.ready?"Ready":autoSetupEnabled?(autoSetup?.stage==="rewards"?"Activating rewards…":autoSetup?.stage==="poolkey"?"Attaching verified PoolKey…":autoSetup?.stage==="provisioning"?"Provisioning route…":"Queued automatically…"):"Manual fallback until automation is activated."}</div>}
    {launchedToken&&!autoSetupEnabled&&<a className="primary" href={"/deploy/provision?token="+launchedToken+"&asset="+asset+"&policy="+policy}>Continue to provisioning →</a>}
    {launchedToken&&autoSetup&&<div className="route-summary"><div><span className="data-label">Provision</span><b>{autoSetup.provisioned?"Ready":"Pending"}</b></div><div><span className="data-label">PoolKey</span><b>{autoSetup.poolKeyConfigured?"Ready":"Pending"}</b></div><div><span className="data-label">Rewards</span><b>{autoSetup.rewardsActive?"Active":"Pending"}</b></div><div><span className="data-label">Route</span><b>{autoSetup.ready?"Ready":autoSetup.symbol||"Setting up"}</b></div></div>}
   </section>
  </div>
  <section className="section"><div className="section-head"><div><span className="micro">HOW IT WORKS</span><h2>One launch flow.</h2></div></div><div className="flow">
   <div className="flow-step"><span>01</span><div><b>Create</b><p>Set the token identity and social links in Routy.</p></div></div>
   <div className="flow-step"><span>02</span><div><b>Launch</b><p>Your wallet launches the token through the verified Pons V2 factory.</p></div></div>
   <div className="flow-step"><span>03</span><div><b>Auto-route</b><p>After launch confirmation, Routy automatically provisions the selected Stock Token route and verified PoolKey.</p></div></div>
   <div className="flow-step"><span>04</span><div><b>Reward</b><p>Routy activates the managed distributor automatically; verified acquired assets follow your selected reward policy.</p></div></div>
  </div></section>
 </div></main>
}
