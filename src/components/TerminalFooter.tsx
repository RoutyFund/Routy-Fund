import Link from "next/link";

export default function TerminalFooter(){
 const year=new Date().getUTCFullYear();
 return <footer className="terminal-footer">
  <div className="terminal-footer-cta">
   <div className="terminal-footer-prompt"><span>routy@fund:~$</span><b>start --route</b><i>█</i></div>
   <div className="terminal-footer-copy">
    <div><span className="micro">ROUTY FUND</span><h2>Route creator fees into verified markets.</h2><p>Launch through Pons, provision a Routy vault, and route activity toward verified Stock Token markets on Robinhood Chain.</p></div>
    <div className="terminal-footer-actions"><Link className="primary" href="/launch">+ Launch route</Link><Link className="secondary" href="/explore">Explore Routy</Link></div>
   </div>
   <div className="terminal-footer-stats">
    <div><span>NETWORK</span><b>RH 4663</b></div><div><span>MARKETS</span><b>3 VERIFIED</b></div><div><span>QUOTE</span><b>USDG</b></div><div><span>CUSTODY</span><b>NON-CUSTODIAL</b></div>
   </div>
  </div>
  <div className="terminal-footer-main">
   <div className="terminal-footer-brand"><div className="logo">R</div><div><b>routy.</b><span>Routy Fund protocol console</span></div></div>
   <div className="terminal-footer-links">
    <div><span>PROTOCOL</span><Link href="/explore">Explore</Link><Link href="/assets">Assets</Link><Link href="/rewards">Rewards</Link></div>
    <div><span>DATA</span><Link href="/analytics">Analytics</Link><Link href="/activity">Activity</Link><Link href="/portfolio">Portfolio</Link></div>
    <div><span>OPERATE</span><Link href="/launch">Launch</Link><Link href="/deploy/release">Release status</Link><a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">Explorer ↗</a></div>
   </div>
  </div>
  <div className="terminal-footer-bottom">
   <span>© {year} Routy Fund</span>
   <span>Stock Tokens provide tokenized economic exposure and are not direct ownership of underlying shares.</span>
   <span className="terminal-footer-live"><i/> RH CHAIN ONLINE</span>
  </div>
 </footer>
}
