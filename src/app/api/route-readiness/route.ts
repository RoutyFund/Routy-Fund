import { NextResponse } from "next/server";
import { FIRST_PRODUCTION_ROUTE, firstProductionPoolId, firstProductionPoolKeyMatches } from "@/lib/production-route";

export function GET() {
  const computedPoolId = firstProductionPoolId();
  const poolKeyMatches = firstProductionPoolKeyMatches();
  return NextResponse.json({
    readyForOwnerConfiguration: poolKeyMatches,
    route: FIRST_PRODUCTION_ROUTE,
    verification: {
      expectedPoolId: FIRST_PRODUCTION_ROUTE.poolId,
      computedPoolId,
      poolKeyMatches,
    },
    note: poolKeyMatches
      ? "PoolKey deterministically matches the pinned AAPL/USDG Uniswap v4 pool ID. Owner transactions are still required for registry/feed/vault configuration."
      : "PoolKey does not match the pinned pool ID. Do not submit owner transactions.",
  }, { status: poolKeyMatches ? 200 : 409 });
}
