import type {Address} from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";
export type TransferRow = {from: Address; to: Address; value: bigint};
export type HolderBalance = {address: Address; balance: bigint};

export function applyHolderTransfers(balances: Map<string, HolderBalance>, transfers: TransferRow[]) {
  for (const {from, to, value} of transfers) {
    if (value < 0n) throw new Error("INVALID_TRANSFER_VALUE");
    const fromKey = from.toLowerCase(), toKey = to.toLowerCase();
    if (fromKey !== ZERO) {
      const previous = balances.get(fromKey)?.balance ?? 0n;
      if (previous < value) throw new Error("INCOMPLETE_TRANSFER_HISTORY");
      balances.set(fromKey, {address: from, balance: previous - value});
    }
    if (toKey !== ZERO) {
      const previous = balances.get(toKey)?.balance ?? 0n;
      balances.set(toKey, {address: to, balance: previous + value});
    }
  }
}
