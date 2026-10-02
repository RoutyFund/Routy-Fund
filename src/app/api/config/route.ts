import {NextResponse} from "next/server";
import {createPublicClient,http} from "viem";
import {PONS_V2} from "@/lib/pons";
import {protocolReadiness} from "@/lib/env";
import {ROUTY_DEPLOYMENT,ROUTY_RELEASE_STATE} from "@/lib/deployment";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const abi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;
export const dynamic="force-dynamic";

export async function GET(){
 const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
 const client=createPublicClient({chain,transport:http(rpc)});
 const paused=await client.readContract({address:ROUTY_DEPLOYMENT.swapExecutorV4,abi,functionName:"paused"}).catch(()=>null);
 return NextResponse.json({
  chainId:4663,
  pons:{factory:PONS_V2.factory,feeEscrow:PONS_V2.feeEscrow,launchAndBuy:PONS_V2.launchAndBuy,poolManager:PONS_V2.poolManager},
  routy:{...protocolReadiness(),deployment:ROUTY_DEPLOYMENT,...ROUTY_RELEASE_STATE,swapExecutionEnabled:paused===false,swapExecutorPaused:paused}
 });
}
