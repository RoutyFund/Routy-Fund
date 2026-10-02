import Nav from "@/components/Nav";
const topics=[
 ["01","Protocol overview","How Routy launches, provisions and routes creator-fee flow.","/docs/protocol"],
 ["02","Launch & routing","Pons V2 launch flow, verified markets and provisioning.","/docs/protocol#launch"],
 ["03","Security model","Registries, oracle checks, PoolKey verification and pause controls.","/docs/security"],
 ["04","Rewards","Weighted raffle, equal lottery and pro-rata distribution modes.","/docs/protocol#rewards"],
 ["05","FAQ","Common questions about Routy Fund, Stock Tokens and wallet custody.","/docs/faq"],
 ["06","Risk disclosure","Important limitations, execution risks and Stock Token disclosure.","/docs/risk"],
];
export default function Docs(){return <main className="shell"><Nav/><div className="wrap console-page">
<header className="page-head"><div className="page-head-copy"><span className="eyebrow">Routy knowledge base</span><h1>Docs.</h1><p className="lead">Technical and product documentation for Routy Fund on Robinhood Chain.</p></div><span className="pill">Protocol docs</span></header>
<section className="section"><div className="terminal-doc-grid">{topics.map(([n,t,d,h])=><a key={t} href={h}><span>{n}</span><b>{t}</b><p>{d}</p><i>↗</i></a>)}</div></section>
<section className="section"><div className="section-head"><div><span className="micro">QUICK START</span><h2>From launch to routed rewards.</h2></div></div><div className="flow"><div className="flow-step"><span>01</span><div><b>Launch</b><p>Create a token through the verified Pons V2 factory.</p></div></div><div className="flow-step"><span>02</span><div><b>Auto provision</b><p>Queue and provision the V4 vault/router against a verified Stock Token market.</p></div></div><div className="flow-step"><span>03</span><div><b>Route</b><p>Creator-fee flow follows the configured Routy allocation policy.</p></div></div><div className="flow-step"><span>04</span><div><b>Reward</b><p>Acquired assets follow the selected community reward policy.</p></div></div></div></section>
</div></main>}