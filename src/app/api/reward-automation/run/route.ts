import {NextRequest,NextResponse} from "next/server";
import {rewardAutomationStatus} from "@/lib/reward-automation-guard";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret)return NextResponse.json({ok:false,error:"CRON_SECRET_MISSING"},{status:503});
 if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:"UNAUTHORIZED"},{status:401});
 const status=await rewardAutomationStatus();
 if(!status.automationEnabled)return NextResponse.json({ok:false,error:"AUTOMATION_DISABLED",status},{status:409});
 if(!status.keeperMatches)return NextResponse.json({ok:false,error:"KEEPER_ADDRESS_MISMATCH",status},{status:409});
 return NextResponse.json({ok:true,status,state:"GUARDS_PASSED_EXECUTION_NOT_ENABLED"});
}
