import {NextResponse} from "next/server";
import {createPublicClient,http} from "viem";
import {protocolReadiness} from "@/lib/env";
import {currentDeployment} from "@/lib/active-deployment";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const pausedAbi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;
export const dynamic="force-dynamic";
export async function GET(){
 const readiness=protocolReadiness();
 const deployment=currentDeployment();
 const configured=Object.entries(readiness).filter(([k])=>k!=="generation").every(([,v])=>Boolean(v));
 const rpc=process.env.RPC_URL?.trim();
 if(!rpc)return NextResponse.json({ok:false,service:"routy",chainId:4663,generation:readiness.generation,protocolConfigured:configured,executorReachable:false,executorPaused:null,readiness,error:"RPC_URL_MISSING",ts:new Date().toISOString()},{status:503});
 const client=createPublicClient({chain,transport:http(rpc)});
 const executor=deployment.executor as `0x${string}`;
 const executorPaused=deployment.configured?await client.readContract({address:executor,abi:pausedAbi,functionName:"paused"}).catch(()=>null):null;
 return NextResponse.json({ok:configured&&executorPaused!==null,service:"routy",chainId:4663,generation:readiness.generation,protocolConfigured:configured,executorReachable:executorPaused!==null,executorPaused,readiness,ts:new Date().toISOString()});
}
