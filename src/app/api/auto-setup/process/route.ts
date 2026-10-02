import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,createWalletClient,http,isAddress,type Address,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";
export const maxDuration=60;

const SUPABASE_URL="https://hcwtwtvovdzfuugnjqyz.supabase.co";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const launcherAbi=[
 {type:"function",name:"provision",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"},{name:"asset",type:"address"},{name:"policy",type:"uint8"}],outputs:[{name:"vault",type:"address"},{name:"router",type:"address"},{name:"distributor",type:"address"}]},
 {type:"function",name:"routes",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{name:"creator",type:"address"},{name:"targetAsset",type:"address"},{name:"quoteToken",type:"address"},{name:"vault",type:"address"},{name:"router",type:"address"},{name:"distributor",type:"address"},{name:"policy",type:"uint8"},{name:"createdAt",type:"uint64"}]},
] as const;
const executorAbi=[
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
 {type:"function",name:"setPaused",stateMutability:"nonpayable",inputs:[{name:"next",type:"bool"}],outputs:[]},
 {type:"function",name:"setPoolKey",stateMutability:"nonpayable",inputs:[{name:"vault",type:"address"},{name:"key",type:"tuple",components:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]}],outputs:[]},
 {type:"function",name:"poolKeyForVault",stateMutability:"view",inputs:[{name:"vault",type:"address"}],outputs:[{name:"currency0",type:"address"},{name:"currency1",type:"address"},{name:"fee",type:"uint24"},{name:"tickSpacing",type:"int24"},{name:"hooks",type:"address"}]}
] as const;
const controllerAbi=[{type:"function",name:"setDistributorPaused",stateMutability:"nonpayable",inputs:[{name:"distributor",type:"address"},{name:"next",type:"bool"}],outputs:[]}] as const;
const distributorAbi=[{type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]}] as const;

type Job={id:string;token_address:string;creator_address:string;target_asset:string;target_symbol:string;reward_policy:number;status:string;attempts:number};
function dbHeaders():Record<string,string>{
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
 // New-format sb_secret_ keys are not JWTs; Supabase rejects them in the Authorization header.
 return key.startsWith("sb_")?{apikey:key,"Content-Type":"application/json"}:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
}
async function patchJob(id:string,patch:Record<string,unknown>){
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{...dbHeaders(),Prefer:"return=minimal"},body:JSON.stringify({...patch,updated_at:new Date().toISOString()}),cache:"no-store"});
 if(!r.ok){const detail=(await r.text()).slice(0,500);console.error("[auto-setup] QUEUE_UPDATE_FAILED",r.status,detail);throw new Error(`QUEUE_UPDATE_FAILED_${r.status}`);}
}
async function claimJob(job:Job){
 const r=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?id=eq."+encodeURIComponent(job.id)+"&status=eq.queued",{
  method:"PATCH",
  headers:{...dbHeaders(),Prefer:"return=representation"},
  body:JSON.stringify({status:"provisioning",attempts:(job.attempts||0)+1,last_error:null,updated_at:new Date().toISOString()}),
  cache:"no-store"
 });
 if(!r.ok)throw new Error("QUEUE_CLAIM_FAILED_"+r.status);
 const rows=await r.json() as Job[];
 return rows.length===1;
}
function authorized(req:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return false;
 return req.headers.get("authorization")===`Bearer ${secret}`;
}

