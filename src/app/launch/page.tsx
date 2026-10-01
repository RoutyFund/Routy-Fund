"use client";
import {useEffect,useMemo,useState} from "react";
import Nav from "@/components/Nav";
import {encodeFunctionData,formatEther,keccak256,toBytes} from "viem";
import {getInjectedProvider} from "@/lib/ethereum-provider";
import {PONS_V2,factoryLaunchAbi,factoryReadAbi} from "@/lib/pons";
import {ROUTE_CATALOG} from "@/lib/route-catalog";

type Asset={tokenSymbol:string;tokenName:string;contractAddress:string};
type Pons={launchFee:string;maxCreatorTaxBps:string;configs:Array<{id:number;enabled:boolean}>};

export default function Launch(){
 const[name,setName]=useState(""); const[symbol,setSymbol]=useState(""); const[description,setDescription]=useState("");
 const[logo,setLogo]=useState(""); const[x,setX]=useState(""); const[website,setWebsite]=useState(""); const[telegram,setTelegram]=useState("");
 const[asset,setAsset]=useState(ROUTE_CATALOG[0].target); const[policy,setPolicy]=useState("0");
 const[tax,setTax]=useState("0"); const[assets,setAssets]=useState<Asset[]>([]); const[pons,setPons]=useState<Pons|null>(null);
 const[status,setStatus]=useState(""); const[busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/assets").then(r=>r.json()).then(d=>setAssets((d.assets||[]).filter((a:Asset)=>a.contractAddress))).catch(()=>{});fetch("/api/pons").then(r=>r.json()).then(d=>d.ok&&setPons(d)).catch(()=>{})},[]);
 const config=useMemo(()=>pons?.configs?.find(c=>c.enabled),[pons]);
 const verifiedTarget=ROUTE_CATALOG.some(r=>r.target.toLowerCase()===asset.toLowerCase());
 const valid=name.trim()&&symbol.trim()&&description.trim()&&config&&verifiedTarget;
 function file(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return; if(f.size>500000){setStatus("Logo must be under 500 KB.");return} const r=new FileReader();r.onload=()=>setLogo(String(r.result||""));r.readAsDataURL(f)}
 async function launch(){
  if(!valid||busy)return; const provider=getInjectedProvider(); if(!provider){setStatus("Connect an EVM wallet first.");return}
  setBusy(true);setStatus("Preparing launch…");
  try{
   const accounts=await provider.request<string[]>({method:"eth_requestAccounts"});const account=accounts?.[0];if(!account)throw new Error("Wallet not connected");
   await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1237"}]});
   const pairToken="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
   const econData=encodeFunctionData({abi:factoryReadAbi,functionName:"previewLaunchEconomics",args:[BigInt(config!.id),pairToken]});
   const economics=await provider.request<string>({method:"eth_call",params:[{to:PONS_V2.factory,data:econData},"latest"]});
   const salt=keccak256(toBytes(account+":"+Date.now().toString()));
   const creatorTax=Math.max(0,Math.min(Number(tax||0),Number(pons?.maxCreatorTaxBps||1000)));
   const data=encodeFunctionData({abi:factoryLaunchAbi,functionName:"launchToken",args:[{
    name:name.trim(),symbol:symbol.trim(),logo,description:description.trim(),
    socials:{twitter:x.trim(),telegram:telegram.trim(),discord:"",website:website.trim(),farcaster:""},
    creatorFeeRecipient:account as `0x${string}`,creatorTaxBps:creatorTax,buybackEnabled:true,expectedEconomics:economics as `0x${string}`,salt
   },BigInt(config!.id),pairToken]});
   setStatus("Confirm the Pons launch in your wallet.");
   const hash=await provider.request<string>({method:"eth_sendTransaction",params:[{from:account,to:PONS_V2.factory,data,value:"0x"+BigInt(pons!.launchFee).toString(16)}]});
   setStatus("Launch submitted: "+hash.slice(0,10)+"… After confirmation, Routy can provision the selected "+(assets.find(a=>a.contractAddress.toLowerCase()===asset.toLowerCase())?.tokenSymbol||"asset")+" route.");
  }catch(e){setStatus(e instanceof Error?e.message:"Launch cancelled or failed.");}finally{setBusy(false)}
 }
 return <main className="shell"><Nav/><div className="wrap">
  <header className="page-head"><div className="page-head-copy"><span className="eyebrow">Launch on Routy</span><h1>Create your route.</h1><p className="lead">Launch through Routy with Pons infrastructure underneath. Choose the token identity, Stock Token target and community reward policy here.</p></div><span className="pill">Robinhood Chain</span></header>
  <div className="launch-form">
   <section className="form-card"><div><span className="micro">TOKEN</span><h3 style={{marginTop:8}}>Token details</h3></div>
    <label>Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={file}/></label>
    {logo&&<img src={logo} alt="Token preview" style={{width:64,height:64,borderRadius:14,objectFit:"cover",border:"1px solid var(--line)"}}/>}
    <label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Token name"/></label>
    <label>Ticker<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="Ticker" maxLength={16}/></label>
    <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell the community what this launch is about."/></label>
    <label>X / Twitter<input value={x} onChange={e=>setX(e.target.value)} placeholder="https://x.com/..."/></label>
    <label>Website<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://..."/></label>
    <label>Telegram<input value={telegram} onChange={e=>setTelegram(e.target.value)} placeholder="https://t.me/..."/></label>
   </section>
   <section className="form-card"><div><span className="micro">ROUTE</span><h3 style={{marginTop:8}}>Route settings</h3></div>
    <label>Stock Token target<select value={asset} onChange={e=>setAsset(e.target.value)}>{ROUTE_CATALOG.map(r=>{const canonical=assets.find(a=>a.contractAddress.toLowerCase()===r.target.toLowerCase());return <option key={r.target} value={r.target}>{r.symbol} · {canonical?.tokenName||r.name}</option>})}</select></label>
    <label>Reward policy<select value={policy} onChange={e=>setPolicy(e.target.value)}><option value="0">Weighted raffle</option><option value="1">Equal lottery</option><option value="2">Pro-rata</option></select></label>
    <label>Creator tax (BPS)<input type="number" min="0" max={pons?.maxCreatorTaxBps||"1000"} value={tax} onChange={e=>setTax(e.target.value)}/></label>
    <div className="route-summary"><div><span className="data-label">Pair</span><b>USDG</b></div><div><span className="data-label">Launch fee</span><b>{pons?formatEther(BigInt(pons.launchFee))+" ETH":"Loading…"}</b></div><div><span className="data-label">Rewards</span><b>{["Weighted raffle","Equal lottery","Pro-rata"][Number(policy)]}</b></div><div><span className="data-label">Network</span><b>Robinhood Chain</b></div></div>
    <button className="primary" disabled={!valid||busy} onClick={launch}>{busy?"Preparing…":"Launch token"} <span>→</span></button>
    <p className="muted" style={{fontSize:11,margin:0}}>Your wallet signs the Pons launch directly. Routy never receives your private key or custody of your wallet.</p>
    {status&&<div className="notice">{status}</div>}
   </section>
  </div>
  <section className="section"><div className="section-head"><div><span className="micro">HOW IT WORKS</span><h2>One launch flow.</h2></div></div><div className="flow">
   <div className="flow-step"><span>01</span><div><b>Create</b><p>Set the token identity and social links in Routy.</p></div></div>
   <div className="flow-step"><span>02</span><div><b>Launch</b><p>Your wallet launches the token through the verified Pons V2 factory.</p></div></div>
   <div className="flow-step"><span>03</span><div><b>Route</b><p>Routy provisions the selected Stock Token route after launch confirmation.</p></div></div>
   <div className="flow-step"><span>04</span><div><b>Reward</b><p>Verified acquired assets follow your selected reward policy.</p></div></div>
  </div></section>
 </div></main>
}