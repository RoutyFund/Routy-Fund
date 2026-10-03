import Link from "next/link";
import Nav from "@/components/Nav";
import TokenLogo from "@/components/TokenLogo";
import LatestLaunches from "@/components/LatestLaunches";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import LiveTerminalStatus from "@/components/LiveTerminalStatus";
import OfficialTokenCA from "@/components/OfficialTokenCA";

const markets=EXECUTABLE_ROUTES.map(r=>[r.symbol,r.name,"VERIFIED",r.quoteSymbol,String(r.poolKey.fee),String(r.poolKey.tickSpacing)]);

export default function Home(){
 return <main className="shell"><Nav/><div className="wrap terminal-home">
  <div className="terminal-commandbar"><span className="terminal-prompt">routy@rh-4663:~$</span><span>protocol --overview --live</span><span className="terminal-cursor">█</span></div>

  <OfficialTokenCA/>

  <section className="protocol-console-head">
   <div className="protocol-console-title">
    <span className="micro">[ ROUTY PROTOCOL CONSOLE ]</span>
    <h1 id="hero-title">FEE ROUTING / STOCK TOKEN REWARDS</h1>
    <p>Creator fees → verified Stock Token markets → holder reward distribution.</p>
   </div>
   <div className="protocol-console-actions">
    <Link className="primary" href="/launch">&gt; LAUNCH_ROUTE</Link>
    <Link className="secondary" href="/explore">LIST_MARKETS</Link>
   </div>
  </section>

  <LiveTerminalStatus marketCount={EXECUTABLE_ROUTES.length}/>

  <LatestLaunches/>

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
