import {NextResponse} from "next/server";
import {rewardAutomationStatus} from "@/lib/reward-automation-guard";
export const dynamic="force-dynamic";
export async function GET(){
 try{return NextResponse.json({ok:true,...await rewardAutomationStatus()})}
 catch(error){return NextResponse.json({ok:false,error:"KEEPER_STATUS_UNAVAILABLE",detail:error instanceof Error?error.message:"unknown"},{status:503})}
}
