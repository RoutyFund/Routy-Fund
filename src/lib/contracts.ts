export const ROUTY_ABI={
 feeRouter:[{type:"function",name:"harvest",stateMutability:"nonpayable",inputs:[],outputs:[{name:"claimed",type:"uint256"}]}],
 vault:[{type:"function",name:"availableEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}],
 launcher:[{type:"function",name:"provision",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"},{name:"asset",type:"address"},{name:"policy",type:"uint8"}],outputs:[{name:"vault",type:"address"},{name:"router",type:"address"}]}],
 routerFactory:[{type:"function",name:"routerForToken",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{type:"address"}]}]
} as const;
export const addresses={launcher:process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS,registry:process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS} as const;