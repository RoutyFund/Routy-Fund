import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,createWalletClient,http,isAddress,type Address} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {rewardAutomationStatus} from "@/lib/reward-automation-guard";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const controllerAbi=[{type:"function",name:"distribute",stateMutability:"nonpayable",inputs:[{name:"distributor",type:"address"},{name:"accounts",type:"address[]"},{name:"cumulativeAmounts",type:"uint256[]"}],outputs:[]}] as const;

export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,error:"CRON_SECRET_MISSING"},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const status=await rewardAutomationStatus();
 if(!status.automationEnabled)return NextResponse.json({ok:false,error:"AUTOMATION_DISABLED",status},{status:409});
 if(!status.keeperMatches)return NextResponse.json({ok:false,error:"KEEPER_ADDRESS_MISMATCH",status},{status:409});

 const token=request.nextUrl.searchParams.get("token");
 if(!token||!isAddress(token))return NextResponse.json({ok:true,state:"READY_FOR_TOKEN_BATCH",status});

 const key=(process.env.ROUTY_AUTOMATION_PRIVATE_KEY||process.env.KEEPER_PRIVATE_KEY)?.trim();
 if(!key||!/^0x[0-9a-fA-F]{64}$/.test(key))return NextResponse.json({ok:false,error:"KEEPER_KEY_MISSING"},{status:503});
 try{
  const allocationUrl=new URL("/api/rewards/allocation",request.url);allocationUrl.searchParams.set("token",token);
  const allocationRes=await fetch(allocationUrl,{cache:"no-store"});
  const allocation=await allocationRes.json();
  if(!allocationRes.ok||!allocation.ok)return NextResponse.json({ok:false,error:"ALLOCATION_UNAVAILABLE",allocation},{status:503});
  if(!allocation.batches?.length)return NextResponse.json({ok:true,state:allocation.reason||"NO_REWARDS",token});

  const account=privateKeyToAccount(key as `0x${string}`);
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const publicClient=createPublicClient({chain,transport:http(rpc)});
  const walletClient=createWalletClient({account,chain,transport:http(rpc)});
  const hashes:string[]=[];
  for(const batch of allocation.batches){
   const hash=await walletClient.writeContract({address:ROUTY_DEPLOYMENT.rewardAutomationControllerV4,abi:controllerAbi,functionName:"distribute",args:[allocation.distributor as Address,batch.accounts as Address[],batch.cumulativeAmounts.map((x:string)=>BigInt(x))]});
   await publicClient.waitForTransactionReceipt({hash});
   hashes.push(hash);
  }
  return NextResponse.json({ok:true,state:"DISTRIBUTED",token,batches:hashes.length,transactions:hashes});
 }catch(error){
  return NextResponse.json({ok:false,error:"REWARD_AUTOMATION_FAILED",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
