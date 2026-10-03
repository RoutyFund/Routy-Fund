"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Nav from "@/components/Nav";
import DataNotice from "@/components/DataNotice";
import {useApiResource} from "@/lib/use-api-resource";
import {fetchJson} from "@/lib/fetch-json";
import {PENDING_LAUNCH_KEY,readPendingLaunch,launchMetadataError,type PendingLaunch} from "@/lib/pending-launch";
import {decodeErrorResult,encodeFunctionData,formatEther,type Hex} from "viem";
import {getInjectedProvider} from "@/lib/ethereum-provider";
import {PONS_V2,factoryLaunchAbi,factoryReadAbi} from "@/lib/pons";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {matchesV5LaunchIntent,v5LaunchIntentSalt} from "@/lib/v5-launch-intent";

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
 const[tax,setTax]=useState("0");
 const assetResource=useApiResource<{assets:Asset[]}>("/api/assets");
 const ponsResource=useApiResource<Pons>("/api/pons");
 const routesResource=useApiResource<{routes:RouteStatus[]}>("/api/route-status");
 const setupResource=useApiResource<{launchReady:boolean}>("/api/auto-setup/config");
 const assets=assetResource.data?.assets||[],pons=ponsResource.data,routeStatus=routesResource.data?.routes||[];
 const routeStatusLoaded=!routesResource.loading&&!routesResource.error;
 const autoSetupEnabled=setupResource.data?.launchReady===true,launchReadinessLoaded=!setupResource.loading;
 const configurationError=setupResource.error||ponsResource.error||routesResource.error;
 const[status,setStatus]=useState(""); const[busy,setBusy]=useState(false); const[launchedToken,setLaunchedToken]=useState(""); const[launchTx,setLaunchTx]=useState(""); const[autoSetup,setAutoSetup]=useState<AutoSetup|null>(null);
 const[pending,setPending]=useState<PendingLaunch|null>(null);const[recoveryLoaded,setRecoveryLoaded]=useState(false);const[recoveryRetry,setRecoveryRetry]=useState(0);const[storageError,setStorageError]=useState("");
 const savePending=useCallback((record:PendingLaunch)=>{
  setPending(record);setLaunchTx(record.launchTx);if(record.token)setLaunchedToken(record.token);
  try{localStorage.setItem(PENDING_LAUNCH_KEY,JSON.stringify(record))}catch{setStorageError("Browser storage is unavailable. Keep this page open until automatic setup is queued.")}
 },[]);
 useEffect(()=>{
  const id=window.setTimeout(()=>{
   let record:PendingLaunch|null=null;
   try{record=readPendingLaunch(localStorage.getItem(PENDING_LAUNCH_KEY))}catch{}
   if(record&&matchesV5LaunchIntent(record.setupNonce,{creator:record.creator,targetAsset:record.targetAsset,policy:record.policy,nonce:record.intentNonce})){
    savePending(record);setAsset(record.targetAsset);setPolicy(String(record.policy));setStatus(record.queued?"Restored confirmed launch. Checking automatic route setup…":"Restored submitted launch. Resuming confirmation and automatic setup…");
   }
   setRecoveryLoaded(true);
  },0);
  return()=>window.clearTimeout(id);
 },[savePending]);
 useEffect(()=>{
  if(!pending||pending.queued)return;
  let stopped=false;let timer:number|undefined;
  async function recover(){
   if(!pending)return;
   try{
    const receipt=await fetchJson<{status:string;token?:string;creator?:string}>("/api/launch/receipt?hash="+pending.launchTx);
    if(stopped)return;
    if(receipt.status==="reverted"){
     setStatus("The launch reverted on-chain. Review the transaction before starting a new launch.");setPending(null);try{localStorage.removeItem(PENDING_LAUNCH_KEY)}catch{};return;
    }
    if(receipt.status==="confirmed"&&receipt.token){
     if(receipt.creator?.toLowerCase()!==pending.creator.toLowerCase())throw new Error("Launch creator mismatch");
     setLaunchedToken(receipt.token);setStatus("Launch confirmed. Queueing automatic route setup…");
     const record={...pending,token:receipt.token};
     const result=await fetchJson<{ok:boolean;alreadyReady?:boolean}>("/api/auto-setup/queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...record,token:receipt.token})});
     if(stopped)return;
     savePending({...record,queued:true});setStatus(result.alreadyReady?"Launch confirmed. Routy route is already ready.":"Launch confirmed. Automatic route setup is queued.");return;
    }
    setStatus("Launch submitted and still pending. Confirmation will be checked automatically.");
   }catch(cause){if(!stopped)setStatus("Automatic setup will retry: "+(cause instanceof Error?cause.message:"connection unavailable"))}
   if(!stopped)timer=window.setTimeout(()=>void recover(),5000);
  }
  void recover();
  return()=>{stopped=true;if(timer!==undefined)window.clearTimeout(timer)};
 },[pending,recoveryRetry,savePending]);
 useEffect(()=>{if(!launchedToken)return;let stopped=false;let timer:number|undefined;async function poll(){try{const d=await fetchJson<AutoSetup>("/api/auto-setup/status?token="+launchedToken);if(!stopped){setAutoSetup(d);if(d.ready){try{localStorage.removeItem(PENDING_LAUNCH_KEY)}catch{};return}}}catch(cause){if(!stopped)setStatus("Launch confirmed. Route status is temporarily unavailable: "+(cause instanceof Error?cause.message:"connection error"))}if(!stopped)timer=window.setTimeout(()=>void poll(),5000)}void poll();return()=>{stopped=true;if(timer!==undefined)window.clearTimeout(timer)}},[launchedToken]);
 const config=useMemo(()=>pons?.configs?.find(c=>c.enabled),[pons]);
 const selectedRoute=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===asset.toLowerCase());
 const verifiedTarget=Boolean(selectedRoute);
 const routeConfigured=Boolean(routeStatusLoaded&&selectedRoute&&routeStatus.find(s=>s.symbol===selectedRoute.symbol)?.configurationComplete);
 const metadataError=launchMetadataError({logo,description,socials:[x,website,telegram],tax,maxTax:Number(pons?.maxCreatorTaxBps||1000)});
 const valid=recoveryLoaded&&!pending&&autoSetupEnabled&&name.trim()&&symbol.trim()&&description.trim()&&!metadataError&&config&&verifiedTarget&&routeStatusLoaded&&routeConfigured;
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
   if(!routerResponse.ok||!routerPrediction.ok||!routerPrediction.router)throw new Error("Routy fee routing is not ready: "+(routerPrediction.error||"router prediction failed"));
   const feeRouter=routerPrediction.router as `0x${string}`;
   const validation=launchMetadataError({logo,description:description.trim(),socials:[x.trim(),website.trim(),telegram.trim()],tax,maxTax:freshMaxTax});
   if(validation)throw new Error(validation);
   const creatorTax=Number(tax);
   const data=encodeFunctionData({abi:factoryLaunchAbi,functionName:"launchToken",args:[{
    name:name.trim(),symbol:symbol.trim(),logo,description:description.trim(),
    socials:{twitter:x.trim(),telegram:telegram.trim(),discord:"",website:website.trim(),farcaster:""},
    creatorFeeRecipient:feeRouter,creatorTaxBps:creatorTax,buybackEnabled:false,expectedEconomics:economics as `0x${string}`,salt
   },BigInt(config!.id),pairToken]});

   const tx={from:account,to:PONS_V2.factory,data,value:"0x"+freshLaunchFee.toString(16)};
   setStatus("Running Pons preflight…");
   const estimated=await provider.request<string>({method:"eth_estimateGas",params:[tx]});
   const padded="0x"+((BigInt(estimated)*125n/100n).toString(16));
   setStatus("Preflight passed. Confirm the Pons launch in your wallet.");
   const hash=await provider.request<string>({method:"eth_sendTransaction",params:[{...tx,gas:padded}]});
   savePending({version:1,chainId:4663,creator:account,targetAsset:asset,policy:Number(policy),intentNonce,setupNonce:salt,feeRouter,launchTx:hash,logo:logo.trim()});
   setStatus("Launch submitted. Confirming the transaction and automatic route setup…");

  }catch(e){setStatus(walletErrorMessage(e)||"Launch cancelled or failed.");}finally{setBusy(false)}
 }
 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Launch on Routy</span><h1>Create your route</h1><p className="lead">Launch through Routy with Pons infrastructure underneath. Choose the token identity, Stock Token target and community reward policy here.</p></div><span className="pill">Robinhood Chain</span></header>
  <DataNotice error={configurationError} retry={()=>{void setupResource.reload();void ponsResource.reload();void routesResource.reload()}}/>
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
    <label>Creator tax (%)<input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="0" value={tax===""?"":String(Math.round(Number(tax)/100))} onChange={e=>{const d=e.target.value.replace(/\D/g,"").slice(0,2);if(d===""){setTax("");return}setTax(String(Math.min(Number(d),Math.min(10,Math.floor(Number(pons?.maxCreatorTaxBps||1000)/100)))*100))}} onBlur={()=>{if(tax==="")setTax("0")}}/></label>
    <div className="route-summary"><div><span className="data-label">Pair</span><b>USDG</b></div><div><span className="data-label">Launch fee</span><b>{pons?formatEther(BigInt(pons.launchFee))+" ETH":"Loading…"}</b></div><div><span className="data-label">Rewards</span><b>{["Weighted raffle","Equal lottery","Pro-rata"][Number(policy)]}</b></div><div><span className="data-label">Network</span><b>Robinhood Chain</b></div></div>
    {launchReadinessLoaded&&!autoSetupEnabled&&<div className="notice">Launches open after direct fee routing and automatic setup are activated.</div>}
    <button className="primary" disabled={!valid||busy} onClick={launch}>{busy?"Preparing…":pending?"Launch already submitted":!recoveryLoaded?"Restoring launch…":!launchReadinessLoaded?"Checking launch availability…":!autoSetupEnabled?"Launch setup pending":!routeStatusLoaded?"Checking route…":routeConfigured?"Launch token":"Route setup required"} <span>→</span></button>
    <p className="muted" style={{fontSize:11,margin:0}}>Your wallet signs one launch. Routy automatically prepares the route and sends funded rewards according to your policy. Routy never receives your wallet private key.</p>
    {metadataError&&<div className="notice danger">{metadataError}</div>}
    {storageError&&<div className="notice danger">{storageError}</div>}
    {status&&<div className="notice" role="status">{status}</div>}
    {pending&&!pending.queued&&<button type="button" className="secondary" onClick={()=>setRecoveryRetry(value=>value+1)}>Check confirmation / retry setup</button>}
    {pending&&autoSetup?.ready&&<button type="button" className="secondary" onClick={()=>{setPending(null);setLaunchedToken("");setLaunchTx("");setAutoSetup(null);setStatus("")}}>Start another launch</button>}
    {launchTx&&<a className="secondary" target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/tx/"+launchTx}>View launch transaction ↗</a>}
    {launchedToken&&<div className="notice"><b>Token:</b> <code>{launchedToken}</code></div>}
    {launchedToken&&<div className="notice"><b>Routy setup:</b> {autoSetup?.ready?"Ready":autoSetupEnabled?(autoSetup?.stage==="execution"?"Swap execution paused":autoSetup?.stage==="rewards"?"Activating rewards…":autoSetup?.stage==="poolkey"?"Attaching verified PoolKey…":autoSetup?.stage==="provisioning"?"Provisioning route…":"Queued automatically…"):"Manual fallback until automation is activated."}</div>}
    {launchedToken&&!autoSetupEnabled&&<a className="primary" href={"/deploy/provision?token="+launchedToken+"&asset="+asset+"&policy="+policy}>Continue to provisioning →</a>}
    {launchedToken&&autoSetup&&<div className="route-summary"><div><span className="data-label">Provision</span><b>{autoSetup.provisioned?"Ready":"Pending"}</b></div><div><span className="data-label">PoolKey</span><b>{autoSetup.poolKeyConfigured?"Ready":"Pending"}</b></div><div><span className="data-label">Rewards</span><b>{autoSetup.rewardsActive?"Active":"Pending"}</b></div><div><span className="data-label">Route</span><b>{autoSetup.ready?"Ready":autoSetup.symbol||"Setting up"}</b></div></div>}
   </section>
  </div>
  <section className="section"><div className="section-head"><div><span className="micro">HOW IT WORKS</span><h2>One launch flow.</h2></div></div><div className="flow">
   <div className="flow-step"><span>01</span><div><b>Create</b><p>Set the token identity and social links in Routy.</p></div></div>
   <div className="flow-step"><span>02</span><div><b>Launch</b><p>Your wallet launches the token through the verified Pons V2 factory.</p></div></div>
   <div className="flow-step"><span>03</span><div><b>Auto-route</b><p>After launch confirmation, Routy automatically provisions the selected Stock Token route and verified PoolKey.</p></div></div>
   <div className="flow-step"><span>04</span><div><b>Reward</b><p>Routy activates the managed distributor automatically; funded Stock Tokens are pushed to eligible recipient wallets according to your selected policy. Rewards require earned creator fees and successful swaps.</p></div></div>
  </div></section>
 </div></main>
}
