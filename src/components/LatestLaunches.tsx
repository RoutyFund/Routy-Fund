"use client";
import TokenLogo from "@/components/TokenLogo";
import {useApiResource} from "@/lib/use-api-resource";

type Launch={
 token:string;name:string;symbol:string;logo?:string|null;
 targetSymbol:string;targetName:string;policy:number;createdAt:number|null;
};

const policies=["Weighted raffle","Equal lottery","Pro-rata"];
const EMPTY:Launch[]=[];

export default function LatestLaunches(){
 const resource=useApiResource<{launches:Launch[]}>("/api/routy-launches");
 const rows=(resource.data?.launches||EMPTY).slice(0,6);
 const loaded=!resource.loading&&!resource.error;

 return <section className="terminal-window latest-launches">
  <div className="terminal-window-head">
   <span>Latest Routy launches</span>
   <a href="/explore">View all →</a>
  </div>
  {rows.length?<div className="latest-launch-grid">
   {rows.map(l=><a className="latest-launch-card" href={"/token/"+l.token} key={l.token}>
    <div className="latest-launch-token">
     <TokenLogo src={l.logo||undefined} token={l.token} symbol={l.symbol} size={42}/>
     <div><b>{"$"+l.symbol}</b><span>{l.name}</span></div>
    </div>
    <div className="latest-launch-route">
     <span>ROUTE</span>
     <div><TokenLogo src={"/api/company-logo?symbol="+l.targetSymbol} symbol={l.targetSymbol} size={24}/><b>→ {l.targetSymbol}</b></div>
    </div>
    <div className="latest-launch-meta">
     <span>{policies[l.policy]||"Reward policy"}</span>
     <strong>● PROVISIONED</strong>
    </div>
   </a>)}
  </div>:<div className="empty-state latest-launch-empty">
   <span className="micro">{resource.error?"LIVE DATA UNAVAILABLE":loaded?"NO ROUTY LAUNCHES YET":"SYNCING CHAIN"}</span>
   <h3>{resource.error?"Launch feed is temporarily unavailable":loaded?"The first Routy launch will appear here":"Reading latest launches"}</h3>
   <p className="muted">{loaded?"Launch a token and it will automatically appear here after provisioning.":"Fetching verified onchain route events."}</p>
   {loaded&&!resource.error&&<a className="secondary" href="/launch">Launch first token →</a>}
  </div>}
 </section>
}
