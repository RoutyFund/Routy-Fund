import Image from "next/image";
import Link from "next/link";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

export default function TerminalFooter(){
 const year=new Date().getUTCFullYear();
 return <footer className="terminal-footer">
  <div className="terminal-footer-cta">
   <div className="terminal-footer-prompt"><span>routy@fund:~$</span><b>route --creator-fees --rewards</b><i>█</i></div>
   <div className="terminal-footer-copy">
    <div><span className="micro">Routy Fund</span><h2>Route creator fees into verified markets.</h2><p>Launch through Routy. Automatic setup connects creator fees to the selected Stock Token market and holder reward policy.</p></div>
    <div className="terminal-footer-actions"><Link className="primary" href="/launch">Launch a token</Link><Link className="secondary" href="/explore">Explore markets</Link></div>
   </div>
   <div className="terminal-footer-stats">
    <div><span>NETWORK</span><b>RH 4663</b></div><div><span>MARKETS</span><b>{EXECUTABLE_ROUTES.length} VERIFIED</b></div><div><span>QUOTE</span><b>USDG</b></div><div><span>CUSTODY</span><b>NON-CUSTODIAL</b></div>
   </div>
  </div>
  <div className="terminal-footer-main">
   <div className="terminal-footer-brand"><Image className="logo-img" src="/logo.png" alt="" width={40} height={40}/><div><b>routy.</b><span>Creator fees, routed into Stock Tokens</span></div></div>
   <div className="terminal-footer-links">
    <div><span>PROTOCOL</span><Link href="/explore">Explore</Link><Link href="/assets">Assets</Link><Link href="/rewards">Rewards</Link></div>
    <div><span>DATA</span><Link href="/analytics">Analytics</Link><Link href="/activity">Activity</Link><Link href="/portfolio">Portfolio</Link></div>
    <div><span>RESOURCES</span><Link href="/docs">Docs</Link><Link href="/docs/security">Security</Link><Link href="/docs/faq">FAQ</Link><Link href="/docs/risk">Risk disclosure</Link></div><div><span>OPERATE</span><Link href="/launch">Launch</Link><Link href="/deploy/release">Release status</Link><a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">Explorer ↗</a></div>
   </div>
  </div>
  <div className="terminal-footer-bottom">
   <span>© {year} Routy Fund</span>
   <span>Stock Tokens provide tokenized economic exposure and are not direct ownership of underlying shares.</span>
   <span className="terminal-footer-live"><i/> RH CHAIN 4663</span>
  </div>
 </footer>
}
