import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

const launcherV2=()=>process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_V2_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncherV2;

export function publicProtocolReady(){
 return Boolean(
  launcherV2()&&
  (process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 )
}

export function protocolReadiness(){
 return {
  generation:"v2",
  launcher:Boolean(launcherV2()),
  registry:Boolean(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 }
}
