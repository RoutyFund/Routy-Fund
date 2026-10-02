import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {selectDeployment} from "@/lib/deployment-selection";
export function currentDeployment() {
  return selectDeployment(process.env, ROUTY_DEPLOYMENT);
}
export function requireCurrentDeployment() {
  const deployment = currentDeployment();
  if (!deployment.configured) {
    throw new Error(`${deployment.version}_DEPLOYMENT_INCOMPLETE: ${deployment.missing.join(", ")}`);
  }
  return deployment;
}
