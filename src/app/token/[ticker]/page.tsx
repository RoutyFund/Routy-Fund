"use client";
import {useMemo} from "react";
import {useParams} from "next/navigation";
import Nav from "@/components/Nav";
import DataNotice from "@/components/DataNotice";
import {useApiResource} from "@/lib/use-api-resource";
import TokenLogo from "@/components/TokenLogo";
type Launch={token:string;name:string;symbol:string;creator:string;targetAsset:string;targetSymbol:string;targetName:string;quoteToken:string;vault:string;router:string;distributor:string;policy:number;ponsPhase:number|null;creatorTaxBps:number|null;createdAt:number|null;blockNumber:number;transactionHash:string};
const policies=["Weighted raffle","Equal lottery","Pro-rata"];
const short=(v:string)=>v?v.slice(0,8)+"…"+v.slice(-6):"—";
export default function Token(){
 const params=useParams<{ticker:string}>();const key=params.ticker||"";
 const resource=useApiResource<{launches:Launch[]}>("/api/routy-launches");
 const data=useMemo(()=>resource.data?.launches.find(row=>row.token.toLowerCase()===key.toLowerCase()||row.symbol.toLowerCase()===key.toLowerCase())||null,[resource.data,key]);
 const loaded=!resource.loading&&!resource.error;
 const title=data?"$"+data.symbol:key.toUpperCase();
 return <main className="shell"><Nav/><div className="wrap console-page">
  <header className="page-head"><div className="page-head-copy"><TokenLogo token={data?.token||(/^0x[0-9a-fA-F]{40}$/.test(key)?key:undefined)} symbol={data?.symbol||key} size={58} className="token-detail-logo"/><span className="eyebrow">Routy route / onchain</span><h1>{title}.</h1><p className="lead">{data?data.name+" routes creator-fee flow toward "+data.targetSymbol+" through a verified Routy vault.":"Resolving this Routy route from Robinhood Chain."}</p></div><span className="pill">{loaded?(data?"Provisioned":"Not indexed"):"Syncing"}</span></header><DataNotice error={resource.error} retry={resource.reload}/>
  <div className="proof-grid"><article className="proof-card"><span className="micro">TARGET</span><strong>{data?data.targetSymbol:"—"}</strong><p>{data?data.targetName:"Awaiting route data"}</p></article><article className="proof-card"><span className="micro">POLICY</span><strong>{data?policies[data.policy]||"—":"—"}</strong><p>Community reward mode</p></article><article className="proof-card"><span className="micro">CREATOR TAX</span><strong>{data?.creatorTaxBps!=null?(data.creatorTaxBps/100).toFixed(2)+"%":"—"}</strong><p>Pons launch configuration</p></article><article className="proof-card"><span className="micro">NETWORK</span><strong>4663</strong><p>Robinhood Chain</p></article></div>
  {data?<><section className="section"><div className="section-head"><div><span className="micro">ROUTE STATE</span><h2>Verified deployment.</h2></div><a className="secondary" target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/tx/"+data.transactionHash}>Provision tx ↗</a></div><div className="terminal-detail-grid">
   <div><span>TOKEN CONTRACT</span><code title={data.token}>{short(data.token)}</code></div><div><span>CREATOR</span><code title={data.creator}>{short(data.creator)}</code></div><div><span>TARGET ASSET</span><b>{data.targetSymbol}</b><code title={data.targetAsset}>{short(data.targetAsset)}</code></div><div><span>QUOTE TOKEN</span><b>USDG</b><code title={data.quoteToken}>{short(data.quoteToken)}</code></div><div><span>ASSET VAULT</span><code title={data.vault}>{short(data.vault)}</code></div><div><span>FEE ROUTER</span><code title={data.router}>{short(data.router)}</code></div><div><span>REWARD DISTRIBUTOR</span><code title={data.distributor}>{short(data.distributor)}</code></div><div><span>PONS PHASE</span><b>{data.ponsPhase??"—"}</b></div><div><span>BLOCK</span><b>{data.blockNumber}</b></div>
  </div></section><section className="section"><div className="section-head"><div><span className="micro">ROUTE ACTIVITY</span><h2>Provisioning event.</h2></div></div><a className="terminal-event-row" target="_blank" rel="noreferrer" href={"https://robinhoodchain.blockscout.com/tx/"+data.transactionHash}><span>{data.createdAt?new Date(data.createdAt*1000).toLocaleString():"ONCHAIN"}</span><b>ROUTE_PROVISIONED</b><span>{"$"+data.symbol+" → "+data.targetSymbol}</span><code>{short(data.transactionHash)}</code></a></section></>:loaded?<section className="section"><div className="empty-state"><h3>Route not found.</h3><p className="muted">Only tokens successfully provisioned through Routy Fund are shown here.</p><a className="secondary" href="/explore">← Explore Routy tokens</a></div></section>:null}
 </div></main>
}