import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export const FIRST_PRODUCTION_ROUTE = {
  chainId: 4663,
  symbol: "AAPL",
  target: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" as Address,
  targetFeed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0" as Address,
  quoteSymbol: "USDG",
  quote: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,
  quoteFeed: "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2" as Address,
  poolId: "0xc748f4671a867db48b552f6b7650bf3255e05f80f00e3f7aad1b17ccb7898fdb" as Hex,
  poolKey: {
    currency0: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,
    currency1: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" as Address,
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000" as Address,
  },
} as const;

export function firstProductionPoolId(): Hex {
  const key = FIRST_PRODUCTION_ROUTE.poolKey;
  return keccak256(encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint24" },
      { type: "int24" },
      { type: "address" },
    ],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
  ));
}

export function firstProductionPoolKeyMatches(): boolean {
  return firstProductionPoolId().toLowerCase() === FIRST_PRODUCTION_ROUTE.poolId.toLowerCase();
}
