"use client";
import {useEffect,useState} from "react";

type Health={protocolConfigured?:boolean;executorReachable?:boolean;executorPaused?:boolean;generation?:string};
type Readiness={ready?:boolean;infrastructureReady?:boolean};

export default function LiveTerminalStatus({marketCount}:{marketCount:number}){
 const[health,setHealth]=useState<Health>({});
 const[ready,setReady]=useState<Readiness>({});
 const[now,setNow]=useState("");
 useEffect(()=>{
  let live=true;
  const tick=()=>setNow(new Date().toLocaleTimeString("en-GB",{hour12:false}));
  const sync=async()=>{
   try{
    const[h,r]=await Promise.all([fetch("/api/health",{cache:"no-store"}),fetch("/api/readiness",{cache:"no-store"})]);
    if(live&&h.ok)setHealth(await h.json());
    if(live&&r.ok)setReady(await r.json());
   }catch{}
  };
  tick();sync();
  const clock=setInterval(tick,1000),poll=setInterval(sync,10000);
  return()=>{live=false;clearInterval(clock);clearInterval(poll)}
 },[]);
 const network=health.executorReachable!==false;
 return <div className="protocol-status-wrap">
  <div className="protocol-livebar"><span><i className="terminal-led"/> LIVE TELEMETRY</span><b>{now||"--:--:--"} UTC+LOCAL</b><em>REFRESH 10S</em></div>
  <div className="protocol-status-grid">
   <div><span><i className="terminal-led"/> NETWORK</span><b>RH 4663</b><small>{network?"ONLINE":"CHECKING"}</small></div>
   <div><span>MARKETS</span><b>{marketCount}</b><small>VERIFIED ROUTES</small></div>
   <div><span>PROTOCOL</span><b>{ready.ready?"READY":"SYNCING"}</b><small>{health.generation?.toUpperCase()||"V5"}</small></div>
   <div><span>EXECUTOR</span><b>{health.executorPaused?"PAUSED":health.executorReachable?"ONLINE":"SYNCING"}</b><small>{ready.infrastructureReady?"INFRA READY":"CHECKING"}</small></div>
  </div>
 </div>
}