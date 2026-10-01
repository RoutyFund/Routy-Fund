import type {Address,Hex} from "viem";

export type ProductionRoute={
 symbol:string;
 name:string;
 target:Address;
 quoteSymbol:"USDG";
 quote:Address;
 targetFeed:Address;
 quoteFeed:Address;
 poolId:Hex;
 poolKey:{currency0:Address;currency1:Address;fee:number;tickSpacing:number;hooks:Address};
 source:"verified";
};

export const ROUTE_CATALOG:ProductionRoute[]=[{
 symbol:"AAPL",
 name:"Apple",
 target:"0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
 quoteSymbol:"USDG",
 quote:"0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
 targetFeed:"0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",
 quoteFeed:"0x61B7e5650328764B076A108EFF5fa7282a1B9aD2",
 poolId:"0xc748f4671a867db48b552f6b7650bf3255e05f80f00e3f7aad1b17ccb7898fdb",
 poolKey:{
  currency0:"0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  currency1:"0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  fee:3000,tickSpacing:60,hooks:"0x0000000000000000000000000000000000000000"
 },
 source:"verified"
}];

export const ROUTABLE_SYMBOLS=new Set(ROUTE_CATALOG.map(r=>r.symbol));
