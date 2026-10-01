const assets = [
  { symbol: "AAPL", name: "Apple", price: "$—", routed: "0 ETH" },
  { symbol: "TSLA", name: "Tesla", price: "$—", routed: "0 ETH" },
  { symbol: "NVDA", name: "NVIDIA", price: "$—", routed: "0 ETH" },
];

export default function Home() {
  return <main className="shell">
    <nav className="nav">
      <a className="brand" href="/"><span className="logo">R</span><span>Routy</span></a>
      <div className="navlinks">
        <a href="#explore">Explore</a><a href="#assets">Assets</a><a href="#how">How it works</a><a href="#activity">Activity</a>
      </div>
      <button className="wallet">Connect wallet</button>
    </nav>

    <div className="wrap">
      <section className="hero">
        <div>
          <span className="kicker">Built for Robinhood Chain</span>
          <h1>Trade. Route. Reward.</h1>
          <p>Launch a token, route creator fees into canonical Robinhood Stock Tokens, and return purchased assets to your community through transparent onchain rewards.</p>
          <div className="actions"><a className="primary" href="/launch">Launch token</a><a className="secondary" href="#assets">Explore assets</a></div>
        </div>
        <div className="metric-card">
          <span className="muted">Protocol routing model</span><strong>80 / 20</strong>
          <p>80% of routed creator fees target the selected asset vault. 20% goes to protocol treasury. Parameters remain explicit and auditable.</p>
        </div>
      </section>

      <section className="section" id="assets">
        <div className="section-head"><div><span className="muted">Canonical registry</span><h2>Stock token assets</h2></div><span className="pill">Robinhood Chain · 4663</span></div>
        <div className="grid">
          {assets.map((asset)=><article className="card" key={asset.symbol}>
            <div className="card-top"><div className="asset"><div className="asset-logo">{asset.symbol[0]}</div><div><b>{asset.symbol}</b><div className="muted">{asset.name}</div></div></div><span className="pill">Active</span></div>
            <div className="card-stats"><div className="stat"><span className="muted">Price</span><b>{asset.price}</b></div><div className="stat"><span className="muted">Fees routed</span><b>{asset.routed}</b></div></div>
          </article>)}
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head"><div><span className="muted">Protocol flow</span><h2>From trading activity to holder rewards</h2></div></div>
        <div className="flow">
          <div className="flow-step"><span>01 · Launch</span><b>Create through Pons V2</b></div>
          <div className="flow-step"><span>02 · Route</span><b>Harvest creator fees</b></div>
          <div className="flow-step"><span>03 · Acquire</span><b>Buy selected asset</b></div>
          <div className="flow-step"><span>04 · Reward</span><b>Distribute to holders</b></div>
        </div>
      </section>
    </div>
    <footer className="footer">Routy · routy.fund · Robinhood Stock Tokens are tokenized debt securities and do not represent direct ownership of the underlying shares.</footer>
  </main>
}
