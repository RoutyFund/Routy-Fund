import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

export const ROUTY_ABI={
 feeRouter:[{type:"function",name:"harvest",stateMutability:"nonpayable",inputs:[],outputs:[{name:"claimed",type:"uint256"}]}],
 vault:[{type:"function",name:"availableEarned",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}],
 launcher:[{type:"function",name:"provision",stateMutability:"nonpayable",inputs:[{name:"token",type:"address"},{name:"asset",type:"address"},{name:"policy",type:"uint8"}],outputs:[{name:"vault",type:"address"},{name:"router",type:"address"}]}],
 routerFactory:[{type:"function",name:"routerForToken",stateMutability:"view",inputs:[{name:"token",type:"address"}],outputs:[{type:"address"}]}]
} as const;

export const addresses={
 launcher:process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS||ROUTY_DEPLOYMENT.protocolLauncher,
 registry:process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.assetRegistry,
 oracleRegistry:process.env.ROUTY_ORACLE_REGISTRY_ADDRESS||ROUTY_DEPLOYMENT.oracleRegistry,
 feeRouterFactory:process.env.ROUTY_FEE_ROUTER_FACTORY_ADDRESS||ROUTY_DEPLOYMENT.feeRouterFactory,
 assetVaultFactory:process.env.ROUTY_ASSET_VAULT_FACTORY_ADDRESS||ROUTY_DEPLOYMENT.assetVaultFactory,
 oracleGuard:process.env.ROUTY_ORACLE_GUARD_ADDRESS||ROUTY_DEPLOYMENT.oracleGuard,
 swapExecutor:process.env.ROUTY_SWAP_EXECUTOR_ADDRESS||ROUTY_DEPLOYMENT.swapExecutor,
 swapOracleQuoter:process.env.ROUTY_SWAP_ORACLE_QUOTER_ADDRESS||ROUTY_DEPLOYMENT.swapOracleQuoter,
 swapRouterAdapter:process.env.ROUTY_SWAP_ROUTER_ADAPTER_ADDRESS||ROUTY_DEPLOYMENT.swapRouterAdapter
} as const;
