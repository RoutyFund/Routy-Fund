import {NextResponse} from "next/server";
import {createPublicClient,http,keccak256,encodeAbiParameters,parseAbiParameters,getAddress,type Address} from "viem";
import {ROUTE_CANDIDATES} from "@/lib/route-candidates";

const CHAIN={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const client=createPublicClient({chain:CHAIN,transport:http(CHAIN.rpcUrls.default.http[0])});
const USDG=getAddress("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
const STATE_VIEW=getAddress("0xf3334192d15450cdd385c8b70e03f9a6bd9e673b");
const abi=[
 {type:"function",name:"getSlot0",stateMutability:"view",inputs:[{name:"poolId",type:"bytes32"}],outputs:[{name:"sqrtPriceX96",type:"uint160"},{name:"tick",type:"int24"},{name:"protocolFee",type:"uint24"},{name:"lpFee",type:"uint24"}]},
 {type:"function",name:"getLiquidity",stateMutability:"view",inputs:[{name:"poolId",type:"bytes32"}],outputs:[{name:"liquidity",type:"uint128"}]},
] as const;
const feeTiers=[100,500,3000,10000] as const;
const spacings=[1,10,60,200] as const;
function poolId(currency0:Address,currency1:Address,fee:number,tickSpacing:number){
 return keccak256(encodeAbiParameters(parseAbiParameters("address,address,uint24,int24,address"),[currency0,currency1,fee,tickSpacing,"0x0000000000000000000000000000000000000000"]));
}
export async function GET(){
 const rows=await Promise.all(ROUTE_CANDIDATES.map(async c=>{
  const target=getAddress(c.target);const currency0=target.toLowerCase()<USDG.toLowerCase()?target:USDG;const currency1=currency0===target?USDG:target;
  const combos=feeTiers.flatMap(fee=>spacings.map(tickSpacing=>({fee,tickSpacing,poolId:poolId(currency0,currency1,fee,tickSpacing)})));
  const found=[];
  for(const x of combos){try{
   const [slot,liquidity]=await Promise.all([
    client.readContract({address:STATE_VIEW,abi,functionName:"getSlot0",args:[x.poolId]}),
    client.readContract({address:STATE_VIEW,abi,functionName:"getLiquidity",args:[x.poolId]})
   ]);
   const sqrt=slot[0];if(sqrt>0n&&liquidity>0n)found.push({...x,liquidity:liquidity.toString(),sqrtPriceX96:sqrt.toString(),tick:Number(slot[1]),lpFee:Number(slot[3])});
  }catch{}}
  return {...c,currency0,currency1,hook:"0x0000000000000000000000000000000000000000",status:found.length?"pool_found":"no_pool_in_safe_matrix",pools:found};
 }));
 return NextResponse.json({ok:true,chainId:4663,source:"Uniswap V4 StateView on Robinhood Chain",stateView:STATE_VIEW,quote:USDG,feeTiers,spacings,rows});
}
