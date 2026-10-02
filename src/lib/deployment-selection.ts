export type DeploymentEnvironment = Record<string, string | undefined>;
export type DeploymentFallback = {
  protocolLauncherV4: string; swapExecutorV4: string;
  rewardAutomationControllerV4: string; feeRouterFactoryV4: string;
};
export const V5_DEPLOYMENT_ENV = [
  "ROUTY_LAUNCHER_V5_ADDRESS", "ROUTY_SWAP_EXECUTOR_V5_ADDRESS",
  "ROUTY_REWARD_CONTROLLER_V5_ADDRESS", "ROUTY_FEE_ROUTER_FACTORY_V5_ADDRESS",
] as const;
export function deploymentAddress(value: string | undefined): string {
  const address = value?.trim() || "";
  return /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address) ? address : "";
}
export function selectDeployment(environment: DeploymentEnvironment, fallback: DeploymentFallback) {
  // Partially entered V5 configuration must never silently select V4.
  const version = V5_DEPLOYMENT_ENV.some(name => Boolean(environment[name]?.trim())) ? "V5" : "V4";
  const names = version === "V5" ? V5_DEPLOYMENT_ENV : [
    "ROUTY_LAUNCHER_V4_ADDRESS", "ROUTY_SWAP_EXECUTOR_V4_ADDRESS",
    "ROUTY_REWARD_CONTROLLER_V4_ADDRESS", "ROUTY_FEE_ROUTER_FACTORY_V4_ADDRESS",
  ] as const;
  const defaults = version === "V5" ? ["", "", "", ""] : [
    fallback.protocolLauncherV4, fallback.swapExecutorV4,
    fallback.rewardAutomationControllerV4, fallback.feeRouterFactoryV4,
  ];
  const values = names.map((name, index) => deploymentAddress(environment[name]?.trim() || defaults[index]));
  const missing = names.filter((_, index) => !values[index]);
  return {
    version, launcher: values[0], executor: values[1], controller: values[2],
    routerFactory: values[3], configured: missing.length === 0, missing,
  };
}
