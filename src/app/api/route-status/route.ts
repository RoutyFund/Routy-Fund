import {NextResponse} from "next/server";
import {createPublicClient,decodeFunctionResult,encodeFunctionData,http,type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {ROUTE_CATALOG} from "@/lib/route-catalog";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const registryAbi=[{type:"function",name:"approved",stateMutability:"view",inputs:[{name:"asset",type:"address"}],outputs:[{type:"bool"}]}] as const;
const oracleAbi=[{type:"function",name:"feedForAsset",stateMutability:"view",inputs:[{name:"asset",type:"address"}],outputs:[{type:"address"}]}] as const;

export const dynamic="force-dynamic";
export async function GET(){
 try{
  const rpc=process.env.RPC_URL?.trim()||process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const rows=[];
  for(const route of ROUTE_CATALOG){
   const [approvedRaw,targetFeedRaw,quoteFeedRaw]=await Promise.all([
    client.call({to:ROUTY_DEPLOYMENT.assetRegistry,data:encodeFunctionData({abi:registryAbi,functionName:"approved",args:[route.target]})}),
    client.call({to:ROUTY_DEPLOYMENT.oracleRegistry,data:encodeFunctionData({abi:oracleAbi,functionName:"feedForAsset",args:[route.target]})}),
    client.call({to:ROUTY_DEPLOYMENT.oracleRegistry,data:encodeFunctionData({abi:oracleAbi,functionName:"feedForAsset",args:[route.quote]})}),
   ]);
   const approved=decodeFunctionResult({abi:registryAbi,functionName:"approved",data:approvedRaw.data!});
   const targetFeed=decodeFunctionResult({abi:oracleAbi,functionName:"feedForAsset",data:targetFeedRaw.data!}) as Address;
   const quoteFeed=decodeFunctionResult({abi:oracleAbi,functionName:"feedForAsset",data:quoteFeedRaw.data!}) as Address;
   rows.push({
    symbol:route.symbol,
    launchEnabled:route.launchEnabled,
    approved,
    targetFeed,
    quoteFeed,
    expectedTargetFeed:route.targetFeed,
    expectedQuoteFeed:route.quoteFeed,
    targetFeedConfigured:targetFeed.toLowerCase()===route.targetFeed.toLowerCase(),
    quoteFeedConfigured:quoteFeed.toLowerCase()===route.quoteFeed.toLowerCase(),
    configurationComplete:Boolean(approved)&&targetFeed.toLowerCase()===route.targetFeed.toLowerCase()&&quoteFeed.toLowerCase()===route.quoteFeed.toLowerCase(),
   });
  }
  return NextResponse.json({ok:true,chainId:4663,routes:rows});
 }catch(error){
  return NextResponse.json({ok:false,error:"ROUTE_STATUS_UNAVAILABLE",detail:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
