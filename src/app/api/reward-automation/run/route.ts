import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,createWalletClient,http,isAddress,type Address,type PublicClient} from "viem";
import {rewardAutomationStatus,keeperAccount} from "@/lib/reward-automation-guard";
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
const distributorAbi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;

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
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?select=token_address&status=eq.ready&order=created_at.asc&limit="+MAX_TOKENS_PER_RUN,{headers:dbHeaders(),cache:"no-store"});
 if(!r.ok)throw new Error("QUEUE_READ_FAILED (HTTP "+r.status+"): "+(await r.text().catch(()=>"")).slice(0,300));
 const rows=await r.json() as {token_address:string}[];
 return rows.map(x=>x.token_address).filter(a=>isAddress(a)) as Address[];
}
function reason(error:unknown){
 const e=error as {shortMessage?:string;message?:string};
 return (e?.shortMessage||e?.message||"unknown").slice(0,300);
}

// Executes SwapExecutor.execute for what the vault has earned, bounded by the oracle price and slippage.
async function swapEarned(publicClient:PublicClient,walletClient:Wallet,account:Keeper,vault:Address){
 const executor=(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4) as Address;
 const [available,quote,target,executorPaused]=await Promise.all([
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"availableEarned"}),
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"quoteToken"}),
  publicClient.readContract({address:vault,abi:vaultAbi,functionName:"targetAsset"}),
  publicClient.readContract({address:executor,abi:executorAbi,functionName:"paused"})
 ]);
 if(executorPaused)return "EXECUTOR_PAUSED";
 const minSwap=BigInt(process.env.ROUTY_MIN_SWAP_UNITS||"1");
 const cap=BigInt(process.env.ROUTY_MAX_SWAP_UNITS||"0");
 const amountIn=cap>0n&&available>cap?cap:available;
 if(amountIn<minSwap||amountIn===0n)return "NOTHING_TO_SWAP";
 const expected=await publicClient.readContract({address:ROUTY_DEPLOYMENT.swapOracleQuoter as Address,abi:quoterAbi,functionName:"expectedOut",args:[ROUTY_DEPLOYMENT.oracleRegistry as Address,ROUTY_DEPLOYMENT.oracleGuard as Address,quote,target,amountIn]});
 // Slippage must stay inside the executor's own deviation bound (MAX_PRICE_DEVIATION_BPS).
 const deviation=Math.min(Number(process.env.MAX_PRICE_DEVIATION_BPS||"200"),2000);
 const slippage=Math.min(Number(process.env.MAX_SLIPPAGE_BPS||"100"),deviation);
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

 const status=await rewardAutomationStatus();
 if(!status.automationEnabled)return NextResponse.json({ok:false,error:"AUTOMATION_DISABLED",status},{status:409});
 if(!status.keeperMatches)return NextResponse.json({ok:false,error:"KEEPER_ADDRESS_MISMATCH",status},{status:409});
 const account=keeperAccount();
 if(!account)return NextResponse.json({ok:false,error:"KEEPER_KEY_MISSING"},{status:503});

 const started=Date.now();
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const publicClient=createPublicClient({chain,transport:http(rpc)}) as PublicClient;
  const walletClient=createWalletClient({account,chain,transport:http(rpc)});
  const controller=ROUTY_DEPLOYMENT.rewardAutomationControllerV4 as Address;
  const swapEnabled=process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true";

  const single=req.nextUrl.searchParams.get("token");
  const tokens=single&&isAddress(single)?[single as Address]:await readyTokens();
  const results:TokenResult[]=[];

  for(const token of tokens){
   if(Date.now()-started>TIME_BUDGET_MS){results.push({token,harvest:"skipped",distribution:"TIME_BUDGET_EXCEEDED"});continue}
   const out:TokenResult={token,harvest:"skipped",distribution:"skipped"};
   try{
    const route=await publicClient.readContract({address:ROUTY_DEPLOYMENT.protocolLauncherV4 as Address,abi:launcherAbi,functionName:"routes",args:[token]});
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
    const paused=await publicClient.readContract({address:distributor,abi:distributorAbi,functionName:"paused"}).catch(()=>false);
    if(paused){out.distribution="DISTRIBUTOR_PAUSED";results.push(out);continue}
    const allocationUrl=new URL("/api/rewards/allocation",req.url);allocationUrl.searchParams.set("token",token);
    const allocationRes=await fetch(allocationUrl,{cache:"no-store"});
    const allocation=await allocationRes.json();
    if(!allocationRes.ok||!allocation.ok){out.distribution="ALLOCATION_UNAVAILABLE";out.error=String(allocation?.error||allocationRes.status);results.push(out);continue}
    if(!allocation.batches?.length){out.distribution=allocation.reason||"NO_REWARDS";results.push(out);continue}

    let recipients=0;
    for(const batch of allocation.batches as {accounts:Address[];cumulativeAmounts:string[]}[]){
     if(Date.now()-started>TIME_BUDGET_MS){out.distribution="TIME_BUDGET_EXCEEDED";break}
     const {request}=await publicClient.simulateContract({account,address:controller,abi:controllerAbi,functionName:"distribute",args:[allocation.distributor as Address,batch.accounts,batch.cumulativeAmounts.map(x=>BigInt(x))]});
     const hash=await walletClient.writeContract(request);
     const receipt=await publicClient.waitForTransactionReceipt({hash});
     if(receipt.status!=="success")throw new Error("DISTRIBUTE_REVERTED "+hash);
     recipients+=batch.accounts.length;
     out.batches=(out.batches??0)+1;
    }
    out.recipients=recipients;
    out.amount=String(allocation.fundedBalance);
    if(out.distribution==="skipped")out.distribution="distributed";
   }catch(error){
    out.error=reason(error);
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
