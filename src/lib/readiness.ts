export type Readiness={chain:boolean,rpc:boolean,treasury:boolean,launcher:boolean,registry:boolean,oracleRegistry:boolean,feeRouterFactory:boolean,assetVaultFactory:boolean,oracleGuard:boolean,swapExecutor:boolean,feeEscrow:boolean,uniswapPoolManager:boolean,uniswapRouter:boolean,permit2:boolean,maxPriceDeviation:boolean,swapExecutionEnabled:boolean};
const CHAIN_ID="4663";
const POOL_MANAGER="0x8366a39cc670b4001a1121b8f6a443a643e40951";
const UNIVERSAL_ROUTER="0x204faca1764b154221e35c0d20abb3c525710498";
const PERMIT2="0x000000000022d473030f116ddee9f6b43ac78ba3";
function addressConfigured(value:string|undefined){return Boolean(value&&/^0x[0-9a-fA-F]{40}$/.test(value)&&!/^0x0{40}$/i.test(value))}
function matchesAddress(value:string|undefined,expected:string){return addressConfigured(value)&&value!.toLowerCase()===expected}
export function serverReadiness():Readiness{
 const deviation=Number(process.env.MAX_PRICE_DEVIATION_BPS);
 return{
 chain:process.env.NEXT_PUBLIC_CHAIN_ID===CHAIN_ID,
 rpc:Boolean(process.env.RPC_URL?.trim()),treasury:addressConfigured(process.env.ROUTY_TREASURY_ADDRESS),
 launcher:addressConfigured(process.env.NEXT_PUBLIC_ROUTY_LAUNCHER_ADDRESS),registry:addressConfigured(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS),
 oracleRegistry:addressConfigured(process.env.ROUTY_ORACLE_REGISTRY_ADDRESS),feeRouterFactory:addressConfigured(process.env.ROUTY_FEE_ROUTER_FACTORY_ADDRESS),
 assetVaultFactory:addressConfigured(process.env.ROUTY_ASSET_VAULT_FACTORY_ADDRESS),oracleGuard:addressConfigured(process.env.ROUTY_ORACLE_GUARD_ADDRESS),
 swapExecutor:addressConfigured(process.env.ROUTY_SWAP_EXECUTOR_ADDRESS),feeEscrow:addressConfigured(process.env.PONS_FEE_ESCROW_ADDRESS),
 uniswapPoolManager:matchesAddress(process.env.UNISWAP_V4_POOL_MANAGER,POOL_MANAGER),
 uniswapRouter:matchesAddress(process.env.UNISWAP_UNIVERSAL_ROUTER,UNIVERSAL_ROUTER),permit2:matchesAddress(process.env.UNISWAP_PERMIT2,PERMIT2),
 maxPriceDeviation:Number.isInteger(deviation)&&deviation>0&&deviation<=2000,
 swapExecutionEnabled:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true"
 }
}
export function ready(r:Readiness){return Object.values(r).every(Boolean)}
export function blockers(r:Readiness){return Object.entries(r).filter(([,ok])=>!ok).map(([key])=>key)}