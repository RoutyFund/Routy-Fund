"use client";
import {useEffect,useState} from "react";

export function stockTokenLogo(address?:string){
 return address?("https://cdn.robinhood.com/ncw_assets/logos/"+address.toLowerCase()+".png"):"";
}
export default function TokenLogo({src,token,symbol,size=38,className=""}:{src?:string;token?:string;symbol?:string;size?:number;className?:string}){
 const[resolved,setResolved]=useState(src||"");const[failed,setFailed]=useState(false);
 useEffect(()=>{setResolved(src||"");setFailed(false);if(src||!token)return;let live=true;fetch("/api/token-logo?token="+encodeURIComponent(token)).then(r=>r.json()).then(d=>{if(live&&d.logo)setResolved(d.logo)}).catch(()=>{});return()=>{live=false}},[src,token]);
 const fallback=(symbol?.trim()?.[0]||"R").toUpperCase();
 if(!resolved||failed)return <span className={"token-logo token-logo-fallback "+className} style={{width:size,height:size}}>{fallback}</span>;
 return <span className={"token-logo "+className} style={{width:size,height:size}}><img src={resolved} alt={(symbol||"Token")+" logo"} onError={()=>setFailed(true)}/></span>;
}
