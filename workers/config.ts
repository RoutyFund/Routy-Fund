export const config={
  chainId:4663,
  rpcUrl:process.env.RPC_URL??process.env.NEXT_PUBLIC_RPC_URL??"",
  keeperKey:process.env.KEEPER_PRIVATE_KEY??"",
  minHarvestWei:BigInt(process.env.MIN_HARVEST_WEI??"0"),
  maxSlippageBps:Number(process.env.MAX_SLIPPAGE_BPS??"100"),
  maxPriceDeviationBps:Number(process.env.MAX_PRICE_DEVIATION_BPS??"200"),
} as const;
