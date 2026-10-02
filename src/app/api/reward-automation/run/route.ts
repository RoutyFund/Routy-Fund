import {NextRequest,NextResponse} from "next/server";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {createPublicClient,createWalletClient,http,isAddress,type Address,type PublicClient} from "viem";
import {rewardAutomationStatus,keeperAccount} from "@/lib/reward-automation-guard";
import {readRewardPlan,unpaidRewardRows,type RewardPlan} from "@/lib/reward-plan";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";
export const maxDuration=60;

const SUPABASE_URL="https://hcwtwtvovdzfuugnjqyz.supabase.co";
const TIME_BUDGET_MS=45_000;
const MAX_TOKENS_PER_RUN=20;
const ZERO="0x0000000000000000000000000000000000000000";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;

const launcherAbi=[{type:"function",name:"routes",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"address"},{type:"uint8"},{type:"uint64"}]}] as const;
const routerAbi=[{type:"function",name:"harvest",stateMutability:"nonpayable",inputs:[],outputs:[{name:"claimed",type:"uint256"}]}] as const;
const vaultAbi=[
 {type:"function",name:"availableEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"quoteToken",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
 {type:"function",name:"targetAsset",stateMutability:"view",inputs:[],outputs:[{type:"address"}]}
] as const;
const executorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"execute",stateMutability:"nonpayable",inputs:[{name:"vault",type:"address"},{name:"amountIn",type:"uint256"},{name:"minOut",type:"uint256"},{name:"deadline",type:"uint256"}],outputs:[]}
] as const;
const quoterAbi=[{type:"function",name:"expectedOut",stateMutability:"view",inputs:[{name:"registry",type:"address"},{name:"guard",type:"address"},{name:"quote",type:"address"},{name:"target",type:"address"},{name:"amountIn",type:"uint256"}],outputs:[{type:"uint256"}]}] as const;
const controllerAbi=[{type:"function",name:"distribute",stateMutability:"nonpayable",inputs:[{name:"distributor",type:"address"},{name:"accounts",type:"address[]"},{name:"cumulativeAmounts",type:"uint256[]"}],outputs:[]}] as const;
const distributorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"distributedTo",stateMutability:"view",inputs:[{type:"address"}],outputs:[{type:"uint256"}]},
] as const;

type TokenResult={token:string;harvest:string;swap?:string;distribution:string;batches?:number;recipients?:number;amount?:string;error?:string};
type Wallet=ReturnType<typeof createWalletClient>;
type Keeper=NonNullable<ReturnType<typeof keeperAccount>>;

function dbHeaders():Record<string,string>{
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
 // New-format sb_secret_ keys are not JWTs; Supabase rejects them in the Authorization header.
 return key.startsWith("sb_")?{apikey:key,Accept:"application/json"}:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"};
}
async function readyTokens():Promise<Address[]>{
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?select=token_address&status=eq.ready&order=updated_at.asc,created_at.asc&limit="+MAX_TOKENS_PER_RUN,{headers:dbHeaders(),cache:"no-store"});
 if(!r.ok)throw new Error("QUEUE_READ_FAILED (HTTP "+r.status+"): "+(await r.text().catch(()=>"")).slice(0,300));
 const rows=await r.json() as {token_address:string}[];
 return rows.map(x=>x.token_address).filter(a=>isAddress(a)) as Address[];
}
type RewardJob={token_address:string;reward_plan:unknown;reward_lease_until:string};
async function claimRewardToken(token:Address):Promise<RewardJob|null>{
 const now=new Date().toISOString();
 const lease=new Date(Date.now()+120_000).toISOString();
 const filter="?token_address=eq."+encodeURIComponent(token.toLowerCase())+"&status=eq.ready&or="+encodeURIComponent("(reward_lease_until.is.null,reward_lease_until.lt."+now+")");
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue"+filter,{
  method:"PATCH",headers:{...dbHeaders(),"Content-Type":"application/json",Prefer:"return=representation"},
  body:JSON.stringify({reward_lease_until:lease,updated_at:now}),cache:"no-store"
 });
 if(!r.ok)throw new Error("REWARD_LEASE_FAILED_"+r.status);
 const rows=await r.json() as RewardJob[];
 return rows[0]||null;
}
async function patchRewardJob(token:Address,lease:string,patch:Record<string,unknown>){
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?token_address=eq."+encodeURIComponent(token.toLowerCase())+"&reward_lease_until=eq."+encodeURIComponent(lease),{
  method:"PATCH",headers:{...dbHeaders(),"Content-Type":"application/json",Prefer:"return=representation"},
  body:JSON.stringify({...patch,updated_at:new Date().toISOString()}),cache:"no-store"
 });
 if(!r.ok)throw new Error("REWARD_CHECKPOINT_WRITE_FAILED_"+r.status);
 const rows=await r.json() as RewardJob[];
 if(rows.length!==1)throw new Error("REWARD_LEASE_LOST");
}
function reason(error:unknown){
 const e=error as {shortMessage?:string;message?:string};
 return (e?.shortMessage||e?.message||"unknown").slice(0,300);
}

