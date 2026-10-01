import type { Address } from "viem";

export const EXECUTOR_STORAGE_SLOTS = {
  owner: "0x0",
  oracleRegistry: "0x2",
  oracleGuard: "0x3",
  oracleQuoter: "0x4",
  adapterAndSafety: "0x5",
} as const;

function storageBody(value: string): string {
  if (!/^0x[0-9a-f]{64}$/i.test(value)) {
    throw new Error("Wallet returned an invalid 32-byte storage word.");
  }
  return value.slice(2).toLowerCase();
}

export function addressFromStorageWord(value: string): Address {
  const address = `0x${storageBody(value).slice(24)}` as Address;
  if (/^0x0{40}$/.test(address)) throw new Error("Required on-chain address is zero.");
  return address;
}

export function decodeAdapterSafetyWord(value: string): {
  adapter: Address;
  maxDeviationBps: number;
  paused: boolean;
} {
  const body = storageBody(value);
  return {
    adapter: addressFromStorageWord(value),
    maxDeviationBps: Number.parseInt(body.slice(20, 24), 16),
    paused: Number.parseInt(body.slice(18, 20), 16) !== 0,
  };
}

export function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
