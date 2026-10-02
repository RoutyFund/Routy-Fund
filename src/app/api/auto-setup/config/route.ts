import {NextResponse} from "next/server";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";

export async function GET(){
 const rawKey=process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim()||"";
 const enabled=process.env.ROUTY_AUTO_SETUP_ENABLED==="true";
 return NextResponse.json({
  ok:true,
  enabled,
  mode:enabled?"automatic":"manual-fallback",
  readiness:{
   automationKeyConfigured:Boolean(rawKey),
   automationKeyHas0xPrefix:rawKey.startsWith("0x"),
   automationKeyLength:rawKey.length,
   supabaseServiceRoleConfigured:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
   cronSecretConfigured:Boolean(process.env.CRON_SECRET?.trim()),
   rpcConfigured:Boolean(process.env.RPC_URL?.trim()),
   launcherV4Configured:Boolean(ROUTY_DEPLOYMENT.protocolLauncherV4),
   executorV4Configured:Boolean(ROUTY_DEPLOYMENT.swapExecutorV4),
   rewardControllerV4Configured:Boolean(ROUTY_DEPLOYMENT.rewardAutomationControllerV4)
  }
 });
}
