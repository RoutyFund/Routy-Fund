import {NextResponse} from "next/server";
import {createPublicClient,http} from "viem";
import {currentDeployment} from "@/lib/active-deployment";
import {PONS_V2} from "@/lib/pons";
import {protocolReadiness} from "@/lib/env";
import {ROUTY_DEPLOYMENT,ROUTY_RELEASE_STATE} from "@/lib/deployment";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const abi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;
export const dynamic="force-dynamic";

export async function GET(){
 const rpc=process.env.RPC_URL?.trim();
 const deployment=currentDeployment();
 const executor=deployment.executor as `0x${string}`;
 const client=rpc?createPublicClient({chain,transport:http(rpc)}):null;
 const paused=client&&deployment.configured?await client.readContract({address:executor,abi,functionName:"paused"}).catch(()=>null):null;
 return NextResponse.json({
  chainId:4663,
  pons:{factory:PONS_V2.factory,feeEscrow:PONS_V2.feeEscrow,launchAndBuy:PONS_V2.launchAndBuy,poolManager:PONS_V2.poolManager},
  routy:{...protocolReadiness(),deployment:{...ROUTY_DEPLOYMENT,protocolLauncher:deployment.launcher,swapExecutor:deployment.executor,rewardAutomationController:deployment.controller,feeRouterFactory:deployment.routerFactory,assetVaultFactory:deployment.version==="V5"?process.env.ROUTY_ASSET_VAULT_FACTORY_V5_ADDRESS:ROUTY_DEPLOYMENT.assetVaultFactoryV4,rewardDistributorFactory:deployment.version==="V5"?process.env.ROUTY_REWARD_DISTRIBUTOR_FACTORY_V5_ADDRESS:ROUTY_DEPLOYMENT.rewardDistributorFactoryV4},activeDeployment:deployment,...ROUTY_RELEASE_STATE,rpcConfigured:Boolean(rpc),effectiveSwapExecutor:executor,swapExecutionRequested:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",swapExecutionEnabled:paused===false,swapExecutorPaused:paused}
 });
}
