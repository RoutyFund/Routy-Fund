import {publicErrorMessage} from "@/lib/public-error";
import {NextResponse} from "next/server";
import {rewardAutomationStatus} from "@/lib/reward-automation-guard";
export const dynamic="force-dynamic";
export async function GET(){
 try{const status=await rewardAutomationStatus();const configurationReady=Boolean(status.automationEnabled&&status.keeperMatches&&status.cronSecretConfigured&&status.rpcConfigured&&status.swapExecutionEnabled);return NextResponse.json({ok:true,...status,configurationReady,fullyReady:configurationReady&&status.swapExecutionActive})}
 catch(error){return NextResponse.json({ok:false,error:"KEEPER_STATUS_UNAVAILABLE",detail:publicErrorMessage(error)},{status:503})}
}
