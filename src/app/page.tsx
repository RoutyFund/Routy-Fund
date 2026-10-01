import Nav from "@/components/Nav";

const proof = [
  ["AAPL / USDG", "Verified route", "PoolKey + oracle locked"],
  ["80 / 20", "Routing split", "Vault / protocol treasury"],
  ["Robinhood", "Settlement network", "Chain ID 4663"],
];

export default function Home(){
  return <main className="shell">
    <Nav/>
    <div className="ambient ambient-a"/>
    <div className="ambient ambient-b"/>
    <div className="wrap home-wrap">
      <section className="hero premium-hero">
        <div className="hero-copy">
          <div className="eyebrow-row">
            <span className="kicker"><span className="status-dot"/> Built for Robinhood Chain</span>
            <span className="mini-proof">Onchain fee routing</span>
          </div>
          <h1><span>Trade.</span><span>Route.</span><span className="accent-text">Reward.</span></h1>
          <p className="hero-lead">Routy turns creator-fee flow into transparent onchain asset acquisition and community rewards, with every route designed to be auditable from launch to distribution.</p>
          <div className="actions">
            <a className="primary premium-cta" href="/launch">Launch with Routy <span>↗</span></a>
            <a className="secondary premium-cta" href="/explore">Explore protocol</a>
          </div>
          <div className="trust-row">
            <span>Non-custodial routing</span><i/>
            <span>Verified PoolKey</span><i/>
            <span>Oracle guarded</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="route-orbit route-orbit-a"/>
          <div className="route-orbit route-orbit-b"/>
          <div className="premium-panel route-panel">
            <div className="panel-head">
              <div><span className="micro">LIVE CONFIGURATION</span><h3>AAPL / USDG</h3></div>
              <span className="verified-pill">Verified</span>
            </div>
            <div className="route-line">
              <div className="token-disc">R</div>
              <div className="route-track"><span/></div>
              <div className="token-disc token-disc-light">A</div>
            </div>
            <div className="split-grid">
              <div><span>Asset vault</span><strong>80%</strong></div>
              <div><span>Treasury</span><strong>20%</strong></div>
            </div>
            <div className="panel-foot"><span className="status-dot"/> Infrastructure ready · Execution paused for final live test</div>
          </div>
        </div>
      </section>

      <section className="proof-grid">
        {proof.map(([value,label,detail])=><article className="proof-card" key={label}>
          <span className="micro">{label}</span>
          <strong>{value}</strong>
          <p>{detail}</p>
        </article>)}
      </section>

      <section className="section premium-section">
        <div className="section-head">
          <div><span className="micro">PROTOCOL DESIGN</span><h2>Infrastructure that stays legible.</h2></div>
          <p className="section-copy">Routy separates fee capture, asset routing, execution controls and holder rewards so every step can be inspected independently.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card-wide">
            <span className="feature-index">01</span>
            <div><span className="micro">ROUTING</span><h3>Fees move with a purpose.</h3><p>Creator-fee flow is routed into an explicit vault policy rather than disappearing into an opaque treasury path.</p></div>
            <div className="allocation">
              <div className="allocation-bar"><span/></div>
              <div className="allocation-labels"><span>80% Asset vault</span><span>20% Treasury</span></div>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-index">02</span>
            <span className="micro">EXECUTION</span>
            <h3>Guarded by design.</h3>
            <p>Oracle validation, deviation limits, verified PoolKey data and a pausable executor protect the value-moving path.</p>
          </article>
          <article className="feature-card">
            <span className="feature-index">03</span>
            <span className="micro">REWARDS</span>
            <h3>Transparent distribution.</h3>
            <p>Weighted raffle, equal lottery and pro-rata policies give communities clear reward mechanics without fabricated offchain balances.</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head compact-head">
          <div><span className="micro">HOW ROUTY WORKS</span><h2>One route, four clear stages.</h2></div>
        </div>
        <div className="flow premium-flow">
          {[
            ["01","Launch","Create through Pons with a supported pair."],
            ["02","Harvest","Creator fees are collected by the route."],
            ["03","Acquire","Verified execution converts flow into the target asset."],
            ["04","Reward","Purchased assets become transparent community rewards."],
          ].map(([n,t,d])=><div className="flow-step" key={n}><span>{n}</span><div><b>{t}</b><p>{d}</p></div></div>)}
        </div>
      </section>

      <section className="section closing-panel">
        <div>
          <span className="micro">ROUTY</span>
          <h2>Make trading activity compound into community value.</h2>
        </div>
        <a className="primary premium-cta" href="/launch">Start a route <span>↗</span></a>
      </section>
    </div>
    <footer className="footer premium-footer"><span>Routy · Robinhood Chain</span><span>Stock Tokens provide tokenized economic exposure and are not direct ownership of underlying shares.</span></footer>
  </main>
}
