import {NextResponse} from "next/server";
import {keccak256,encodeAbiParameters} from "viem";
import {ROUTE_CATALOG} from "@/lib/route-catalog";

export function GET(){
 const routes=ROUTE_CATALOG.map(route=>{
  const key=route.poolKey;
  const computedPoolId=keccak256(encodeAbiParameters(
   [{type:"address"},{type:"address"},{type:"uint24"},{type:"int24"},{type:"address"}],
   [key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks],
  ));
  return {...route,computedPoolId,poolKeyMatches:computedPoolId.toLowerCase()===route.poolId.toLowerCase()};
 });
 const ready=routes.length>0&&routes.every(route=>route.poolKeyMatches);
 return NextResponse.json({
  readyForOwnerConfiguration:ready,
  routeCount:routes.length,
  routes,
  note:ready
   ?"Every published Routy route has a deterministic PoolKey matching its pinned Uniswap v4 pool ID."
   :"At least one published route failed PoolKey verification."
 },{status:ready?200:409});
}