// Executes SwapExecutor.execute for what the vault has earned, bounded by the oracle price and slippage.
async function swapEarned(publicClient:PublicClient,walletClient:Wallet,account:Keeper,vault:Address){
 const executor=requireCurrentDeployment().executor as Address;
 const [available,quote,target,executorPaused]=await Promise.all([
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"availableEarned"}),
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"quoteToken"}),
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"targetAsset"}),
  publicClient.readContract({address:executor,abi:executorAbi,functionName:"paused"})
 ]);
 if(executorPaused)return "EXECUTOR_PAUSED";
 const minSwapRaw=process.env.ROUTY_MIN_SWAP_UNITS||"1";
 const capRaw=process.env.ROUTY_MAX_SWAP_UNITS||"0";
 if(!/^\d+$/.test(minSwapRaw)||!/^\d+$/.test(capRaw))throw new Error("INVALID_SWAP_LIMIT_ENV");
 const minSwap=BigInt(minSwapRaw);
 const cap=BigInt(capRaw);
 const amountIn=cap>0n&&available>cap?cap:available;
 if(amountIn<minSwap||amountIn===0n)return "NOTHING_TO_SWAP";
 const expected=await publicClient.readContract({address:ROUTY_DEPLOYMENT.swapOracleQuoter as Address,abi:quoterAbi,functionName:"expectedOut",args:[ROUTY_DEPLOYMENT.oracleRegistry as Address,ROUTY_DEPLOYMENT.oracleGuard as Address,quote,target,amountIn]});
 // Slippage must stay inside the executor's own deviation bound (MAX_PRICE_DEVIATION_BPS).
 const deviationRaw=Number(process.env.MAX_PRICE_DEVIATION_BPS||"200");
 const slippageRaw=Number(process.env.MAX_SLIPPAGE_BPS||"100");
 const deviation=Number.isFinite(deviationRaw)?Math.max(0,Math.min(Math.floor(deviationRaw),2000)):200;
 const slippage=Number.isFinite(slippageRaw)?Math.max(0,Math.min(Math.floor(slippageRaw),deviation)):Math.min(100,deviation);
 const minOut=expected*BigInt(10_000-slippage)/10_000n;
 if(minOut===0n)return "ORACLE_QUOTE_ZERO";
 const deadline=BigInt(Math.floor(Date.now()/1000)+10*60);
 const {request}=await publicClient.simulateContract({account,address:executor,abi:executorAbi,functionName:"execute",args:[vault,amountIn,minOut,deadline]});
 const hash=await walletClient.writeContract(request);
 const receipt=await publicClient.waitForTransactionReceipt({hash});
 if(receipt.status!=="success")throw new Error("SWAP_REVERTED "+hash);
 return "swapped "+amountIn.toString();
}

