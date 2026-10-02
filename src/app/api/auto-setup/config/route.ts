import {NextResponse} from "next/server";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";

export async function GET(){
 const rawKey=process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim()||"";
 const requested=process.env.ROUTY_AUTO_SETUP_ENABLED==="true";
 const keyValid=/^0x[0-9a-fA-F]{64}$/.test(rawKey);
 const serviceRoleConfigured=Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
 const cronSecretConfigured=Boolean(process.env.CRON_SECRET?.trim());
 const enabled=Boolean(requested&&keyValid&&serviceRoleConfigured&&cronSecretConfigured&&ROUTY_DEPLOYMENT.protocolLauncherV4&&ROUTY_DEPLOYMENT.swapExecutorV4&&ROUTY_DEPLOYMENT.rewardAutomationControllerV4);
 return NextResponse.json({
  ok:true,
  enabled,
  mode:enabled?"automatic":"manual-fallback",
  readiness:{
   automationKeyConfigured:keyValid,
   automationKeyHas0xPrefix:rawKey.startsWith("0x"),
   automationKeyLength:rawKey.length,
   supabaseServiceRoleConfigured:serviceRoleConfigured,
   cronSecretConfigured:cronSecretConfigured,
   rpcConfigured:Boolean(process.env.RPC_URL?.trim()),
   launcherV4Configured:Boolean(ROUTY_DEPLOYMENT.protocolLauncherV4),
   executorV4Configured:Boolean(ROUTY_DEPLOYMENT.swapExecutorV4),
   rewardControllerV4Configured:Boolean(ROUTY_DEPLOYMENT.rewardAutomationControllerV4)
  }
 });
}
