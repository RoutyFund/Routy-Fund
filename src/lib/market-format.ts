export function compactUsd(value:string|null|undefined){
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 if(n>=1_000_000_000)return "$"+(n/1_000_000_000).toFixed(n>=10_000_000_000?0:1).replace(/\.0$/,"")+"B";
 if(n>=1_000_000)return "$"+(n/1_000_000).toFixed(n>=10_000_000?0:1).replace(/\.0$/,"")+"M";
 if(n>=1_000)return "$"+(n/1_000).toFixed(n>=10_000?0:1).replace(/\.0$/,"")+"K";
 return "$"+n.toFixed(n>=10?0:n>=1?2:4).replace(/0+$/,"").replace(/\.$/,"");
}
export function priceUsd(value:string|null|undefined){
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 if(n>=1)return "$"+n.toLocaleString("en-US",{maximumFractionDigits:6});
 if(n>=0.01)return "$"+n.toFixed(4).replace(/0+$/,"").replace(/\.$/,"");
 if(n===0)return "$0";
 return "$"+n.toPrecision(5).replace(/0+$/,"").replace(/\.$/,"");
}
