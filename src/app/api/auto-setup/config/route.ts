import {NextResponse} from "next/server";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";

export async function GET(){
 const rawKey=process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim()||"";
 const requested=process.env.ROUTY_AUTO_SETUP_ENABLED==="true";
 const keyValid=/^0x[0-9a-fA-F]{64}$/.test(rawKey);
 const serviceRoleConfigured=Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
 const cronSecretConfigured=Boolean(process.env.CRON_SECRET?.trim());
 const launcher=(process.env.ROUTY_LAUNCHER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV4);
 const executor=(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4);
 const rewardController=(process.env.ROUTY_REWARD_CONTROLLER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.rewardAutomationControllerV4);
 const enabled=Boolean(requested&&keyValid&&serviceRoleConfigured&&cronSecretConfigured&&launcher&&executor&&rewardController);
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
   swapExecutionRequested:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",
   launcherV4Configured:Boolean(ROUTY_DEPLOYMENT.protocolLauncherV4),
   executorV4Configured:Boolean(ROUTY_DEPLOYMENT.swapExecutorV4),
   rewardControllerV4Configured:Boolean(ROUTY_DEPLOYMENT.rewardAutomationControllerV4)
  }
 });
}
