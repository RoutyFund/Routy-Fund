import {NextResponse} from "next/server";
import {blockers,infrastructureReady,ready,serverReadiness} from "@/lib/readiness";

export function GET(){
  const checks=serverReadiness();
  return NextResponse.json({
    ready:ready(checks),
    infrastructureReady:infrastructureReady(checks),
    blockers:blockers(checks),
    checks,
    scope:"deployment-and-worker-configuration",
    executionStatusUrl:"/api/config",
    chainId:4663
  });
}
