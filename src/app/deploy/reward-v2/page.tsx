"use client";

import Nav from "@/components/Nav";
import {useEffect,useState} from "react";
import {encodeDeployData,encodeFunctionData,isAddress,type Address,type Hex} from "viem";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {getInjectedProvider,type EthereumTransactionReceipt} from "@/lib/ethereum-provider";

const OWNER="0x866d5D863381efe9e10cCb2E44f388611F781212" as Address;
const CHAIN_ID="0x1237";
const EXPLORER="https://robinhoodchain.blockscout.com";
const KEY="routy-reward-v2-deployment-v1";

const addressCtor=[{type:"constructor",inputs:[{name:"admin_",type:"address"}]}] as const;
const rewardFactoryCtor=[{type:"constructor",inputs:[{name:"admin_",type:"address"},{name:"publisher_",type:"address"}]}] as const;
const setLauncherAbi=[{type:"function",name:"setLauncher",stateMutability:"nonpayable",inputs:[{name:"launcher_",type:"address"}],outputs:[]}] as const;

type Rec={hash:Hex,address?:Address};
type Saved={rewardFactory?:Rec;vaultFactory?:Rec};
function valid(v:unknown):v is Address{return typeof v==="string"&&isAddress(v,{strict:false})&&v!=="0x0000000000000000000000000000000000000000"}
function read():Saved{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return{}}}
function write(v:Saved){localStorage.setItem(KEY,JSON.stringify(v))}

export default function RewardV2Deploy(){
 const[account,setAccount]=useState("");const[chain,setChain]=useState("");const[saved,setSaved]=useState<Saved>({});
 const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");const[err,setErr]=useState("");
 useEffect(()=>{setSaved(read());refresh().catch(()=>{})},[]);
 async function refresh(){const p=getInjectedProvider();if(!p)return;const[a,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChain(c||"")}
 async function connect(){const p=getInjectedProvider();if(!p){setErr("Wallet EVM tidak ditemukan.");return}await p.request({method:"eth_requestAccounts"});await refresh()}
 async function assertWallet(){const p=getInjectedProvider();if(!p)throw Error("Wallet EVM tidak ditemukan.");const[a,c]=await Promise.all([p.request<string[]>({method:"eth_accounts"}),p.request<string>({method:"eth_chainId"})]);setAccount(a?.[0]||"");setChain(c||"");if(a?.[0]?.toLowerCase()!==OWNER.toLowerCase())throw Error("Gunakan wallet owner Routy.");if(c?.toLowerCase()!==CHAIN_ID)throw Error("Gunakan Robinhood Chain (4663).");return p}
 async function deploy(kind:"rewardFactory"|"vaultFactory"){
  setBusy(kind);setErr("");setMsg("");
  try{
   const p=await assertWallet();if(saved[kind]?.hash)throw Error("Transaksi langkah ini sudah tersimpan. Verifikasi receipt; jangan kirim ulang.");
   const bytecode=DEPLOY_BYTECODE[kind==="rewardFactory"?"RewardDistributorFactory":"AssetVaultV2Factory"] as Hex;
   if(!bytecode||bytecode==="0x")throw Error("Bytecode Reward V2 belum tersedia dari CI.");
   const data=kind==="rewardFactory"
    ?encodeDeployData({bytecode,abi:rewardFactoryCtor,args:[OWNER,OWNER]})
    :encodeDeployData({bytecode,abi:addressCtor,args:[OWNER]});
   const hash=await p.request<Hex>({method:"eth_sendTransaction",params:[{from:OWNER,data,value:"0x0"}]});
   const n={...saved,[kind]:{hash}};write(n);setSaved(n);setMsg("Transaksi dikirim. Tunggu konfirmasi lalu tekan Verify.");
  }catch(e){setErr(e instanceof Error?e.message:"Transaksi gagal.")}finally{setBusy("")}
 }
 async function verify(kind:"rewardFactory"|"vaultFactory"){
  setBusy(kind+"verify");setErr("");setMsg("");
  try{
   const p=await assertWallet();const r=saved[kind];if(!r?.hash)throw Error("Belum ada transaction hash.");
   const receipt=await p.request<EthereumTransactionReceipt|null>({method:"eth_getTransactionReceipt",params:[r.hash]});
   if(!receipt)throw Error("Receipt belum tersedia.");if(receipt.status!=="0x1"&&receipt.status!=="0x01")throw Error("Transaksi gagal on-chain.");
   if(!valid(receipt.contractAddress))throw Error("Contract address tidak valid.");
   const code=await p.request<string>({method:"eth_getCode",params:[receipt.contractAddress,"latest"]});if(!code||code==="0x")throw Error("Bytecode on-chain tidak ditemukan.");
   const n={...saved,[kind]:{hash:r.hash,address:receipt.contractAddress}};write(n);setSaved(n);setMsg("Contract terverifikasi on-chain.");
  }catch(e){setErr(e instanceof Error?e.message:"Verifikasi gagal.")}finally{setBusy("")}
 }
 return <><Nav/><main className="page-shell"><section className="hero compact"><div className="eyebrow">REWARD V2 / SAFE DEPLOY</div><h1>Reward automation deployment</h1><p>Deploy hanya factory Reward V2. Tidak mengubah deployment V1, tidak mengaktifkan swap, dan tidak memindahkan aset. Factory launcher tetap unset sampai arsitektur V2 launcher/executor siap.</p></section>
 <section className="panel"><h2>Wallet guard</h2><p>Owner: <code>{OWNER}</code></p><p>Connected: <code>{account||"not connected"}</code> · chain <code>{chain||"-"}</code></p>{!account&&<button onClick={connect}>Connect wallet</button>}<p className="muted">Kedua factory menggunakan owner sebagai admin; RewardDistributorFactory juga menggunakan owner sebagai publisher. Distributor yang dibuat nanti tetap paused by default.</p></section>
 {(["rewardFactory","vaultFactory"] as const).map((k,i)=>{const r=saved[k];return <section className="panel" key={k}><div className="eyebrow">STEP {i+1}</div><h2>{k==="rewardFactory"?"Deploy RewardDistributorFactory":"Deploy AssetVaultV2Factory"}</h2>{r?.hash?<><p>Tx: <a href={EXPLORER+"/tx/"+r.hash} target="_blank">{r.hash}</a></p>{r.address?<p>Verified: <code>{r.address}</code></p>:<button disabled={!!busy} onClick={()=>verify(k)}>Verify receipt</button>}</>:<button disabled={!!busy} onClick={()=>deploy(k)}>{busy===k?"Awaiting wallet…":"Deploy"}</button>}</section>})}
 <section className="panel"><h2>Activation lock</h2><p>SetLauncher/activation sengaja tidak tersedia di wizard ini. Production SwapExecutor V1 terikat pada launcher V1, jadi Reward V2 tidak boleh diaktifkan sampai jalur V2 kompatibel selesai dan diuji.</p></section>
 {msg&&<p className="success">{msg}</p>}{err&&<p className="error">{err}</p>}</main></>
}
