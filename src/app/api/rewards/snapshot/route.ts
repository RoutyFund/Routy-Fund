import {NextRequest,NextResponse} from "next/server";
import {isAddress} from "viem";
import {snapshotTokenHolders} from "@/lib/holder-snapshot";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {createPublicClient,http,type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint8"},{type:"uint64"}]}] as const;

export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const client=createPublicClient({chain,transport:http(rpc)});
  const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token as Address]});
  if(!launch.exists)return NextResponse.json({ok:false,error:"NOT_PONS_TOKEN"},{status:404});
  const route=await client.readContract({address:ROUTY_DEPLOYMENT.protocolLauncherV4,abi:launcherAbi,functionName:"routes",args:[token as Address]});
  const [creator,,,vault,router,distributor,policy,createdAt]=route;
  if(vault==="0x0000000000000000000000000000000000000000")return NextResponse.json({ok:false,error:"ROUTE_NOT_PROVISIONED"},{status:409});
  const block=await client.getBlock({blockTag:"latest"});
  const approximateFrom=block.number>500_000n?block.number-500_000n:0n;
  const holders=await snapshotTokenHolders({token,fromBlock:approximateFrom,excluded:[creator,vault,router,distributor,PONS_V2.factory,PONS_V2.feeEscrow],rpcUrl:rpc});
  const total=holders.reduce((n,h)=>n+h.balance,0n);
  return NextResponse.json({ok:true,token,policy:Number(policy),createdAt:Number(createdAt),holderCount:holders.length,totalEligibleBalance:total.toString(),holders:holders.map(h=>({address:h.address,balance:h.balance.toString()}))});
 }catch(error){
  return NextResponse.json({ok:false,error:"SNAPSHOT_FAILED",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