async function handle(req:NextRequest){
 if(!authorized(req))return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 if(process.env.ROUTY_AUTO_SETUP_ENABLED!=="true")return NextResponse.json({ok:false,error:"AUTOMATION_DISABLED"},{status:409});
 try{
  const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
  const rawKey=process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim();
  const launcher=process.env.ROUTY_LAUNCHER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV4;
  const executor=process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4;
  const controller=process.env.ROUTY_REWARD_CONTROLLER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.rewardAutomationControllerV4;
  if(!rawKey||!/^0x[0-9a-fA-F]{64}$/.test(rawKey)){console.error("[auto-setup] KEY_CHECK_FAILED");throw new Error("AUTOMATION_KEY_INVALID");}
  console.info("[auto-setup] KEY_CHECK_OK");
  if(!launcher||!isAddress(launcher)||!executor||!isAddress(executor)||!controller||!isAddress(controller)){console.error("[auto-setup] ADDRESS_CHECK_FAILED");throw new Error("V4_ADDRESSES_INVALID");}
  console.info("[auto-setup] ADDRESS_CHECK_OK");

  console.info("[auto-setup] SUPABASE_KEY_CONFIGURED",Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()));
  const q=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?status=eq.queued&order=created_at.asc&limit=1",{headers:{...dbHeaders(),Accept:"application/json"},cache:"no-store"});
  if(!q.ok){console.error("[auto-setup] QUEUE_READ_FAILED",q.status);throw new Error("QUEUE_READ_FAILED");}
  console.info("[auto-setup] QUEUE_READ_OK");
  const jobs=await q.json() as Job[];
  console.info("[auto-setup] QUEUE_JOB_COUNT",jobs.length);
  if(!jobs.length)return NextResponse.json({ok:true,processed:false,reason:"EMPTY_QUEUE"});
  const job=jobs[0];
  const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===job.target_asset.toLowerCase());
  if(!route||job.reward_policy<0||job.reward_policy>2){console.error("[auto-setup] INVALID_QUEUED_JOB",{routeFound:Boolean(route),policyValid:job.reward_policy>=0&&job.reward_policy<=2});throw new Error("INVALID_QUEUED_JOB");}
  console.info("[auto-setup] JOB_VALID");

  if(!(await claimJob(job)))return NextResponse.json({ok:true,processed:false,reason:"JOB_ALREADY_CLAIMED"});
  const account=privateKeyToAccount(rawKey as Hex);
  const publicClient=createPublicClient({chain,transport:http(rpc)});
  const walletClient=createWalletClient({account,chain,transport:http(rpc)});

  try{
   let state=await publicClient.readContract({address:launcher as Address,abi:launcherAbi,functionName:"routes",args:[job.token_address as Address]});
   let vault=state[3],router=state[4],distributor=state[5];
   if(vault==="0x0000000000000000000000000000000000000000"){
    const hash=await walletClient.writeContract({address:launcher as Address,abi:launcherAbi,functionName:"provision",args:[job.token_address as Address,route.target,job.reward_policy],account});
    const receipt=await publicClient.waitForTransactionReceipt({hash});
    if(receipt.status!=="success")throw new Error("PROVISION_FAILED");
    state=await publicClient.readContract({address:launcher as Address,abi:launcherAbi,functionName:"routes",args:[job.token_address as Address]});
    vault=state[3];router=state[4];distributor=state[5];
   }
   const zero="0x0000000000000000000000000000000000000000";
   if(vault===zero||router===zero||distributor===zero)throw new Error("PROVISION_STATE_INCOMPLETE");
   await patchJob(job.id,{status:"poolkey",provisioned:true,vault_address:vault,router_address:router,distributor_address:distributor,last_error:null});

   const configuredKey=await publicClient.readContract({address:executor as Address,abi:executorAbi,functionName:"poolKeyForVault",args:[vault]});
   const poolConfigured=configuredKey[0].toLowerCase()!==configuredKey[1].toLowerCase();
   if(!poolConfigured){
    const wasPaused=await publicClient.readContract({address:executor as Address,abi:executorAbi,functionName:"paused"});
    if(!wasPaused){
     const pauseHash=await walletClient.writeContract({address:executor as Address,abi:executorAbi,functionName:"setPaused",args:[true],account});
     const pauseReceipt=await publicClient.waitForTransactionReceipt({hash:pauseHash});
     if(pauseReceipt.status!=="success")throw new Error("EXECUTOR_PAUSE_FAILED");
    }
    const poolHash=await walletClient.writeContract({address:executor as Address,abi:executorAbi,functionName:"setPoolKey",args:[vault,route.poolKey],account});
    const poolReceipt=await publicClient.waitForTransactionReceipt({hash:poolHash});
    if(poolReceipt.status!=="success")throw new Error("POOLKEY_FAILED");
   }
   const executorPaused=await publicClient.readContract({address:executor as Address,abi:executorAbi,functionName:"paused"});
   if(executorPaused){
    const resumeHash=await walletClient.writeContract({address:executor as Address,abi:executorAbi,functionName:"setPaused",args:[false],account});
    const resumeReceipt=await publicClient.waitForTransactionReceipt({hash:resumeHash});
    if(resumeReceipt.status!=="success")throw new Error("EXECUTOR_RESUME_FAILED");
   }

   await patchJob(job.id,{status:"rewards",pool_key_configured:true,last_error:null});
   const rewardsPaused=await publicClient.readContract({address:distributor,abi:distributorAbi,functionName:"paused"});
   if(rewardsPaused){
    const rewardHash=await walletClient.writeContract({address:controller as Address,abi:controllerAbi,functionName:"setDistributorPaused",args:[distributor,false],account});
    const rewardReceipt=await publicClient.waitForTransactionReceipt({hash:rewardHash});
    if(rewardReceipt.status!=="success")throw new Error("REWARD_ACTIVATION_FAILED");
   }

   await patchJob(job.id,{status:"ready",provisioned:true,pool_key_configured:true,rewards_active:true,vault_address:vault,router_address:router,distributor_address:distributor,last_error:null});
   return NextResponse.json({ok:true,processed:true,token:job.token_address,status:"ready"});
  }catch(error){
   const message=error instanceof Error?error.message:"unknown";
   await patchJob(job.id,{status:"queued",last_error:message});
   return NextResponse.json({ok:false,error:"JOB_FAILED",message},{status:503});
  }
 }catch(error){
  const message=error instanceof Error?error.message:"unknown";
  console.error("[auto-setup] PROCESSOR_UNAVAILABLE",message);
  return NextResponse.json({ok:false,error:"PROCESSOR_UNAVAILABLE",message},{status:503});
 }
}


export async function GET(req:NextRequest){return handle(req)}
export async function POST(req:NextRequest){return handle(req)}
