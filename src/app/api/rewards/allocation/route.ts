import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,encodePacked,http,isAddress,keccak256,type Address} from "viem";
import {snapshotTokenHolders} from "@/lib/holder-snapshot";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const ZERO="0x0000000000000000000000000000000000000000" as Address;
const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint8"},{type:"uint64"}]}] as const;
const distributorAbi=[
 {type:"function",name:"fundedBalance",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"distributedTo",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"uint256"}]},
 {type:"function",name:"batchNonce",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}
] as const;

type Holder={address:Address;balance:bigint};
type Allocation={address:Address;amount:bigint};

function proRata(holders:Holder[],amount:bigint):Allocation[]{
 const total=holders.reduce((n,h)=>n+h.balance,0n);
 if(total===0n||amount===0n)return[];
 let allocated=0n;
 return holders.map((h,i)=>{
  const share=i===holders.length-1?amount-allocated:amount*h.balance/total;
  allocated+=share;
  return{address:h.address,amount:share};
 }).filter(x=>x.amount>0n);
}
function weightedWinner(holders:Holder[],seed:bigint){
 const total=holders.reduce((n,h)=>n+h.balance,0n);
 if(total===0n)throw new Error("EMPTY_SNAPSHOT");
 let cursor=seed%total;
 for(const h of holders){if(cursor<h.balance)return h;cursor-=h.balance}
 return holders[holders.length-1];
}
function equalWinner(holders:Holder[],seed:bigint){
 if(!holders.length)throw new Error("EMPTY_SNAPSHOT");
 return holders[Number(seed%BigInt(holders.length))];
}
function chunks<T>(xs:T[],size:number){const out:T[][]=[];for(let i=0;i<xs.length;i+=size)out.push(xs.slice(i,i+size));return out}

export async function GET(req:NextRequest){
 const token=req.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const client=createPublicClient({chain,transport:http(rpc)});
  const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token as Address]});
  if(!launch.exists)return NextResponse.json({ok:false,error:"NOT_PONS_TOKEN"},{status:404});

  const route=await client.readContract({address:ROUTY_DEPLOYMENT.protocolLauncherV4,abi:launcherAbi,functionName:"routes",args:[token as Address]});
  const [creator,,,vault,router,distributor,policy]=route;
  if(vault===ZERO||distributor===ZERO)return NextResponse.json({ok:false,error:"ROUTE_NOT_PROVISIONED"},{status:409});

  const latest=await client.getBlock({blockTag:"latest"});
  const launchLogs=await client.getLogs({address:PONS_V2.factory,event:{type:"event",name:"TokenLaunched",inputs:[{indexed:true,name:"token",type:"address"},{indexed:true,name:"deployer",type:"address"},{indexed:true,name:"creatorFeeRecipient",type:"address"}]},args:{token:token as Address},fromBlock:0n,toBlock:"latest"}).catch(()=>[]);
  const launchBlock=launchLogs.length?launchLogs[0].blockNumber:null;
  const fromBlock=launchBlock??(latest.number>500_000n?latest.number-500_000n:0n);
  const holders=await snapshotTokenHolders({
   token,
   fromBlock,
   excluded:[creator,vault,router,distributor,PONS_V2.factory,PONS_V2.feeEscrow],
   rpcUrl:rpc
  });
  if(!holders.length)return NextResponse.json({ok:true,token,policy:Number(policy),fundedBalance:"0",allocations:[],batches:[],reason:"NO_ELIGIBLE_HOLDERS"});

  const [fundedBalance,batchNonce]=await Promise.all([
   client.readContract({address:distributor,abi:distributorAbi,functionName:"fundedBalance"}),
   client.readContract({address:distributor,abi:distributorAbi,functionName:"batchNonce"})
  ]);
  if(fundedBalance===0n)return NextResponse.json({ok:true,token,policy:Number(policy),fundedBalance:"0",allocations:[],batches:[],reason:"NO_FUNDED_REWARDS"});

  const blockHash=latest.hash;
  if(!blockHash)throw new Error("LATEST_BLOCK_HASH_MISSING");
  const seedHex=keccak256(encodePacked(["address","address","bytes32","uint256","uint256"],[token as Address,distributor,blockHash,fundedBalance,batchNonce]));
  const seed=BigInt(seedHex);

  let allocations:Allocation[];
  if(Number(policy)===2)allocations=proRata(holders,fundedBalance);
  else if(Number(policy)===0)allocations=[{address:weightedWinner(holders,seed).address,amount:fundedBalance}];
  else if(Number(policy)===1)allocations=[{address:equalWinner(holders,seed).address,amount:fundedBalance}];
  else return NextResponse.json({ok:false,error:"UNKNOWN_POLICY"},{status:409});

  const rows=await Promise.all(allocations.map(async a=>{
   const previous=await client.readContract({address:distributor,abi:distributorAbi,functionName:"distributedTo",args:[a.address]});
   return{address:a.address,amount:a.amount,cumulative:previous+a.amount};
  }));
  const batches=chunks(rows,200).map((batch,index)=>({
   index,
   accounts:batch.map(x=>x.address),
   cumulativeAmounts:batch.map(x=>x.cumulative.toString()),
   batchAmount:batch.reduce((n,x)=>n+x.amount,0n).toString()
  }));

  return NextResponse.json({
   ok:true,
   token,
   distributor,
   policy:Number(policy),
   policyName:Number(policy)===0?"weighted-raffle":Number(policy)===1?"equal-lottery":"pro-rata",
   fundedBalance:fundedBalance.toString(),
   holderCount:holders.length,
   snapshotBlock:latest.number.toString(),
   snapshotFromBlock:fromBlock.toString(),
   selectionSeed:seedHex,
   allocations:rows.map(x=>({address:x.address,amount:x.amount.toString(),cumulativeAmount:x.cumulative.toString()})),
   batches
  });
 }catch(error){
  return NextResponse.json({ok:false,error:"ALLOCATION_FAILED",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