async function handle(req:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,error:"CRON_SECRET_MISSING"},{status:503});
 if(req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});

 let status:Awaited<ReturnType<typeof rewardAutomationStatus>>;
 try{status=await rewardAutomationStatus()}
 catch(error){return NextResponse.json({ok:false,error:"AUTOMATION_CONFIGURATION_UNAVAILABLE",message:reason(error)},{status:503})}
 if(!status.automationEnabled)return NextResponse.json({ok:false,error:"AUTOMATION_DISABLED",status},{status:409});
 if(!status.keeperMatches)return NextResponse.json({ok:false,error:"KEEPER_ADDRESS_MISMATCH",status},{status:409});
 const account=keeperAccount();
 if(!account)return NextResponse.json({ok:false,error:"KEEPER_KEY_MISSING"},{status:503});

 const started=Date.now();
 try{
  const rpc=process.env.RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  const publicClient=createPublicClient({chain,transport:http(rpc)}) as PublicClient;
  const walletClient=createWalletClient({account,chain,transport:http(rpc)});
  const controller=requireCurrentDeployment().controller as Address;
  const swapEnabled=process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true";

  const single=req.nextUrl.searchParams.get("token");
  if(single&&!isAddress(single))return NextResponse.json({ok:false,error:"INVALID_TOKEN"},{status:400});
  const tokens=single?[single as Address]:await readyTokens();
  const results:TokenResult[]=[];

  for(const token of tokens){
   if(Date.now()-started>TIME_BUDGET_MS)break;
   const out:TokenResult={token,harvest:"skipped",distribution:"skipped"};
   let lease:string|null=null;
   try{
    const job=await claimRewardToken(token);
    if(!job){out.distribution="BUSY_OR_NOT_READY";results.push(out);continue}
    lease=job.reward_lease_until;
    const launcher=requireCurrentDeployment().launcher as Address;
    const route=await publicClient.readContract({address:launcher,abi:launcherAbi,functionName:"routes",args:[token]});
    const [,,,vault,router,distributor]=route;
    if(vault===ZERO||distributor===ZERO){out.distribution="ROUTE_NOT_PROVISIONED";results.push(out);continue}

    // 1. Harvest creator fees (permissionless).
    try{
     const {request}=await publicClient.simulateContract({account,address:router,abi:routerAbi,functionName:"harvest"});
     const hash=await walletClient.writeContract(request);
     const receipt=await publicClient.waitForTransactionReceipt({hash});
     out.harvest=receipt.status==="success"?"harvested":"HARVEST_REVERTED";
    }catch(error){
     out.harvest=/NO_NEW_FEES/.test(reason(error))?"no_new_fees":"harvest_failed: "+reason(error);
    }

    // 2. Swap earned quote into the Stock Token (funds the distributor). Only when explicitly enabled.
    if(swapEnabled){
     try{out.swap=await swapEarned(publicClient,walletClient,account,vault)}
     catch(error){out.swap="swap_failed: "+reason(error)}
    }else out.swap="disabled";

    // 3. Distribute whatever the distributor holds, using the allocation endpoint as the single source of truth.
    const paused=await publicClient.readContract({address:distributor,abi:distributorAbi,functionName:"paused"}).catch(()=>null);
    if(paused===null){out.distribution="DISTRIBUTOR_STATUS_UNAVAILABLE";results.push(out);continue}
    if(paused){out.distribution="DISTRIBUTOR_PAUSED";results.push(out);continue}
    let plan=readRewardPlan(job.reward_plan,{token,distributor,controller});
    if(!plan){
     const allocationUrl=new URL("/api/rewards/allocation",req.url);allocationUrl.searchParams.set("token",token);
     const allocationRes=await fetch(allocationUrl,{cache:"no-store"});
     const allocation=await allocationRes.json();
     if(!allocationRes.ok||!allocation.ok){out.distribution="ALLOCATION_UNAVAILABLE";out.error=String(allocation?.error||allocationRes.status);results.push(out);continue}
     if(!allocation.allocations?.length){out.distribution=allocation.reason||"NO_REWARDS";results.push(out);continue}
     plan=readRewardPlan({version:1,token,distributor,controller,snapshotBlock:allocation.snapshotBlock,fundedBalance:allocation.fundedBalance,allocations:allocation.allocations},{token,distributor,controller}) as RewardPlan;
     // Durable before the first transaction: retries keep the original snapshot and targets.
     await patchRewardJob(token,lease,{reward_plan:plan});
    }
    let recipients=0;
    let interrupted=false;
    for(let index=plan.nextIndex??0;index<plan.allocations.length;index+=200){
     if(Date.now()-started>TIME_BUDGET_MS){out.distribution="TIME_BUDGET_EXCEEDED";interrupted=true;break}
     const batch=plan.allocations.slice(index,index+200);
     const balances=await Promise.all(batch.map(async row=>[
      row.address.toLowerCase(),await publicClient.readContract({address:distributor,abi:distributorAbi,functionName:"distributedTo",args:[row.address]})
     ] as const));
     const unpaid=unpaidRewardRows({...plan,allocations:batch},new Map(balances));
     if(!unpaid.length){
      plan={...plan,nextIndex:Math.min(index+200,plan.allocations.length)};
      await patchRewardJob(token,lease,{reward_plan:plan});
      continue;
     }
     const {request}=await publicClient.simulateContract({account,address:controller,abi:controllerAbi,functionName:"distribute",args:[distributor,unpaid.map(row=>row.address),unpaid.map(row=>BigInt(row.cumulativeAmount))]});
     const hash=await walletClient.writeContract(request);
     const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:20_000});
     if(receipt.status!=="success")throw new Error("DISTRIBUTE_REVERTED "+hash);
     recipients+=unpaid.length;
     out.batches=(out.batches??0)+1;
     plan={...plan,nextIndex:Math.min(index+200,plan.allocations.length)};
     await patchRewardJob(token,lease,{reward_plan:plan});
    }
    out.recipients=recipients;
    out.amount=plan.fundedBalance;
    if(!interrupted){
     await patchRewardJob(token,lease,{reward_plan:null});
     out.distribution="distributed";
    }
   }catch(error){
    out.error=reason(error);
   }finally{
    if(lease)await patchRewardJob(token,lease,{reward_lease_until:null}).catch(error=>{console.error("[reward-automation] LEASE_RELEASE_FAILED",reason(error))});
   }
   results.push(out);
  }
  return NextResponse.json({ok:true,keeper:account.address,processed:results.length,results});
 }catch(error){
  return NextResponse.json({ok:false,error:"RUN_FAILED",message:reason(error)},{status:503});
 }
}

export async function GET(req:NextRequest){return handle(req)}
export async function POST(req:NextRequest){return handle(req)}
