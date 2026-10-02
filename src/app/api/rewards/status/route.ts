import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,http,isAddress,type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {snapshotTokenHolders} from "@/lib/holder-snapshot";

export const dynamic="force-dynamic";
const ZERO="0x0000000000000000000000000000000000000000" as Address;
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint8"},{type:"uint64"}]}] as const;
const distributorAbi=[
 {type:"function",name:"fundedBalance",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"totalDistributed",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"batchNonce",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"rewardAsset",stateMutability:"view",inputs:[],outputs:[{type:"address"}]}
] as const;

export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const client=createPublicClient({chain,transport:http(rpc)});
  const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token as Address]});
  if(!launch.exists)return NextResponse.json({ok:false,error:"NOT_PONS_TOKEN"},{status:404});
  const [creator,targetAsset,quoteToken,vault,router,distributor,policy,createdAt]=await client.readContract({address:ROUTY_DEPLOYMENT.protocolLauncherV4,abi:launcherAbi,functionName:"routes",args:[token as Address]});
  if(vault===ZERO||distributor===ZERO)return NextResponse.json({ok:true,token,provisioned:false,status:"waiting-for-route"});

  const [funded,totalDistributed,batchNonce,paused,rewardAsset,latest]=await Promise.all([
   client.readContract({address:distributor,abi:distributorAbi,functionName:"fundedBalance"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"totalDistributed"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"batchNonce"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"paused"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"rewardAsset"}),
   client.getBlock({blockTag:"latest"})
  ]);
  const fromBlock=latest.number>500_000n?latest.number-500_000n:0n;
  const holders=await snapshotTokenHolders({token,fromBlock,excluded:[creator,vault,router,distributor,PONS_V2.factory,PONS_V2.feeEscrow],rpcUrl:rpc});
  const policyName=Number(policy)===0?"weighted-raffle":Number(policy)===1?"equal-lottery":"pro-rata";
  return NextResponse.json({
   ok:true,token,provisioned:true,status:paused?"paused":"active",
   creator,targetAsset,quoteToken,vault,router,distributor,rewardAsset,
   policy:Number(policy),policyName,createdAt:Number(createdAt),
   fundedBalance:funded.toString(),totalDistributed:totalDistributed.toString(),
   batchNonce:batchNonce.toString(),eligibleHolders:holders.length,
   snapshotBlock:latest.number.toString()
  });
 }catch(error){
  return NextResponse.json({ok:false,error:"REWARD_STATUS_FAILED",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
