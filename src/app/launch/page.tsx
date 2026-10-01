export default function LaunchPage() {
  return <main className="shell"><nav className="nav"><a className="brand" href="/"><span className="logo">R</span><span>Routy</span></a><a className="wallet" href="/">Back home</a></nav>
  <div className="wrap"><span className="kicker">Launch on Routy</span><h1 style={{fontSize:"64px"}}>Create a routed token.</h1><p className="muted">Launch UI scaffold is ready for Pons V2 factory integration, canonical Robinhood asset selection, immutable routing policy, and creator tax configuration.</p>
  <div className="grid section">
    <div className="card"><b>1. Token</b><p className="muted">Logo, name, ticker, description, socials.</p></div>
    <div className="card"><b>2. Target asset</b><p className="muted">Choose one canonical Robinhood Chain Stock Token.</p></div>
    <div className="card"><b>3. Reward policy</b><p className="muted">Weighted raffle, equal lottery, or pro-rata distribution.</p></div>
  </div></div></main>;
}
