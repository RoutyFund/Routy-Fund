export type Readiness={rpc:boolean,treasury:boolean,launcher:boolean,registry:boolean,oracleRegistry:boolean,feeRouterFactory:boolean,assetVaultFactory:boolean,oracleGuard:boolean,swapExecutor:boolean,feeEscrow:boolean};
export function serverReadiness():Readiness{return{
 rpc:Boolean(process.env.RPC_URL),treasury:Boolean(process.env.ROUTY_TREASURY_ADDRESS),
 launcher:Boolean(process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS),registry:Boolean(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS),
 oracleRegistry:Boolean(process.env.ROUTY_ORACLE_REGISTRY_ADDRESS),feeRouterFactory:Boolean(process.env.ROUTY_FEE_ROUTER_FACTORY_ADDRESS),
 assetVaultFactory:Boolean(process.env.ROUTY_ASSET_VAULT_FACTORY_ADDRESS),oracleGuard:Boolean(process.env.ROUTY_ORACLE_GUARD_ADDRESS),
 swapExecutor:Boolean(process.env.ROUTY_SWAP_EXECUTOR_ADDRESS),feeEscrow:Boolean(process.env.PONS_FEE_ESCROW_ADDRESS)}}
export function ready(r:Readiness){return Object.values(r).every(Boolean)}