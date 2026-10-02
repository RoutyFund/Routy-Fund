import Nav from "@/components/Nav";
import TokenLogo from "@/components/TokenLogo";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

const markets=EXECUTABLE_ROUTES.map(r=>[r.symbol,r.name,"READY",r.quoteSymbol,String(r.poolKey.fee),String(r.poolKey.tickSpacing)]);

export default function Home(){
 return <main className="shell"><Nav/><div className="wrap terminal-home">
  <div className="terminal-commandbar"><span className="terminal-prompt">routy@fund:~$</span><span>overview --network robinhood --mode production</span><span className="terminal-cursor">█</span></div>

  <section className="terminal-dashboard">
   <div className="terminal-main">
    <div className="terminal-window">
     <div className="terminal-window-head"><span>MARKET ROUTES</span><span>LIVE CONFIGURATION</span></div>
     <div className="terminal-table terminal-table-head"><span>SYMBOL</span><span>ASSET</span><span>STATUS</span><span>PAIR</span><span>FEE</span><span>TICK</span></div>
     {markets.map(([symbol,name,status,pair,fee,tick])=><a href="/assets" className="terminal-table" key={symbol}>
      <strong className="terminal-market-symbol"><TokenLogo src={"/api/company-logo?symbol="+symbol} symbol={symbol} size={30}/><span>{symbol}</span></strong><span>{name}</span><span className="terminal-ok">● {status}</span><span>{pair}</span><span>{fee}</span><span>{tick}</span>
     </a>)}
    </div>

    <div className="terminal-window">
     <div className="terminal-window-head"><span>PROTOCOL PIPELINE</span><span>ROUTY FUND</span></div>
     <div className="terminal-pipeline">
      <div><span>01</span><b>LAUNCH</b><small>Pons V2</small></div><i>→</i>
      <div><span>02</span><b>HARVEST</b><small>Creator fees</small></div><i>→</i>
      <div><span>03</span><b>ROUTE</b><small>80% / 20%</small></div><i>→</i>
      <div><span>04</span><b>ACQUIRE</b><small>Stock Token</small></div><i>→</i>
      <div><span>05</span><b>REWARD</b><small>Community</small></div>
     </div>
    </div>

    <div className="terminal-grid-2">
     <div className="terminal-window">
      <div className="terminal-window-head"><span>EXECUTION GUARDS</span><span>SECURITY</span></div>
      <div className="terminal-log">
       <p><time>[OK]</time><span>AssetRegistry</span><b>{EXECUTABLE_ROUTES.length} assets approved</b></p>
       <p><time>[OK]</time><span>OracleRegistry</span><b>feeds configured</b></p>
       <p><time>[OK]</time><span>PoolKey verification</span><b>{EXECUTABLE_ROUTES.length} / {EXECUTABLE_ROUTES.length} matched</b></p>
       <p><time>[SAFE]</time><span>SwapExecutor</span><b>paused pre-live-test</b></p>
      </div>
     </div>
     <div className="terminal-window">
      <div className="terminal-window-head"><span>REWARD MODES</span><span>POLICY</span></div>
      <div className="terminal-log">
       <p><time>00</time><span>Weighted raffle</span><b>policy only</b></p>
       <p><time>01</time><span>Equal lottery</span><b>policy only</b></p>
       <p><time>02</time><span>Pro-rata</span><b>policy only</b></p>
      </div>
     </div>
    </div>
   </div>

   <aside className="terminal-sidebar">
    <div className="terminal-window">
     <div className="terminal-window-head"><span>SYSTEM</span><span>PROD</span></div>
     <div className="terminal-kpis">
      <div><span>NETWORK</span><strong>RH 4663</strong></div>
      <div><span>ROUTES</span><strong>{EXECUTABLE_ROUTES.length} / {EXECUTABLE_ROUTES.length}</strong></div>
      <div><span>QUOTE</span><strong>USDG</strong></div>
      <div><span>CUSTODY</span><strong>WALLET</strong></div>
     </div>
    </div>

    <div className="terminal-window">
     <div className="terminal-window-head"><span>ALLOCATION</span><span>FEES</span></div>
     <div className="terminal-allocation"><strong>80%</strong><span>ASSET VAULT</span><div><i/></div><strong>20%</strong><span>TREASURY</span></div>
    </div>

    <div className="terminal-window terminal-actions-panel">
     <div className="terminal-window-head"><span>QUICK ACTIONS</span><span>CMD</span></div>
     <a href="/launch"><span>$</span> launch --new <b>↗</b></a>
     <a href="/explore"><span>$</span> routes --explore <b>↗</b></a>
     <a href="/portfolio"><span>$</span> wallet --portfolio <b>↗</b></a>
     <a href="/analytics"><span>$</span> protocol --analytics <b>↗</b></a>
    </div>
   </aside>
  </section>

  <div className="terminal-bottomline"><span>Routy Fund / Robinhood Chain</span><span>Stock Tokens provide tokenized economic exposure and are not direct ownership of underlying shares.</span></div>
 </div></main>
}
