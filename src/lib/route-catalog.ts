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
 source:"verified"|"candidate";
 launchEnabled:boolean;
};

const USDG="0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address;
const USDG_FEED="0x61B7e5650328764B076A108EFF5fa7282a1B9aD2" as Address;
const NO_HOOK="0x0000000000000000000000000000000000000000" as Address;

export const ROUTE_CATALOG:ProductionRoute[]=[
{
 symbol:"AAPL",name:"Apple",
 target:"0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
 quoteSymbol:"USDG",quote:USDG,
 targetFeed:"0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",quoteFeed:USDG_FEED,
 poolId:"0xc748f4671a867db48b552f6b7650bf3255e05f80f00e3f7aad1b17ccb7898fdb",
 poolKey:{currency0:USDG,currency1:"0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",fee:3000,tickSpacing:60,hooks:NO_HOOK},
 source:"verified",launchEnabled:true
},
{
 symbol:"TSLA",name:"Tesla",
 target:"0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
 quoteSymbol:"USDG",quote:USDG,
 targetFeed:"0x4A1166a659A55625345e9515b32adECea5547C38",quoteFeed:USDG_FEED,
 poolId:"0x8517f8071ae5b831b738052f12125e8e3d6c158b78728aa44ce3b25e5104d32e",
 poolKey:{currency0:"0x322F0929c4625eD5bAd873c95208D54E1c003b2d",currency1:USDG,fee:3000,tickSpacing:60,hooks:NO_HOOK},
 source:"candidate",launchEnabled:false
},
{
 symbol:"NVDA",name:"NVIDIA",
 target:"0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
 quoteSymbol:"USDG",quote:USDG,
 targetFeed:"0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",quoteFeed:USDG_FEED,
 poolId:"0x6444a8e0b267406a15db74ca00c4a24bdfa81ed3180f5b6d0851f8ed6f4f29c5",
 poolKey:{currency0:USDG,currency1:"0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",fee:100,tickSpacing:1,hooks:NO_HOOK},
 source:"candidate",launchEnabled:false
}
];

export const EXECUTABLE_ROUTES=ROUTE_CATALOG.filter(r=>r.launchEnabled);
export const ROUTABLE_SYMBOLS=new Set(EXECUTABLE_ROUTES.map(r=>r.symbol));
