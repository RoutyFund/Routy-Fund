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
 source:"verified",launchEnabled:true
},
{
 symbol:"NVDA",name:"NVIDIA",
 target:"0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
 quoteSymbol:"USDG",quote:USDG,
 targetFeed:"0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",quoteFeed:USDG_FEED,
 poolId:"0x6444a8e0b267406a15db74ca00c4a24bdfa81ed3180f5b6d0851f8ed6f4f29c5",
 poolKey:{currency0:USDG,currency1:"0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",fee:100,tickSpacing:1,hooks:NO_HOOK},
 source:"verified",launchEnabled:true
}
,{
 symbol:"AMD",name:"AMD",target:"0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",quoteSymbol:"USDG",quote:USDG,targetFeed:"0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72",quoteFeed:USDG_FEED,poolId:"0xde9f85fdd9e05a943a52f2c69ffafe3064a3287df03d02c9b431bc92d4781274",poolKey:{currency0:USDG,currency1:"0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",fee:10000,tickSpacing:200,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"MSFT",name:"Microsoft",target:"0xe93237C50D904957Cf27E7B1133b510C669c2e74",quoteSymbol:"USDG",quote:USDG,targetFeed:"0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E",quoteFeed:USDG_FEED,poolId:"0x9194a557b6a6bb2236b49ea7e2bbccec5d3eeb705aef00903be4b3de1d949579",poolKey:{currency0:USDG,currency1:"0xe93237C50D904957Cf27E7B1133b510C669c2e74",fee:3000,tickSpacing:60,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"AMZN",name:"Amazon",target:"0x12f190a9F9d7D37a250758b26824B97CE941bF54",quoteSymbol:"USDG",quote:USDG,targetFeed:"0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C",quoteFeed:USDG_FEED,poolId:"0xd32646872e6712af8cf778e34b6bbef1d2ae0bddd83764e1b07333518ad59333",poolKey:{currency0:"0x12f190a9F9d7D37a250758b26824B97CE941bF54",currency1:USDG,fee:3000,tickSpacing:60,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"GOOGL",name:"Alphabet Class A",target:"0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",quoteSymbol:"USDG",quote:USDG,targetFeed:"0xF6f373a037c30F0e5010d854385cA89185AE638b",quoteFeed:USDG_FEED,poolId:"0xd4ecb79fdc521d7725d22b33ed43cb4e47aa96bfad76aa29577e3151f723ac5e",poolKey:{currency0:"0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",currency1:USDG,fee:3000,tickSpacing:60,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"META",name:"Meta Platforms",target:"0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",quoteSymbol:"USDG",quote:USDG,targetFeed:"0x7C38C00C30BEe9378381E7B6135d7283356D71b1",quoteFeed:USDG_FEED,poolId:"0x5875d407a42965b0e768c8925cea290e06fa50603ef34fc99eb92a1050e6ae36",poolKey:{currency0:USDG,currency1:"0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",fee:3000,tickSpacing:60,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"COIN",name:"Coinbase",target:"0x6330D8C3178a418788dF01a47479c0ce7CCF450b",quoteSymbol:"USDG",quote:USDG,targetFeed:"0xA3a468A452940B7D6b69991207B508c609a98Ef2",quoteFeed:USDG_FEED,poolId:"0x007a13fa152f6dc383cad20a8eaab4e1e2538b606936eae2a424f8aa47d6db31",poolKey:{currency0:USDG,currency1:"0x6330D8C3178a418788dF01a47479c0ce7CCF450b",fee:10000,tickSpacing:200,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"INTC",name:"Intel",target:"0xc72b96e0E48ecd4DC75E1e45396e26300BC39681",quoteSymbol:"USDG",quote:USDG,targetFeed:"0x3f390C5C24628Ac7C489515402235FeAD71D1913",quoteFeed:USDG_FEED,poolId:"0xf2e329e631d0fb315a5c563ee3a9120f24822b5ef6c502a91cb56b174d5d8c22",poolKey:{currency0:USDG,currency1:"0xc72b96e0E48ecd4DC75E1e45396e26300BC39681",fee:10000,tickSpacing:200,hooks:NO_HOOK},source:"verified",launchEnabled:true
},{
 symbol:"GME",name:"GameStop",target:"0x1b0E319c6A659F002271B69dB8A7df2F911c153E",quoteSymbol:"USDG",quote:USDG,targetFeed:"0x27C71df6A64fB476468EdF256CF72c038baB5B67",quoteFeed:USDG_FEED,poolId:"0x3d436b4fdc532c61a0bf15d6cae80a66eb8f28ee9daec34dbec4b5bc9964063b",poolKey:{currency0:"0x1b0E319c6A659F002271B69dB8A7df2F911c153E",currency1:USDG,fee:10000,tickSpacing:200,hooks:NO_HOOK},source:"verified",launchEnabled:true
}
];

export const EXECUTABLE_ROUTES=ROUTE_CATALOG.filter(r=>r.launchEnabled);
export const ROUTABLE_SYMBOLS=new Set(EXECUTABLE_ROUTES.map(r=>r.symbol));
