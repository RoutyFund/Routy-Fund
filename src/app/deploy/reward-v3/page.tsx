"use client";
import Nav from "@/components/Nav";
import {useEffect,useMemo,useState} from "react";
import {encodeDeployData,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {getInjectedProvider,type EthereumTransactionReceipt} from "@/lib/ethereum-provider";
const OWNER="0x866d5D863381efe9e10cCb2E44f388611F781212" as Address,CHAIN="0x1237";
const PONS="0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as Address,ESCROW="0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e" as Address,KEY="routy-reward-v3-v1";
const one=[{type:"constructor",inputs:[{name:"admin_",type:"address"}]}] as const;
const controller=[{type:"constructor",inputs:[{name:"owner_",type:"address"},{name:"keeper_",type:"address"}]}] as const;
const reward=[{type:"constructor",inputs:[{name:"admin_",type:"address"},{name:"publisher_",type:"address"}]}] as const;
const launcher=[{type:"constructor",inputs:[{name:"registry_",type:"address"},{name:"ponsFactory_",type:"address"},{name:"rewardFactory_",type:"address"},{name:"vaultFactory_",type:"address"},{name:"routerFactory_",type:"address"},{name:"feeEscrow_",type:"address"},{name:"treasury_",type:"address"},{name:"executor_",type:"address"}]}] as const;
const setLauncher=[{type:"function",name:"setLauncher",stateMutability:"nonpayable",inputs:[{name:"launcher_",type:"address"}],outputs:[]}] as const;
const configure=[{type:"function",name:"configureDependencies",stateMutability:"nonpayable",inputs:[{name:"registry_",type:"address"},{name:"guard_",type:"address"},{name:"quoter_",type:"address"},{name:"adapter_",type:"address"},{name:"deviation_",type:"uint16"}],outputs:[]}] as const;
type Id="controller"|"rewardFactory"|"vaultFactory"|"routerFactory"|"executor"|"launcher"|"bindReward"|"bindVault"|"bindRouter"|"bindExecutor"|"configure";
type Rec={hash:Hex,address?:Address};type Saved=Partial<Record<Id,Rec>>;
const STEPS:{id:Id;title:string;kind:"deploy"|"call"}[]=[
{id:"controller",title:"Deploy RewardAutomationController",kind:"deploy"},{id:"rewardFactory",title:"Deploy RewardDistributorFactory V3",kind:"deploy"},{id:"vaultFactory",title:"Deploy AssetVaultV2Factory V3",kind:"deploy"},{id:"routerFactory",title:"Deploy FeeRouterFactory V3",kind:"deploy"},{id:"executor",title:"Deploy SwapExecutor V3",kind:"deploy"},{id:"launcher",title:"Deploy ProtocolLauncher V3",kind:"deploy"},{id:"bindReward",title:"Bind Reward Factory",kind:"call"},{id:"bindVault",title:"Bind Vault Factory",kind:"call"},{id:"bindRouter",title:"Bind Router Factory",kind:"call"},{id:"bindExecutor",title:"Bind Swap Executor",kind:"call"},{id:"configure",title:"Configure Executor Dependencies",kind:"call"}];
const valid=(v:unknown):v is Address=>typeof v==="string"&&isAddress(v,{strict:false})&&v!=="0x0000000000000000000000000000000000000000";
const read=():Saved=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}};const write=(v:Saved)=>localStorage.setItem(KEY,JSON.stringify(v));
export default function Page(){
 const[account,setAccount]=useState(""),[chain,setChain]=useState(""),[keeper,setKeeper]=useState(""),[saved,setSaved]=useState<Saved>({}),[busy,setBusy]=useState<Id|"">(""),[msg,setMsg]=useState(""),[err,setErr]=useState("");
 useEffect(()=>{setSaved(read());refresh().catch(()=>{})},[]);
 const a=useMemo(()=>({controller:saved.controller?.address,reward:saved.rewardFactory?.address,vault:saved.vaultFactory?.address,router:saved.routerFactory?.address,executor:saved.executor?.address,launcher:saved.launcher?.address}),[saved]);
 async function refresh(){const p=getInjectedProvider();if(!p)return;const[x,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(x?.[0]||"");setChain(c||"")}
 async function wallet(){const p=getInjectedProvider();if(!p)throw Error("Wallet EVM tidak ditemukan.");const[x,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);if(x?.[0]?.toLowerCase()!==OWNER.toLowerCase())throw Error("Gunakan wallet owner Routy.");if(c?.toLowerCase()!==CHAIN)throw Error("Gunakan Robinhood Chain (4663).");return p}
 function target(id:Id){if(id==="bindReward")return a.reward;if(id==="bindVault")return a.vault;if(id==="bindRouter")return a.router;if(id==="bindExecutor"||id==="configure")return a.executor}
 function data(id:Id):Hex{
  if(id==="controller"){if(!valid(keeper))throw Error("Keeper address belum valid.");return encodeDeployData({bytecode:DEPLOY_BYTECODE.RewardAutomationController as Hex,abi:controller,args:[OWNER,keeper]})}
  if(id==="rewardFactory"){if(!a.controller)throw Error("Controller belum verified.");return encodeDeployData({bytecode:DEPLOY_BYTECODE.RewardDistributorFactory as Hex,abi:reward,args:[OWNER,a.controller]})}
  if(id==="vaultFactory")return encodeDeployData({bytecode:DEPLOY_BYTECODE.AssetVaultV2Factory as Hex,abi:one,args:[OWNER]});
  if(id==="routerFactory")return encodeDeployData({bytecode:DEPLOY_BYTECODE.FeeRouterFactory as Hex,abi:one,args:[OWNER]});
  if(id==="executor")return encodeDeployData({bytecode:DEPLOY_BYTECODE.SwapExecutor as Hex,abi:one,args:[OWNER]});
  if(id==="launcher"){if(!a.reward||!a.vault||!a.router||!a.executor)throw Error("Dependency belum lengkap.");return encodeDeployData({bytecode:DEPLOY_BYTECODE.ProtocolLauncherV2 as Hex,abi:launcher,args:[ROUTY_DEPLOYMENT.assetRegistry as Address,PONS,a.reward,a.vault,a.router,ESCROW,ROUTY_DEPLOYMENT.treasury as Address,a.executor]})}
  if(id.startsWith("bind")){if(!a.launcher)throw Error("Launcher belum verified.");return encodeFunctionData({abi:setLauncher,functionName:"setLauncher",args:[a.launcher]})}
  return encodeFunctionData({abi:configure,functionName:"configureDependencies",args:[ROUTY_DEPLOYMENT.oracleRegistry as Address,ROUTY_DEPLOYMENT.oracleGuard as Address,ROUTY_DEPLOYMENT.swapOracleQuoter as Address,ROUTY_DEPLOYMENT.swapRouterAdapter as Address,200]});
 }
 const ready=(i:number)=>i===0||Boolean(saved[STEPS[i-1].id]?.address);
 async function submit(id:Id,i:number){setBusy(id);setErr("");try{if(!ready(i))throw Error("Verify step sebelumnya.");if(saved[id]?.hash)throw Error("Hash sudah tersimpan; verify dulu.");const p=await wallet(),to=target(id),tx={from:OWNER,...(to?{to}:{}),data:data(id),value:"0x0"};const e=await p.request<Hex>({method:"eth_estimateGas",params:[tx]}),gas=("0x"+((BigInt(e)*125n/100n).toString(16))) as Hex;const hash=await p.request<Hex>({method:"eth_sendTransaction",params:[{...tx,gas}]});const n={...saved,[id]:{hash}};write(n);setSaved(n);setMsg("Transaksi dikirim. Tunggu confirmed lalu Verify.")}catch(e){setErr(e instanceof Error?e.message:"Transaksi gagal.")}finally{setBusy("")}}
 async function verify(id:Id){setBusy(id);setErr("");try{const p=await wallet(),r=saved[id];if(!r?.hash)throw Error("Belum ada hash.");const rc=await p.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[r.hash]});if(!rc)throw Error("Receipt belum tersedia.");if(rc.status!=="0x1"&&rc.status!=="0x01")throw Error("Transaksi gagal on-chain.");const ad=STEPS.find(s=>s.id===id)?.kind==="deploy"?rc.contractAddress:target(id);if(!valid(ad))throw Error("Address hasil tidak valid.");const code=await p.request<string>({method:"eth_getCode",params:[ad,"latest"]});if(!code||code==="0x")throw Error("Bytecode tidak ditemukan.");const n={...saved,[id]:{hash:r.hash,address:ad}};write(n);setSaved(n);setMsg("Verified on-chain.")}catch(e){setErr(e instanceof Error?e.message:"Verify gagal.")}finally{setBusy("")}}
 const auth=account.toLowerCase()===OWNER.toLowerCase(),correct=chain.toLowerCase()===CHAIN;
 const complete=STEPS.every(s=>Boolean(saved[s.id]?.address));
 const exportText=complete?JSON.stringify({
  rewardAutomationController:a.controller,
  rewardDistributorFactoryV3:a.reward,
  assetVaultFactoryV3:a.vault,
  feeRouterFactoryV3:a.router,
  swapExecutorV3:a.executor,
  protocolLauncherV3:a.launcher,
  keeper
 },null,2):"";
 return <><Nav/><main className="page-shell"><section className="hero compact"><div className="eyebrow">REWARD AUTOMATION / V3</div><h1>Keeper-safe reward automation</h1><p>Stack terisolasi. V2 tidak diubah dan SwapExecutor V3 tetap paused.</p></section>
 <section className="panel"><h2>Keeper wallet</h2><p className="muted">Masukkan address wallet khusus automation. Jangan gunakan private key owner di server.</p><input value={keeper} onChange={e=>setKeeper(e.target.value.trim())} placeholder="0x... keeper address" disabled={Boolean(saved.controller?.hash)}/></section>
 <section className="panel"><h2>Wallet guard</h2><p>Owner: <code>{OWNER}</code></p><p>Connected: <code>{account||"not connected"}</code> · chain <code>{chain||"-"}</code></p>{!account&&<button className="primary" onClick={async()=>{const p=getInjectedProvider();if(p){await p.request({method:"eth_requestAccounts"});await refresh()}}}>Connect wallet</button>}{auth&&correct?<p className="success">Wallet dan chain benar.</p>:account&&<p className="error">Gunakan owner Routy di Robinhood Chain.</p>}</section>
 {STEPS.map((s,i)=>{const r=saved[s.id];return <section className="panel" key={s.id}><div className="eyebrow">STEP {i+1}</div><h2>{s.title}</h2>{r?.hash?(r.address?<p className="success">Verified: <code>{r.address}</code></p>:<button className="primary" disabled={!!busy} onClick={()=>verify(s.id)}>Verify receipt</button>):<button className="primary" disabled={!!busy||!ready(i)||!auth||!correct||(s.id==="controller"&&!valid(keeper))} onClick={()=>submit(s.id,i)}>{busy===s.id?"Awaiting wallet…":ready(i)?"Submit transaction":"Locked — verify previous step"}</button>}</section>})}
 {complete&&<section className="panel"><h2>V3 deployment export</h2><p className="success">Semua step verified. Copy konfigurasi ini agar address V3 dapat dipasang ke aplikasi tanpa menebak address dari screenshot.</p><textarea readOnly value={exportText} rows={10}/><button className="primary" onClick={()=>navigator.clipboard.writeText(exportText)}>Copy V3 configuration</button></section>}
 <section className="panel"><h2>Activation lock</h2><p>Wizard tidak membuka SwapExecutor dan tidak membuka distributor. Aktivasi dilakukan setelah route test dan keeper service siap.</p></section>{msg&&<p className="success">{msg}</p>}{err&&<p className="error">{err}</p>}</main></>
}