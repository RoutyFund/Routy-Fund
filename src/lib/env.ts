import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {currentDeployment} from "@/lib/active-deployment";
import {deploymentAddress} from "@/lib/deployment-selection";
export function publicProtocolReady() {
  return currentDeployment().configured && Boolean(deploymentAddress(
    process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS || ROUTY_DEPLOYMENT.assetRegistry,
  ));
}
export function protocolReadiness() {
  const deployment = currentDeployment();
  return {
    generation: deployment.version.toLowerCase(),
    launcher: Boolean(deployment.launcher),
    registry: Boolean(deploymentAddress(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS || ROUTY_DEPLOYMENT.assetRegistry)),
    executor: Boolean(deployment.executor),
    rewardController: Boolean(deployment.controller),
    feeRouterFactory: Boolean(deployment.routerFactory),
  };
}
