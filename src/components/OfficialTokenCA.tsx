"use client";
import {useEffect,useState} from "react";

type OfficialTokenResponse={ok:boolean;token:string|null};

export default function OfficialTokenCA(){
 const[token,setToken]=useState<string|null>(null);
 useEffect(()=>{
  let stopped=false;
  let timer:number|undefined;
  async function load(){
   try{
    const response=await fetch("/api/official-token",{cache:"no-store"});
    if(response.ok){
     const data=await response.json() as OfficialTokenResponse;
     if(!stopped)setToken(data.token||null);
    }
   }catch{}
   if(!stopped)timer=window.setTimeout(()=>void load(),15000);
  }
  void load();
  return()=>{stopped=true;if(timer!==undefined)window.clearTimeout(timer)};
 },[]);
 if(!token)return null;
 return <div className="official-ca-bar"><span>CA:</span><code>{token}</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(token)} aria-label="Copy contract address">COPY</button></div>;
}
