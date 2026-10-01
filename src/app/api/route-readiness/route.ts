import {NextResponse} from "next/server";
import {keccak256,encodeAbiParameters,parseAbiParameters} from "viem";
import {ROUTE_CATALOG} from "@/lib/route-catalog";

export function GET(){
 const routes=ROUTE_CATALOG.map(route=>{
  const computedPoolId=keccak256(encodeAbiParameters(parseAbiParameters("address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks"),[route.poolKey.currency0,route.poolKey.currency1,route.poolKey.fee,route.poolKey.tickSpacing,route.poolKey.hooks]));
  return {...route,computedPoolId,poolKeyMatches:computedPoolId.toLowerCase()===route.poolId.toLowerCase()};
 });
 const ready=routes.length>0&&routes.every(r=>r.poolKeyMatches);
 return NextResponse.json({readyForOwnerConfiguration:ready,routeCount:routes.length,routes,note:ready?"Every published Routy route has a deterministic PoolKey matching its pinned Uniswap v4 pool ID.":"At least one published route failed PoolKey verification."},{status:ready?200:409});
}