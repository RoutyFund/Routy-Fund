import type {Address, PublicClient} from "viem";

// These immutable protocol contracts have code from their creation block onward.
// Historical RPC failure must propagate; a recent-window guess loses holders/events.
export async function firstCodeBlock(head: bigint, hasCode: (block: bigint) => Promise<boolean>): Promise<bigint> {
  if (head < 0n || !(await hasCode(head))) throw new Error("CONTRACT_NOT_DEPLOYED_AT_SNAPSHOT");
  let low = 0n, high = head;
  while (low < high) {
    const middle = (low + high) / 2n;
    if (await hasCode(middle)) high = middle;
    else low = middle + 1n;
  }
  return low;
}

const creationBlocks = new Map<string, Promise<bigint>>();
export async function contractCreationBlock(client: PublicClient, address: Address, head: bigint): Promise<bigint> {
  const key = `${client.chain?.id}:${address.toLowerCase()}`;
  let pending = creationBlocks.get(key);
  if (!pending) {
    pending = firstCodeBlock(head, async blockNumber => {
      const code = await client.getCode({address, blockNumber});
      return Boolean(code && code !== "0x");
    });
    creationBlocks.set(key, pending);
    pending.catch(() => creationBlocks.delete(key));
  }
  const block = await pending;
  if (block > head) throw new Error("CONTRACT_NOT_DEPLOYED_AT_SNAPSHOT");
  return block;
}
