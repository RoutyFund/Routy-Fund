"use client";
import {useState} from "react";

export function stockTokenLogo(address?:string){
 return address?("https://cdn.robinhood.com/ncw_assets/logos/"+address.toLowerCase()+".png"):"";
}
export default function TokenLogo({src,symbol,size=38,className=""}:{src?:string;symbol?:string;size?:number;className?:string}){
 const[failed,setFailed]=useState(false);
 const fallback=(symbol?.trim()?.[0]||"R").toUpperCase();
 if(!src||failed)return <span className={"token-logo token-logo-fallback "+className} style={{width:size,height:size}}>{fallback}</span>;
 return <span className={"token-logo "+className} style={{width:size,height:size}}><img src={src} alt={(symbol||"Token")+" logo"} onError={()=>setFailed(true)}/></span>;
}
