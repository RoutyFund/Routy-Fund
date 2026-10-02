"use client";
import Nav from "@/components/Nav";
import {useEffect,useMemo,useState} from "react";
import {encodeDeployData,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {getInjectedProvider,type EthereumTransactionReceipt} from "@/lib/ethereum-provider";

const OWNER="0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const TREASURY=ROUTY_DEPLOYMENT.treasury as Address, REGISTRY=ROUTY_DEPLOYMENT.assetRegistry as Address;
const PONS="0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,ESCROW="0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address;
const CHAIN="0x1237",KEY="routy-v5-deployment-v1";
const routerV5=[{type:"constructor",inputs:[{name:"admin_",type:"address"},{name:"operator_",type:"address"},{name:"escrow_",type:"address"},{name:"treasury_",type:"address"}]}] as const;
const one=[{type:"constructor",inputs:[{name:"admin_",type:"address"}]}] as const;
const controller=[{type:"constructor",inputs:[{name:"owner_",type:"address"},{name:"keeper_",type:"address"}]}] as const;
const reward=[{type:"constructor",inputs:[{name:"admin_",type:"address"},{name:"publisher_",type:"address"}]}] as const;
const launcher=[{type:"constructor",inputs:[{name:"owner_",type:"address"},{name:"operator_",type:"address"},{name:"registry_",type:"address"},{name:"ponsFactory_",type:"address"},{name:"rewardFactory_",type:"address"},{name:"vaultFactory_",type:"address"},{name:"routerFactory_",type:"address"},{name:"executor_",type:"address"}]}] as const;
const setLauncher=[{type:"function",name:"setLauncher",stateMutability:"nonpayable",inputs:[{name:"launcher_",type:"address"}],outputs:[]}] as const;
const transfer=[{type:"function",name:"transferOwnership",stateMutability:"nonpayable",inputs:[{name:"next",type:"address"}],outputs:[]}] as const;
const configure=[{type:"function",name:"configureDependencies",stateMutability:"nonpayable",inputs:[{name:"registry_",type:"address"},{name:"guard_",type:"address"},{name:"quoter_",type:"address"},{name:"adapter_",type:"address"},{name:"deviation_",type:"uint16"}],outputs:[]}] as const;
type Id="controller"|"rewardFactory"|"vaultFactory"|"routerFactory"|"executor"|"launcher"|"bindReward"|"bindVault"|"bindRouter"|"bindExecutor"|"configure"|"handoffExecutor";
type Rec={hash:Hex,address?:Address}; type Saved=Partial<Record<Id,Rec>>;
const STEPS:{id:Id;title:string;kind:"deploy"|"call"}[]=[
{id:"controller",title:"Deploy RewardAutomationController",kind:"deploy"},{id:"rewardFactory",title:"Deploy RewardDistributorFactory V5",kind:"deploy"},{id:"vaultFactory",title:"Deploy AssetVaultV2Factory V5",kind:"deploy"},{id:"routerFactory",title:"Deploy FeeRouterFactory V5 (direct Pons fees)",kind:"deploy"},{id:"executor",title:"Deploy SwapExecutor V5",kind:"deploy"},{id:"launcher",title:"Deploy ProtocolLauncher V5",kind:"deploy"},{id:"bindReward",title:"Bind Reward Factory",kind:"call"},{id:"bindVault",title:"Bind Vault Factory",kind:"call"},{id:"bindRouter",title:"Bind Router Factory",kind:"call"},{id:"bindExecutor",title:"Bind Swap Executor",kind:"call"},{id:"configure",title:"Configure Swap Executor",kind:"call"},{id:"handoffExecutor",title:"Handoff Executor to Operator",kind:"call"}];
const valid=(v:unknown):v is Address=>typeof v==="string"&&isAddress(v,{strict:false})&&v.toLowerCase()!=="0x0000000000000000000000000000000000000000";
const read=():Saved=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}}; const write=(v:Saved)=>localStorage.setItem(KEY,JSON.stringify(v));
export default function Page(){
 const[account,setAccount]=useState(""),[chain,setChain]=useState(""),[saved,setSaved]=useState<Saved>({}),[busy,setBusy]=useState<Id|"">(""),[msg,setMsg]=useState(""),[err,setErr]=useState("");
 useEffect(()=>{const id=window.setTimeout(()=>{setSaved(read());refresh().catch(()=>{})},0);return()=>window.clearTimeout(id)},[]);
 const a=useMemo(()=>({controller:saved.controller?.address,reward:saved.rewardFactory?.address,vault:saved.vaultFactory?.address,router:saved.routerFactory?.address,executor:saved.executor?.address,launcher:saved.launcher?.address}),[saved]);
 async function refresh(){const p=getInjectedProvider();if(!p)return;const[x,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(x?.[0]||"");setChain(c||"")}
 async function wallet(){const p=getInjectedProvider();if(!p)throw Error("EVM wallet not found.");const[x,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);if(x?.[0]?.toLowerCase()!==OWNER.toLowerCase())throw Error("Use the Routy owner wallet.");if(c?.toLowerCase()!==CHAIN)throw Error("Use Robinhood Chain (4663).");return p}
 function target(id:Id){if(id==="bindReward")return a.reward;if(id==="bindVault")return a.vault;if(id==="bindRouter")return a.router;if(["bindExecutor","configure","handoffExecutor"].includes(id))return a.executor}
 function data(id:Id):Hex{
  if(id==="controller")return encodeDeployData({bytecode:DEPLOY_BYTECODE.RewardAutomationController as Hex,abi:controller,args:[OWNER,OWNER]});
  if(id==="rewardFactory"){if(!a.controller)throw Error("Controller missing.");return encodeDeployData({bytecode:DEPLOY_BYTECODE.RewardDistributorFactory as Hex,abi:reward,args:[OWNER,a.controller]})}
  if(id==="vaultFactory")return encodeDeployData({bytecode:DEPLOY_BYTECODE.AssetVaultV2Factory as Hex,abi:one,args:[OWNER]});
  if(id==="routerFactory")return encodeDeployData({bytecode:DEPLOY_BYTECODE.FeeRouterFactoryV5 as Hex,abi:routerV5,args:[OWNER,OWNER,ESCROW,TREASURY]});
  if(id==="executor")return encodeDeployData({bytecode:DEPLOY_BYTECODE.SwapExecutor as Hex,abi:one,args:[OWNER]});
  if(id==="launcher"){if(!a.reward||!a.vault||!a.router||!a.executor)throw Error("Dependencies incomplete.");return encodeDeployData({bytecode:DEPLOY_BYTECODE.ProtocolLauncherV5 as Hex,abi:launcher,args:[OWNER,OWNER,REGISTRY,PONS,a.reward,a.vault,a.router,a.executor]})}
  if(id.startsWith("bind")){if(!a.launcher)throw Error("Launcher missing.");return encodeFunctionData({abi:setLauncher,functionName:"setLauncher",args:[a.launcher]})}
  if(id==="configure")return encodeFunctionData({abi:configure,functionName:"configureDependencies",args:[ROUTY_DEPLOYMENT.oracleRegistry as Address,ROUTY_DEPLOYMENT.oracleGuard as Address,ROUTY_DEPLOYMENT.swapOracleQuoter as Address,ROUTY_DEPLOYMENT.swapRouterAdapter as Address,200]});
  return encodeFunctionData({abi:transfer,functionName:"transferOwnership",args:[OWNER]});
 }
 const ready=(i:number)=>i===0||Boolean(saved[STEPS[i-1].id]?.address);
 async function submit(id:Id,i:number){setBusy(id);setErr("");try{if(!ready(i))throw Error("Verify previous step first.");if(saved[id]?.hash)throw Error("Transaction already saved; verify it.");const p=await wallet(),to=target(id),tx={from:OWNER,...(to?{to}:{}),data:data(id),value:"0x0"};const e=await p.request<Hex>({method:"eth_estimateGas",params:[tx]}),gas=("0x"+(BigInt(e)*125n/100n).toString(16)) as Hex;const hash=await p.request<Hex>({method:"eth_sendTransaction",params:[{...tx,gas}]});const n={...saved,[id]:{hash}};write(n);setSaved(n);setMsg("Submitted. Wait for confirmation then press Verify.")}catch(e){setErr(e instanceof Error?e.message:"Transaction failed.")}finally{setBusy("")}}
 async function verify(id:Id){setBusy(id);setErr("");try{const p=await wallet(),r=saved[id];if(!r?.hash)throw Error("No transaction hash.");const rc=await p.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[r.hash]});if(!rc)throw Error("Receipt not available yet.");if(rc.status!=="0x1"&&rc.status!=="0x01")throw Error("Transaction failed on-chain.");const ad=STEPS.find(s=>s.id===id)?.kind==="deploy"?rc.contractAddress:target(id);if(!valid(ad))throw Error("Result address invalid.");const code=await p.request<string>({method:"eth_getCode",params:[ad,"latest"]});if(!code||code==="0x")throw Error("No bytecode found.");const n={...saved,[id]:{hash:r.hash,address:ad}};write(n);setSaved(n);setMsg("Verified on-chain.")}catch(e){setErr(e instanceof Error?e.message:"Verification failed.")}finally{setBusy("")}}
 const auth=account.toLowerCase()===OWNER.toLowerCase(),correct=chain.toLowerCase()===CHAIN,complete=STEPS.every(s=>Boolean(saved[s.id]?.address));
 const output=complete?JSON.stringify({ROUTY_REWARD_CONTROLLER_V5_ADDRESS:a.controller,ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS:a.router,ROUTY_SWAP_EXECUTOR_V5_ADDRESS:a.executor,ROUTY_LAUNCHER_V5_ADDRESS:a.launcher,rewardDistributorFactoryV5:a.reward,assetVaultFactoryV5:a.vault,operator:OWNER},null,2):"";
 return <><Nav/><main className="page-shell"><section className="hero compact"><div className="eyebrow">ROUTY / V5</div><h1>Production V5 deployment</h1><p>Owner-signed setup for the Routy V5 stack (Pons creator fees go directly to the FeeRouter). Progress is saved after every step, so a deployed contract is never deployed twice. Legacy deployment consoles are retired.</p></section>
 <section className="panel"><h2>Wallet guard</h2><p>Owner/operator: <code>{OWNER}</code></p><p>Connected: <code>{account||"not connected"}</code> · chain <code>{chain||"-"}</code></p>{!account&&<button className="primary" onClick={async()=>{const p=getInjectedProvider();if(p){await p.request({method:"eth_requestAccounts"});await refresh()}}}>Connect wallet</button>}{auth&&correct?<p className="success">Wallet and Robinhood Chain verified.</p>:account&&<p className="error">Use the Routy owner wallet on Robinhood Chain.</p>}</section>
 {STEPS.map((s,i)=>{const r=saved[s.id];return <section className="panel" key={s.id}><div className="eyebrow">STEP {i+1}</div><h2>{s.title}</h2>{r?.hash?(r.address?<p className="success">Verified: <code>{r.address}</code></p>:<button className="primary" disabled={!!busy} onClick={()=>verify(s.id)}>Verify receipt</button>):<button className="primary" disabled={!!busy||!ready(i)||!auth||!correct} onClick={()=>submit(s.id,i)}>{busy===s.id?"Awaiting wallet…":ready(i)?"Submit transaction":"Locked — verify previous step"}</button>}</section>})}
 {complete&&<section className="panel"><h2>V5 environment variables</h2><p className="success">Deployment complete. Copy these into Vercel.</p><textarea readOnly value={output} rows={10}/><button className="primary" onClick={()=>navigator.clipboard.writeText(output)}>Copy V5 environment variables</button></section>}
 {msg&&<p className="success">{msg}</p>}{err&&<p className="error">{err}</p>}</main></>
}