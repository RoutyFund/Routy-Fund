"use client";
import {useEffect,useMemo,useState} from "react";

export type TokenMarket={token:string;priceUsd:string|null;marketCapUsd:string|null;source:string;phase:number|null;updatedAt:number};

export function useMarketData(tokens:string[],refreshMs=3000){
 const key=useMemo(()=>[...new Set(tokens.map(x=>x.toLowerCase()).filter(Boolean))].join(","),[tokens]);
 const[data,setData]=useState<Record<string,TokenMarket>>({});
 useEffect(()=>{
  if(!key){setData({});return}
  let stopped=false;let timer:number|undefined;let controller:AbortController|undefined;
  async function load(){
   controller?.abort();controller=new AbortController();
   try{
    const response=await fetch("/api/market-data?tokens="+encodeURIComponent(key),{cache:"no-store",signal:controller.signal});
    if(response.ok){
     const json=await response.json() as {markets?:TokenMarket[]};
     if(!stopped)setData(Object.fromEntries((json.markets||[]).map(row=>[row.token.toLowerCase(),row])));
    }
   }catch{}
   if(!stopped)timer=window.setTimeout(()=>void load(),refreshMs);
  }
  void load();
  return()=>{stopped=true;controller?.abort();if(timer!==undefined)window.clearTimeout(timer)};
 },[key,refreshMs]);
 return data;
}
