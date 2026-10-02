import {NextResponse} from "next/server";
import {ROUTE_CANDIDATES} from "@/lib/route-candidates";

const USDG="0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const ZERO="0x0000000000000000000000000000000000000000";
type Pool={poolId?:string;venue?:string;currency0?:string;currency1?:string;fee?:number;tickSpacing?:number;hooks?:string;asset?:string;quote?:string;depthUsd?:number|null;stateCurrent?:boolean;lastSwapAt?:string|null};
type PoolsResponse={pools?:Pool[];feedPriceUsd?:number|null};

export async function GET(){
 const rows=await Promise.all(ROUTE_CANDIDATES.map(async candidate=>{
  try{
   const res=await fetch("https://fletch.now/api/v1/chains/4663/assets/"+candidate.symbol+"/pools",{next:{revalidate:300}});
   if(!res.ok)return {...candidate,status:"source_unavailable",pool:null};
   const data=await res.json() as PoolsResponse;
   const pools=(data.pools||[]).filter(p=>{
    const c0=(p.currency0||"").toLowerCase(),c1=(p.currency1||"").toLowerCase();
    const direct=(c0===candidate.target.toLowerCase()&&c1===USDG)||(c1===candidate.target.toLowerCase()&&c0===USDG);
    return p.venue==="uniswap_v4"&&direct&&(p.hooks||ZERO).toLowerCase()===ZERO&&Number(p.fee||0)>0&&Number(p.fee||0)<=10000;
   }).sort((a,b)=>Number(b.depthUsd||0)-Number(a.depthUsd||0));
   const pool=pools[0]||null;
   return {...candidate,feedPriceUsd:data.feedPriceUsd??null,status:pool?"pool_found":"no_safe_v4_usdg_pool",pool};
  }catch{return {...candidate,status:"source_unavailable",pool:null}}
 }));
 return NextResponse.json({ok:true,chainId:4663,quote:"USDG",criteria:"direct hookless Uniswap V4 USDG pool, fee > 0 and <= 1%",rows});
}
