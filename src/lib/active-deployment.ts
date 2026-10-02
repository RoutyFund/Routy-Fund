import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

const env=(name:string)=>process.env[name]?.trim()||"";

// The live Routy deployment: V5 (Pons creator fees go directly to the FeeRouter) when its launcher is configured,
// otherwise V4. V5 addresses come from the environment only and fail closed (empty string) if any is missing.
export function currentDeployment(){
 if(env("ROUTY_LAUNCHER_V5_ADDRESS"))return{
  version:"V5" as const,
  launcher:env("ROUTY_LAUNCHER_V5_ADDRESS"),
  executor:env("ROUTY_SWAP_EXECUTOR_V5_ADDRESS"),
  controller:env("ROUTY_REWARD_CONTROLLER_V5_ADDRESS")
 };
 return{
  version:"V4" as const,
  launcher:env("ROUTY_LAUNCHER_V4_ADDRESS")||ROUTY_DEPLOYMENT.protocolLauncherV4,
  executor:env("ROUTY_SWAP_EXECUTOR_V4_ADDRESS")||ROUTY_DEPLOYMENT.swapExecutorV4,
  controller:env("ROUTY_REWARD_CONTROLLER_V4_ADDRESS")||ROUTY_DEPLOYMENT.rewardAutomationControllerV4
 };
}
