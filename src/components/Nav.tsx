"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInjectedProvider } from "@/lib/ethereum-provider";

export default function Nav() {
  const [account,setAccount]=useState("");
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    const provider=getInjectedProvider();
    const sync=()=>provider?.request<string[]>({method:"eth_accounts"}).then(a=>setAccount(a?.[0]||"")).catch(()=>{});
    const timer=window.setTimeout(sync,0);
    provider?.on?.("accountsChanged",sync);
    return()=>{window.clearTimeout(timer);provider?.removeListener?.("accountsChanged",sync)};
  },[]);

  async function connect(){
    const provider=getInjectedProvider();
    if(!provider){window.alert("Install a compatible EVM wallet.");return}
    try{
      const accounts=await provider.request<string[]>({method:"eth_requestAccounts"});
      try{await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1237"}]})}
      catch{
        try{
          await provider.request({method:"wallet_addEthereumChain",params:[{
            chainId:"0x1237",
            chainName:"Robinhood Chain",
            nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
            rpcUrls:["https://rpc.mainnet.chain.robinhood.com"],
            blockExplorerUrls:["https://robinhoodchain.blockscout.com"]
          }]})
        }catch{}
      }
      setAccount(accounts?.[0]||"");
    }catch{}
  }

  const links=[["/explore","Explore"],["/assets","Assets"],["/rewards","Rewards"],["/analytics","Analytics"],["/activity","Activity"],["/portfolio","Portfolio"]];

  return <nav className="nav">
    <Link className="brand" href="/"><span className="logo">R</span><span>routy.</span></Link>
    <div className={"navlinks "+(open?"navlinks-open":"")}>
      {links.map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{label}</Link>)}
    </div>
    <div className="nav-actions">
      <Link className="secondary" href="/launch">Launch</Link>
      <button className="menu" aria-label="Toggle navigation" onClick={()=>setOpen(v=>!v)}>Menu</button>
      <button className="wallet" onClick={connect}>{account ? account.slice(0,6)+"…"+account.slice(-4) : "Connect"}</button>
    </div>
  </nav>;
}
