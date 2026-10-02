import {NextResponse} from "next/server";
import {createPublicClient,http} from "viem";
import {protocolReadiness} from "@/lib/env";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const pausedAbi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;
export const dynamic="force-dynamic";
export async function GET(){
 const readiness=protocolReadiness();
 const configured=Object.entries(readiness).filter(([k])=>k!=="generation").every(([,v])=>Boolean(v));
 const client=createPublicClient({chain,transport:http(process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0])});
 const executor=(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4) as `0x${string}`;
 const executorPaused=await client.readContract({address:executor,abi:pausedAbi,functionName:"paused"}).catch(()=>null);
 return NextResponse.json({ok:configured&&executorPaused!==null,service:"routy",chainId:4663,generation:"v4",protocolConfigured:configured,executorReachable:executorPaused!==null,executorPaused,readiness,ts:new Date().toISOString()});
}
