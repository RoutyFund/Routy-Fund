import {NextResponse} from "next/server";
import {currentDeployment} from "@/lib/active-deployment";
export const dynamic = "force-dynamic";
export async function GET() {
  const rawKey = process.env.ROUTY_AUTOMATION_PRIVATE_KEY?.trim() || "";
  const requested = process.env.ROUTY_AUTO_SETUP_ENABLED === "true";
  const keyValid = /^0x[0-9a-fA-F]{64}$/.test(rawKey);
  const serviceRoleConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const rpcConfigured = Boolean(process.env.RPC_URL?.trim());
  const deployment = currentDeployment();
  const enabled = requested && keyValid && serviceRoleConfigured && cronSecretConfigured && rpcConfigured && deployment.configured;
  const directFeeV5Configured = deployment.version === "V5" && deployment.configured;
  return NextResponse.json({
    ok: true, enabled, generation: deployment.version.toLowerCase(),
    launchReady: enabled && directFeeV5Configured,
    mode: enabled ? "automatic" : "manual-fallback",
    deployment: {
      version: deployment.version, launcher: deployment.launcher, executor: deployment.executor,
      controller: deployment.controller, routerFactory: deployment.routerFactory,
      configured: deployment.configured, missing: deployment.missing,
    },
    readiness: {
      automationKeyConfigured: keyValid,
      supabaseServiceRoleConfigured: serviceRoleConfigured,
      cronSecretConfigured, rpcConfigured,
      swapExecutionRequested: process.env.ROUTY_SWAP_EXECUTION_ENABLED === "true",
      launcherV4Configured: deployment.version === "V4" && Boolean(deployment.launcher),
      executorV4Configured: deployment.version === "V4" && Boolean(deployment.executor),
      rewardControllerV4Configured: deployment.version === "V4" && Boolean(deployment.controller),
      directFeeV5Configured,
    },
  });
}
