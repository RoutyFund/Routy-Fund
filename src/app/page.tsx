import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav";
import TokenLogo from "@/components/TokenLogo";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

const markets=EXECUTABLE_ROUTES.map(r=>[r.symbol,r.name,"VERIFIED",r.quoteSymbol,String(r.poolKey.fee),String(r.poolKey.tickSpacing)]);

export default function Home(){
 return <main className="shell"><Nav/><div className="wrap terminal-home">
  <section className="hero-pro" aria-labelledby="hero-title">
   <div>
    <span className="hero-pill"><i/>Live on Robinhood Chain</span>
    <h1 id="hero-title">Route creator fees into <em>Stock Tokens.</em></h1>
    <p className="hero-lead">Launch a token through Routy and its creator fees are routed into a verified Stock Token market. Rewards go straight to your holders, with every route pinned and non-custodial.</p>
    <div className="hero-actions"><Link className="primary" href="/launch">Launch a token</Link><Link className="secondary" href="/explore">Explore markets</Link></div>
    <div className="hero-trust"><span>Non-custodial</span><span>Verified routes only</span><span>Pushed to holder wallets</span></div>
   </div>
   <div className="hero-art" aria-hidden="true">
    <Image className="hero-logo" src="/logo.png" alt="" width={300} height={300} priority/>
    <div className="hero-chip c1"><b>80%</b><span>of fees fund the reward vault</span></div>
    <div className="hero-chip c2"><b>{EXECUTABLE_ROUTES.length}</b><span>verified markets</span></div>
    <div className="hero-chip c3"><b>USDG</b><span>quote asset</span></div>
   </div>
  </section>

  <div className="stat-strip">
   <div><span>Network</span><b>RH 4663</b></div>
   <div><span>Verified markets</span><b>{EXECUTABLE_ROUTES.length}</b></div>
   <div><span>Fee split</span><b>80 / 20</b></div>
   <div><span>Custody</span><b>Non-custodial</b></div>
  </div>

  <section className="terminal-dashboard">
   <div className="terminal-main">
    <div className="terminal-window">
     <div className="terminal-window-head"><span>Verified markets</span><span>Live catalog</span></div>
     <div className="terminal-table terminal-table-head"><span>Symbol</span><span>Asset</span><span>Status</span><span>Pair</span><span>Fee</span><span>Tick</span></div>
     {markets.map(([symbol,name,status,pair,fee,tick])=><a href="/assets" className="terminal-table" key={symbol}>
      <strong className="terminal-market-symbol"><TokenLogo src={"/api/company-logo?symbol="+symbol} symbol={symbol} size={30}/><span>{symbol}</span></strong><span>{name}</span><span className="terminal-ok">● {status}</span><span>{pair}</span><span>{fee}</span><span>{tick}</span>
     </a>)}
    </div>

    <div className="terminal-window">
     <div className="terminal-window-head"><span>How Routy works</span><span>Fee to reward</span></div>
     <div className="terminal-pipeline">
      <div><span>01</span><b>Launch</b><small>Pons V2</small></div><i>→</i>
      <div><span>02</span><b>Harvest</b><small>Creator fees</small></div><i>→</i>
      <div><span>03</span><b>Route</b><small>80% / 20%</small></div><i>→</i>
      <div><span>04</span><b>Acquire</b><small>Stock Token</small></div><i>→</i>
      <div><span>05</span><b>Reward</b><small>Community</small></div>
     </div>
    </div>

    <div className="terminal-grid-2">
     <div className="terminal-window">
      <div className="terminal-window-head"><span>Execution guards</span><span>Security</span></div>
      <div className="terminal-log">
       <p><time>[OK]</time><span>AssetRegistry</span><b>approval required</b></p>
       <p><time>[OK]</time><span>OracleRegistry</span><b>fresh feeds required</b></p>
       <p><time>[OK]</time><span>PoolKey catalog</span><b>{EXECUTABLE_ROUTES.length} pinned routes</b></p>
       <p><time>[OK]</time><span>SwapExecutor</span><b>guarded route execution</b></p>
      </div>
     </div>
     <div className="terminal-window">
      <div className="terminal-window-head"><span>Reward modes</span><span>Policy</span></div>
      <div className="terminal-log">
       <p><time>00</time><span>Weighted raffle</span><b>Automatic push</b></p>
       <p><time>01</time><span>Equal lottery</span><b>Automatic push</b></p>
       <p><time>02</time><span>Pro-rata</span><b>Automatic push</b></p>
      </div>
     </div>
    </div>
   </div>

   <aside className="terminal-sidebar">
    <div className="terminal-window">
     <div className="terminal-window-head"><span>Fee allocation</span><span>Per harvest</span></div>
     <div className="terminal-allocation"><strong>80%</strong><span>ASSET VAULT</span><div><i/></div><strong>20%</strong><span>TREASURY</span></div>
    </div>

    <div className="terminal-window terminal-actions-panel">
     <div className="terminal-window-head"><span>Quick actions</span><span>Go to</span></div>
     <a href="/launch">Launch a token <b>→</b></a>
     <a href="/explore">Explore markets <b>→</b></a>
     <a href="/portfolio">View portfolio <b>→</b></a>
     <a href="/analytics">Protocol analytics <b>→</b></a>
    </div>
   </aside>
  </section>

  <div className="terminal-bottomline"><span>Routy Fund / Robinhood Chain</span><span>Stock Tokens provide tokenized economic exposure and are not direct ownership of underlying shares.</span></div>
 </div></main>
}
