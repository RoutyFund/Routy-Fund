import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,http,isAddress,type Address,type Hex} from "viem";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

export const dynamic="force-dynamic";
const SUPABASE_URL="https://hcwtwtvovdzfuugnjqyz.supabase.co";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;

function dbHeaders():Record<string,string>{
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
 const prefer="resolution=merge-duplicates,return=representation";
 // New-format sb_secret_ keys are not JWTs; Supabase rejects them in the Authorization header.
 return key.startsWith("sb_")?{apikey:key,"Content-Type":"application/json",Prefer:prefer}:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:prefer};
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json() as {token?:string;creator?:string;targetAsset?:string;policy?:number;launchTx?:string};
  if(!body.token||!isAddress(body.token)||!body.creator||!isAddress(body.creator)||!body.targetAsset||!isAddress(body.targetAsset))return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
  if(!Number.isInteger(body.policy)||body.policy===undefined||body.policy<0||body.policy>2)return NextResponse.json({ok:false,error:"INVALID_POLICY"},{status:400});
  const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===body.targetAsset!.toLowerCase());
  if(!route)return NextResponse.json({ok:false,error:"UNVERIFIED_ROUTE"},{status:400});

  const client=createPublicClient({chain,transport:http(process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0])});
  const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[body.token as Address]});
  if(!launch.exists)return NextResponse.json({ok:false,error:"NOT_PONS_TOKEN"},{status:400});
  if(launch.creatorFeeRecipient.toLowerCase()!==body.creator.toLowerCase())return NextResponse.json({ok:false,error:"CREATOR_MISMATCH"},{status:403});
  if(launch.pairToken.toLowerCase()!==route.quote.toLowerCase())return NextResponse.json({ok:false,error:"PAIR_MISMATCH"},{status:400});

  const existing=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?select=status,target_asset,reward_policy&token_address=eq."+encodeURIComponent(body.token.toLowerCase())+"&limit=1",{headers:dbHeaders(),cache:"no-store"});\n  if(existing.ok){const rows=await existing.json() as Array<{status:string;target_asset:string;reward_policy:number}>;const current=rows[0];if(current&&current.status==="ready")return NextResponse.json({ok:true,queued:false,alreadyReady:true,token:body.token,targetSymbol:route.symbol});}\n\n  const payload={
   token_address:body.token.toLowerCase(),
   creator_address:body.creator.toLowerCase(),
   target_asset:route.target.toLowerCase(),
   target_symbol:route.symbol,
   reward_policy:body.policy,
   launch_tx:body.launchTx||null,
   status:"queued"
  };
  const db=await fetch(SUPABASE_URL+"/rest/v1/route_setup_queue?on_conflict=token_address",{method:"POST",headers:dbHeaders(),body:JSON.stringify(payload),cache:"no-store"});
  const data=await db.json().catch(()=>null);
  if(!db.ok)return NextResponse.json({ok:false,error:"QUEUE_WRITE_FAILED",detail:data},{status:503});
  return NextResponse.json({ok:true,queued:true,token:body.token,targetSymbol:route.symbol});
 }catch(error){
  return NextResponse.json({ok:false,error:"QUEUE_UNAVAILABLE",message:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
