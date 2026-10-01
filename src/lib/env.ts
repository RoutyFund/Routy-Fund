import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export function publicProtocolReady(){
 return Boolean(
  (process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncher)&&
  (process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 )
}

export function protocolReadiness(){
 return {
  launcher:Boolean(process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncher),
  registry:Boolean(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry)
 }
}
