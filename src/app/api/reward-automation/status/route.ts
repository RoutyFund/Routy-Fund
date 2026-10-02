import {NextResponse} from "next/server";
import {rewardAutomationStatus} from "@/lib/reward-automation-guard";
export const dynamic="force-dynamic";
export async function GET(){
 try{const status=await rewardAutomationStatus();return NextResponse.json({ok:true,...status,fullyReady:Boolean(status.automationEnabled&&status.keeperMatches&&status.cronSecretConfigured&&status.rpcConfigured)})}
 catch(error){return NextResponse.json({ok:false,error:"KEEPER_STATUS_UNAVAILABLE",detail:error instanceof Error?error.message:"unknown"},{status:503})}
}
