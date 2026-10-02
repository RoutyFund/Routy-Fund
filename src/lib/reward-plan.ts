import {isAddress, type Address} from "viem";

export type RewardPlanRow = {address: Address; cumulativeAmount: string};
export type RewardPlan = {
  version: 1; token: Address; distributor: Address; controller: Address;
  snapshotBlock: string; fundedBalance: string; allocations: RewardPlanRow[];
};
export function readRewardPlan(value: unknown, expected: {token: Address; distributor: Address; controller: Address}): RewardPlan | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new Error("INVALID_REWARD_PLAN");
  const plan = value as RewardPlan;
  if (plan.version !== 1 || !/^\d+$/.test(plan.snapshotBlock) || !/^\d+$/.test(plan.fundedBalance)
    || !Array.isArray(plan.allocations) || !plan.allocations.length) throw new Error("INVALID_REWARD_PLAN");
  for (const key of ["token", "distributor", "controller"] as const) {
    if (typeof plan[key] !== "string" || plan[key].toLowerCase() !== expected[key].toLowerCase()) throw new Error("REWARD_PLAN_ROUTE_MISMATCH");
  }
  const seen = new Set<string>();
  for (const row of plan.allocations) {
    if (!isAddress(row.address, {strict:false}) || /^0x0{40}$/i.test(row.address)
      || typeof row.cumulativeAmount !== "string" || !/^\d+$/.test(row.cumulativeAmount)
      || BigInt(row.cumulativeAmount) === 0n || seen.has(row.address.toLowerCase())) throw new Error("INVALID_REWARD_PLAN_ROW");
    seen.add(row.address.toLowerCase());
  }
  return plan;
}

// Persist the same cumulative targets across partial payouts and receipt timeouts.
// Already-paid targets are omitted, so a retry never reallocates the remaining pot.
export function unpaidRewardRows(plan: RewardPlan, paid: Map<string, bigint>): RewardPlanRow[] {
  return plan.allocations.filter(row => BigInt(row.cumulativeAmount) > (paid.get(row.address.toLowerCase()) ?? 0n));
}
