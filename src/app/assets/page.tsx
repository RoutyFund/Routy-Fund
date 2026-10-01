type Asset = { id:string; tokenSymbol:string; tokenName:string; logoUrl?:string; currentMultiplier:string; deployments?:Array<{contractAddress:string;chainId:number}> };

async function loadAssets(): Promise<Asset[]> {
  const res = await fetch("https://api.robinhood.com/rhj/assets", { next:{ revalidate:300 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.assets ?? []).filter((a:Asset)=>a.deployments?.some(d=>d.chainId===4663));
}

export default async function AssetsPage(){
  const assets=await loadAssets();
  return <main className="shell"><nav className="nav"><a className="brand" href="/"><span className="logo">R</span><span>Routy</span></a><a className="wallet" href="/launch">Launch</a></nav>
  <div className="wrap"><span className="kicker">Robinhood Chain canonical registry</span><h1 style={{fontSize:"64px"}}>Assets</h1>
  <p className="muted">Canonical Stock Tokens are matched by their Robinhood Chain deployment address, not ticker alone.</p>
  <div className="grid section">{assets.slice(0,60).map(a=><article className="card" key={a.id}><div className="card-top"><div className="asset">
  <div className="asset-logo">{a.logoUrl?<img src={a.logoUrl} alt="" />:a.tokenSymbol[0]}</div><div><b>{a.tokenSymbol}</b><div className="muted">{a.tokenName}</div></div></div><span className="pill">Active</span></div>
  <div className="stat" style={{marginTop:28}}><span className="muted">UI multiplier</span><b>{Number(a.currentMultiplier).toLocaleString()}</b></div></article>)}</div>
  </div></main>
}