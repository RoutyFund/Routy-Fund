import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

const launcherV4=()=>process.env.ROUTY_LAUNCHER_V4_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncherV4;

export function publicProtocolReady(){
 return Boolean(
  launcherV4()&&
  (process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 )
}

export function protocolReadiness(){
 return {
  generation:"v4",
  launcher:Boolean(launcherV4()),
  registry:Boolean(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry),
  executor:Boolean(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS||ROUTY_DEPLOYMENT.swapExecutorV4),
  rewardController:Boolean(process.env.ROUTY_REWARD_CONTROLLER_V4_ADDRESS||ROUTY_DEPLOYMENT.rewardAutomationControllerV4)
 }
}
