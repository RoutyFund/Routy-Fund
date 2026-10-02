"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import { useEffect, useState } from "react";
import { getInjectedProvider, walletErrorCode, walletErrorMessage } from "@/lib/ethereum-provider";
import { EXECUTABLE_ROUTES } from "@/lib/route-catalog";

export default function Nav() {
  const pathname=usePathname();
  const [account,setAccount]=useState("");
  const [chainId,setChainId]=useState("");
  const [error,setError]=useState("");
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    const provider=getInjectedProvider();
    const sync=async()=>{if(!provider)return;try{const [accounts,chain]=await Promise.all([provider.request<string[]>({method:"eth_accounts"}),provider.request<string>({method:"eth_chainId"})]);setAccount(accounts?.[0]||"");setChainId(chain)}catch{}};
    const timer=window.setTimeout(sync,0);
    provider?.on?.("accountsChanged",sync);
    provider?.on?.("chainChanged",sync);
    return()=>{window.clearTimeout(timer);provider?.removeListener?.("accountsChanged",sync);provider?.removeListener?.("chainChanged",sync)};
  },[]);

  async function connect(){
    const provider=getInjectedProvider();
    if(!provider){setError("Open Routy in a compatible EVM wallet browser to connect.");return}
    setError("");
    try{
      const accounts=await provider.request<string[]>({method:"eth_requestAccounts"});
      try{await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1237"}]})}
      catch(cause){
        if(walletErrorCode(cause)!==4902&&walletErrorCode(cause)!=="4902")throw cause;
          await provider.request({method:"wallet_addEthereumChain",params:[{
            chainId:"0x1237",
            chainName:"Robinhood Chain",
            nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
            rpcUrls:["https://rpc.mainnet.chain.robinhood.com"],
            blockExplorerUrls:["https://robinhoodchain.blockscout.com"]
          }]})
      }
      const chain=await provider.request<string>({method:"eth_chainId"});
      if(BigInt(chain)!==4663n)throw new Error("Switch your wallet to Robinhood Chain (4663).");
      setChainId(chain);
      setAccount(accounts?.[0]||"");
    }catch(cause){setError(walletErrorMessage(cause,"Wallet connection failed."))}
  }

  const links=[["/explore","Explore"],["/assets","Assets"],["/rewards","Rewards"],["/analytics","Analytics"],["/activity","Activity"],["/portfolio","Portfolio"],["/docs","Docs"]];

  return <header className="terminal-header">
    <div className="terminal-statusbar">
      <div className="terminal-status-left">
        <span className="terminal-led"/>
        <span>ROUTY FUND</span>
        <span className="terminal-sep">/</span>
        <span>RH CHAIN 4663</span>
      </div>
      <div className="terminal-status-right">
        <span>{EXECUTABLE_ROUTES.length} VERIFIED ROUTES</span>
        <span className="terminal-sep">/</span>
        <span>NON-CUSTODIAL</span>
      </div>
    </div>
    <nav className="nav">
      <Link className="brand" href="/"><span className="logo">R</span><span>routy.</span><small>fund console</small></Link>
      <div id="routy-navigation" className={"navlinks "+(open?"navlinks-open":"")}>
        {links.map(([href,label])=><Link className={pathname===href||pathname.startsWith(href+"/")?"nav-active":""} key={href} href={href} onClick={()=>setOpen(false)}><span className="nav-prefix">/</span>{label}</Link>)}
      </div>
      <div className="nav-actions">
        <Link className="secondary terminal-launch" href="/launch">+ Launch</Link>
        <button className="menu" aria-label="Toggle navigation" aria-expanded={open} aria-controls="routy-navigation" onClick={()=>setOpen(v=>!v)}>{open?"Close":"Menu"}</button>
        <button className="wallet" onClick={connect}>{account ? chainId&&BigInt(chainId)!==4663n?"Switch network":account.slice(0,6)+"…"+account.slice(-4) : "Connect Wallet"}</button>
      </div>
    </nav>
    {error&&<div className="notice danger" role="alert">{error}<button type="button" className="secondary" onClick={()=>setError("")}>Dismiss</button></div>}
  </header>;
}
