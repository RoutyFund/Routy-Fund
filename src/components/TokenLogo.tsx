"use client";
import {useEffect,useState} from "react";
import Image from "next/image";

export function stockTokenLogo(address?:string){
 return address?("https://cdn.robinhood.com/ncw_assets/logos/"+address.toLowerCase()+".png"):"";
}
function displayUrl(value?:string){
 if(!value)return "";
 const v=value.trim();
 if(v.startsWith("ipfs://"))return "https://ipfs.io/ipfs/"+v.slice(7).replace(/^ipfs\//,"");
 return v;
}
export default function TokenLogo({src,token,symbol,size=38,className=""}:{src?:string;token?:string;symbol?:string;size?:number;className?:string}){
 const[dynamicLogo,setDynamicLogo]=useState({token:"",url:""});
 const[failedFor,setFailedFor]=useState<{key:string;url:string}>({key:"",url:""});
 useEffect(()=>{
  if(src||!token)return;
  let live=true;
  fetch("/api/token-logo?token="+encodeURIComponent(token)).then(r=>r.json()).then(d=>{if(live&&d.logo)setDynamicLogo({token,url:d.logo})}).catch(()=>{});
  return()=>{live=false};
 },[src,token]);
 const resolved=displayUrl(src||(dynamicLogo.token===token?dynamicLogo.url:""));
 const fallback=(symbol?.trim()?.[0]||"R").toUpperCase();
 const renderKey=(src||"")+"|"+(token||"");
 if(!resolved||(failedFor.key===renderKey&&failedFor.url===resolved))return <span className={"token-logo token-logo-fallback "+className} style={{width:size,height:size}}>{fallback}</span>;
 return <span className={"token-logo "+className} style={{width:size,height:size}}><Image unoptimized src={resolved} width={size} height={size} alt={(symbol||"Token")+" logo"} onError={()=>setFailedFor({key:renderKey,url:resolved})}/></span>;
}
