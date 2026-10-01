"use client";

import Nav from "@/components/Nav";
import { FIRST_PRODUCTION_ROUTE } from "@/lib/production-route";

export default function Launch() {
  return <main className="shell"><Nav/><div className="wrap">
    <span className="kicker">Launch on Routy</span>
    <h1 style={{fontSize:64}}>Create a routed token.</h1>
    <p className="muted">Production routing is intentionally limited to routes whose oracle and Uniswap V4 PoolKey have been verified. The first route is AAPL / USDG.</p>

    <div className="launch-form">
      <section className="form-card">
        <h2>1. Launch on Pons</h2>
        <p className="muted">Create the token through Pons V2 using USDG as its pair token. Keep the creator fee recipient on the wallet that will provision Routy.</p>
        <div className="notice">Do not use a different pair for the first production test. Routy currently pins USDG <code>{FIRST_PRODUCTION_ROUTE.quote}</code>.</div>
        <a className="primary" href="/deploy/provision">I already have a Pons token</a>
      </section>

      <section className="form-card">
        <h2>2. Routy route</h2>
        <p><b>AAPL</b> · {FIRST_PRODUCTION_ROUTE.target}</p>
        <p><b>USDG</b> · {FIRST_PRODUCTION_ROUTE.quote}</p>
        <p>Uniswap V4 fee: <b>{FIRST_PRODUCTION_ROUTE.poolKey.fee / 10000}%</b></p>
        <p>Tick spacing: <b>{FIRST_PRODUCTION_ROUTE.poolKey.tickSpacing}</b></p>
        <div className="notice">AAPL and USDG oracle prerequisites are configured on-chain. Swap execution remains paused until a real token is provisioned and a constrained test succeeds.</div>
      </section>
    </div>
  </div></main>;
}
