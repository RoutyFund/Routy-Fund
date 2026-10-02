import {NextResponse} from "next/server";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const dynamic="force-dynamic";

export async function GET(){
 const rawKey=process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim()||"";
 const requested=process.env.ROUTY_AUTO_SETUP_ENABLED==="true";
 const keyValid=/^0x[0-9a-fA-F]{64}$/.test(rawKey);
 const serviceRoleConfigured=Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
 const cronSecretConfigured=Boolean(process.env.CRON_SECRET?.trim());
 const v5Requested=Boolean(process.env.ROUTY_LAUNCHER_V5_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV5);
 const launcher=v5Requested?(process.env.ROUTY_LAUNCHER_V5_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV5):(process.env.ROUTY_LAUNCHER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.protocolLauncherV4);
 const executor=v5Requested?(process.env.ROUTY_SWAP_EXECUTOR_V5_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV5):(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.swapExecutorV4);
 const rewardController=v5Requested?(process.env.ROUTY_REWARD_CONTROLLER_V5_ADDRESS?.trim()||ROUTY_DEPLOYMENT.rewardAutomationControllerV5):(process.env.ROUTY_REWARD_CONTROLLER_V4_ADDRESS?.trim()||ROUTY_DEPLOYMENT.rewardAutomationControllerV4);
 const feeRouterFactoryV5=process.env.ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS?.trim()||ROUTY_DEPLOYMENT.feeRouterFactoryV5;
 const rpcConfigured=Boolean(process.env.RPC_URL?.trim());
 const enabled=Boolean(requested&&keyValid&&serviceRoleConfigured&&cronSecretConfigured&&rpcConfigured&&launcher&&executor&&rewardController&&(!v5Requested||feeRouterFactoryV5));
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
   rpcConfigured,
   swapExecutionRequested:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",
   launcherV4Configured:Boolean(launcher),
   executorV4Configured:Boolean(executor),
   rewardControllerV4Configured:!v5Requested&&Boolean(rewardController),
   directFeeV5Configured:v5Requested&&Boolean(feeRouterFactoryV5&&launcher&&executor&&rewardController)
  }
 });
}
