import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,http,isAddress,type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";

export const dynamic="force-dynamic";

const chain={
 id:4663,
 name:"Robinhood Chain",
 nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
 rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}
} as const;

const ZERO="0x0000000000000000000000000000000000000000" as Address;
const launcherAbi=[
 {type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[
  {name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},
  {name:"vault",type:"address"},{name:"router",type:"address"},{name:"distributor",type:"address"},
  {name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}
 ]},
] as const;
const executorAbi=[
 {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[
  {name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},
  {name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}
 ]},
] as const;
const distributorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
] as const;

export async function GET(request:NextRequest){
 const token=request.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const client=createPublicClient({chain,transport:http(rpc)});
  const pons=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token as Address]});
  if(!pons.exists)return NextResponse.json({ok:true,stage:"not-launched",launched:false,provisioned:false,poolKeyConfigured:false,rewardsActive:false,ready:false});

  const launcher=(process.env.ROUTY_LAUNCHER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV4) as Address;
  const executor=(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4) as Address;
  const route=await client.readContract({address:launcher,abi:launcherAbi,functionName:"routes",args:[token as Address]});
  const [creator,targetAsset,quoteToken,vault,router,distributor,policy]=route;
  const provisioned=vault!==ZERO&&router!==ZERO&&distributor!==ZERO;
  if(!provisioned){
   return NextResponse.json({
    ok:true,stage:"provisioning",launched:true,provisioned:false,poolKeyConfigured:false,rewardsActive:false,ready:false,
    creator:pons.creatorFeeRecipient,targetAsset:null,policy:null
   });
  }

  const expected=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===targetAsset.toLowerCase());
  let poolKeyConfigured=false;
  if(expected){
   const key=await client.readContract({address:executor,abi:executorAbi,functionName:"poolKeyForVault",args:[vault]});
   poolKeyConfigured=
    key[0].toLowerCase()===expected.poolKey.currency0.toLowerCase()&&
    key[1].toLowerCase()===expected.poolKey.currency1.toLowerCase()&&
    Number(key[2])===expected.poolKey.fee&&
    Number(key[3])===expected.poolKey.tickSpacing&&
    key[4].toLowerCase()===expected.poolKey.hooks.toLowerCase();
  }

  const paused=await client.readContract({address:distributor,abi:distributorAbi,functionName:"paused"});
  const rewardsActive=!paused;
  const ready=Boolean(expected&&poolKeyConfigured&&rewardsActive);
  const stage=!poolKeyConfigured?"poolkey":!rewardsActive?"rewards":"ready";

  return NextResponse.json({
   ok:true,stage,launched:true,provisioned:true,poolKeyConfigured,rewardsActive,ready,
   creator,targetAsset,quoteToken,vault,router,distributor,policy:Number(policy),
   symbol:expected?.symbol??null
  });
 }catch(error){
  return NextResponse.json({ok:false,error:"AUTO_SETUP_STATUS_FAILED",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
