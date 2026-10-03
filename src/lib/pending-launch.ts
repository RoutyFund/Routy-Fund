import {isAddress} from "viem";

export const PENDING_LAUNCH_KEY = "routy:v5:pending-launch";
export type PendingLaunch = {
  version: 1; chainId: 4663; creator: string; targetAsset: string; policy: number;
  intentNonce: string; setupNonce: string; feeRouter: string; launchTx: string; logo?: string;
  token?: string; queued?: boolean;
};
export function readPendingLaunch(raw: string | null): PendingLaunch | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || value.chainId !== 4663
      || !Number.isInteger(value.policy) || value.policy < 0 || value.policy > 2) return null;
    for (const key of ["creator", "targetAsset", "feeRouter"]) {
      if (typeof value[key] !== "string" || !isAddress(value[key], {strict: false}) || /^0x0{40}$/i.test(value[key])) return null;
    }
    for (const key of ["launchTx", "setupNonce", "intentNonce"]) {
      if (typeof value[key] !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value[key])) return null;
    }
    if (value.token !== undefined && (typeof value.token !== "string" || !isAddress(value.token, {strict: false}))) return null;
    if (value.logo !== undefined && (typeof value.logo !== "string" || new TextEncoder().encode(value.logo).length > 512)) return null;
    if (value.queued !== undefined && typeof value.queued !== "boolean") return null;
    return value as PendingLaunch;
  } catch { return null; }
}
export function launchMetadataError(input: {logo: string; description: string; socials: string[]; tax: string; maxTax: number}): string {
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  if (bytes(input.logo) > 512) return "Logo URI exceeds 512 bytes.";
  if (bytes(input.description) > 2048) return "Description exceeds 2048 bytes.";
  if (input.socials.some(value => bytes(value) > 256)) return "A social link exceeds 256 bytes.";
  const tax = Number(input.tax);
  if (!/^\d+$/.test(input.tax) || !Number.isInteger(tax) || tax < 0 || tax > input.maxTax) return `Creator tax must be a whole number from 0 to ${input.maxTax} BPS.`;
  return "";
}
