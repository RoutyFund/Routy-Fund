import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,decodeEventLog,http,isAddress,type Address} from "viem";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {publicErrorMessage} from "@/lib/public-error";

export const dynamic="force-dynamic";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint8"},{type:"uint64"}]}] as const;
const vaultAbi=[
 {type:"function",name:"totalEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"totalSpent",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"totalRewardsFunded",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}
] as const;
const distributorAbi=[
 {type:"function",name:"fundedBalance",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"totalDistributed",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"batchNonce",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}
] as const;
const routerEvents=[
 {type:"event",name:"Harvested",inputs:[{indexed:true,name:"quoteToken",type:"address"},{indexed:false,name:"claimed",type:"uint256"},{indexed:false,name:"vaultAmount",type:"uint256"},{indexed:false,name:"treasuryAmount",type:"uint256"}]}
] as const;
const vaultEvents=[
 {type:"event",name:"PurchaseRecorded",inputs:[{indexed:false,name:"quoteSpent",type:"uint256"},{indexed:false,name:"assetReceived",type:"uint256"}]},
 {type:"event",name:"RewardsFunded",inputs:[{indexed:true,name:"distributor",type:"address"},{indexed:false,name:"amount",type:"uint256"}]}
] as const;
const distributorEvents=[
 {type:"event",name:"BatchDistributed",inputs:[{indexed:true,name:"batchNonce",type:"uint256"},{indexed:false,name:"recipients",type:"uint256"},{indexed:false,name:"totalAmount",type:"uint256"}]}
] as const;

export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
 try{
  const rpc=process.env.RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const launcher=requireCurrentDeployment().launcher as Address;
  const route=await client.readContract({address:launcher,abi:launcherAbi,functionName:"routes",args:[token as Address]});
  const [,,,vault,router,distributor,,createdAt]=route;
  const zero="0x0000000000000000000000000000000000000000";
  if(vault===zero||router===zero||distributor===zero)return NextResponse.json({ok:true,token,provisioned:false});
  const [totalEarned,totalSpent,totalRewardsFunded,fundedBalance,totalDistributed,batchNonce,latest]=await Promise.all([
   client.readContract({address:vault,abi:vaultAbi,functionName:"totalEarned"}),
   client.readContract({address:vault,abi:vaultAbi,functionName:"totalSpent"}),
   client.readContract({address:vault,abi:vaultAbi,functionName:"totalRewardsFunded"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"fundedBalance"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"totalDistributed"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"batchNonce"}),
   client.getBlockNumber()
  ]);
  const from=createdAt>0n?latest>500000n?latest-500000n:0n:latest>500000n?latest-500000n:0n;
  const [routerLogs,vaultLogs,distLogs]=await Promise.all([
   client.getLogs({address:router,fromBlock:from,toBlock:latest}),
   client.getLogs({address:vault,fromBlock:from,toBlock:latest}),
   client.getLogs({address:distributor,fromBlock:from,toBlock:latest})
  ]);
  const activity:{type:string;blockNumber:string;transactionHash:string;claimed?:string;vaultAmount?:string;treasuryAmount?:string;quoteSpent?:string;assetReceived?:string;amount?:string;recipients?:string}[]=[];
  for(const log of routerLogs)try{const d=decodeEventLog({abi:routerEvents,data:log.data,topics:log.topics});if(d.eventName==="Harvested"){const a=d.args;activity.push({type:"FEE_HARVESTED",blockNumber:String(log.blockNumber),transactionHash:log.transactionHash,claimed:String(a.claimed),vaultAmount:String(a.vaultAmount),treasuryAmount:String(a.treasuryAmount)})}}catch{}
  for(const log of vaultLogs)try{const d=decodeEventLog({abi:vaultEvents,data:log.data,topics:log.topics});const a=d.args;if(d.eventName==="PurchaseRecorded")activity.push({type:"STOCK_TOKEN_ACQUIRED",blockNumber:String(log.blockNumber),transactionHash:log.transactionHash,quoteSpent:String(a.quoteSpent),assetReceived:String(a.assetReceived)});if(d.eventName==="RewardsFunded")activity.push({type:"REWARDS_FUNDED",blockNumber:String(log.blockNumber),transactionHash:log.transactionHash,amount:String(a.amount)})}catch{}
  for(const log of distLogs)try{const d=decodeEventLog({abi:distributorEvents,data:log.data,topics:log.topics});if(d.eventName==="BatchDistributed"){const a=d.args;activity.push({type:"REWARDS_DISTRIBUTED",blockNumber:String(log.blockNumber),transactionHash:log.transactionHash,amount:String(a.totalAmount),recipients:String(a.recipients)})}}catch{}
  activity.sort((a,b)=>Number(BigInt(b.blockNumber)-BigInt(a.blockNumber)));
  return NextResponse.json({ok:true,token,provisioned:true,totalEarned:totalEarned.toString(),totalSpent:totalSpent.toString(),availableEarned:(totalEarned-totalSpent).toString(),totalRewardsFunded:totalRewardsFunded.toString(),fundedBalance:fundedBalance.toString(),totalDistributed:totalDistributed.toString(),batchNonce:batchNonce.toString(),activity:activity.slice(0,100)},{headers:{"Cache-Control":"s-maxage=5, stale-while-revalidate=5"}});
 }catch(error){return NextResponse.json({ok:false,error:"ROUTE_ACCOUNTING_FAILED",message:publicErrorMessage(error)},{status:503})}
}
