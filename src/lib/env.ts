import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

const launcherV3=()=>process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_V3_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncherV3;

export function publicProtocolReady(){
 return Boolean(
  launcherV3()&&
  (process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 )
}

export function protocolReadiness(){
 return {
  generation:"v3",
  launcher:Boolean(launcherV3()),
  registry:Boolean(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 }
}
