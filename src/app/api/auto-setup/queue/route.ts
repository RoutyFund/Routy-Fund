import {publicErrorMessage} from "@/lib/public-error";
import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,http,isAddress,type Address,type Hex} from "viem";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {matchesV5LaunchIntent} from "@/lib/v5-launch-intent";

export const dynamic="force-dynamic";
const SUPABASE_URL="https://hcwtwtvovdzfuugnjqyz.supabase.co";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const ZERO="0x0000000000000000000000000000000000000000";
const factoryAbi=[{type:"function",name:"predictRouter",stateMutability:"view",inputs:[{name:"creator",type:"address"},{name:"salt",type:"bytes32"}],outputs:[{type:"address"}]}] as const;

function dbHeaders():Record<string,string>{
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
 // A duplicate public request must never reset a claimed job or change its choices.
 const prefer="resolution=ignore-duplicates,return=representation";
 // New-format sb_secret_ keys are not JWTs; Supabase rejects them in the Authorization header.
 return key.startsWith("sb_")?{apikey:key,"Content-Type":"application/json",Prefer:prefer}:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:prefer};
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json() as {token?:string;creator?:string;targetAsset?:string;policy?:number;launchTx?:string;setupNonce?:string;feeRouter?:string;intentNonce?:string};
  if(!body.token||!isAddress(body.token)||!body.creator||!isAddress(body.creator)||!body.targetAsset||!isAddress(body.targetAsset))return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
  if(!Number.isInteger(body.policy)||body.policy===undefined||body.policy<0||body.policy>2)return NextResponse.json({ok:false,error:"INVALID_POLICY"},{status:400});
  const deployment=requireCurrentDeployment();
  if(deployment.version!=="V5")return NextResponse.json({ok:false,error:"V5_AUTOMATION_REQUIRED"},{status:409});
  if(!body.setupNonce||!/^0x[0-9a-fA-F]{64}$/.test(body.setupNonce)||!body.feeRouter||!isAddress(body.feeRouter)||body.feeRouter.toLowerCase()===ZERO)return NextResponse.json({ok:false,error:"INVALID_V5_ROUTER"},{status:400});
  if(!body.intentNonce||!matchesV5LaunchIntent(body.setupNonce,{creator:body.creator,targetAsset:body.targetAsset,policy:body.policy,nonce:body.intentNonce}))return NextResponse.json({ok:false,error:"LAUNCH_INTENT_MISMATCH"},{status:403});
  const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===body.targetAsset!.toLowerCase());
  if(!route)return NextResponse.json({ok:false,error:"UNVERIFIED_ROUTE"},{status:400});

  const rpc=process.env.RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[body.token as Address]});
  if(!launch.exists)return NextResponse.json({ok:false,error:"NOT_PONS_TOKEN"},{status:400});
  if(launch.deployer.toLowerCase()!==body.creator.toLowerCase())return NextResponse.json({ok:false,error:"CREATOR_MISMATCH"},{status:403});
  const predicted=await client.readContract({address:deployment.routerFactory as Address,abi:factoryAbi,functionName:"predictRouter",args:[body.creator as Address,body.setupNonce as Hex]});
  if(predicted.toLowerCase()!==body.feeRouter.toLowerCase()||launch.creatorFeeRecipient.toLowerCase()!==predicted.toLowerCase())return NextResponse.json({ok:false,error:"FEE_ROUTER_MISMATCH"},{status:403});
  if(launch.pairToken.toLowerCase()!==route.quote.toLowerCase())return NextResponse.json({ok:false,error:"PAIR_MISMATCH"},{status:400});

  const existing=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?select=status,target_asset,reward_policy&token_address=eq."+encodeURIComponent(body.token.toLowerCase())+"&limit=1",{headers:dbHeaders(),cache:"no-store"});
  if(existing.ok){const rows=await existing.json() as Array<{status:string;target_asset:string;reward_policy:number}>;const current=rows[0];if(current&&current.status==="ready")return NextResponse.json({ok:true,queued:false,alreadyReady:true,token:body.token,targetSymbol:route.symbol});}

  const payload={
   token_address:body.token.toLowerCase(),
   creator_address:body.creator.toLowerCase(),
   target_asset:route.target.toLowerCase(),
   target_symbol:route.symbol,
   reward_policy:body.policy,
   launch_tx:body.launchTx||null,
   status:"queued",
   setup_nonce:body.setupNonce,
   router_address:body.feeRouter.toLowerCase()
  };
  const db=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?on_conflict=token_address",{method:"POST",headers:dbHeaders(),body:JSON.stringify(payload),cache:"no-store"});
  const data=await db.json().catch(()=>null);
  if(!db.ok)return NextResponse.json({ok:false,error:"QUEUE_WRITE_FAILED",detail:data},{status:503});
  if(!Array.isArray(data))return NextResponse.json({ok:false,error:"QUEUE_RESPONSE_INVALID"},{status:503});
  return NextResponse.json({ok:true,queued:data.length>0,alreadyQueued:data.length===0,token:body.token,targetSymbol:route.symbol});
 }catch(error){
  return NextResponse.json({ok:false,error:"QUEUE_UNAVAILABLE",message:publicErrorMessage(error)},{status:503});
 }
}
