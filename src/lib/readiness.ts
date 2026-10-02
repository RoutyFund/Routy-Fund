import {ROUTY_DEPLOYMENT,ROUTY_RELEASE_STATE} from "@/lib/deployment";
import {PONS_V2} from "@/lib/pons";
import {UNISWAP_ROBINHOOD} from "@/lib/uniswap";

export type Readiness={
 chain:boolean;
 rpc:boolean;
 treasury:boolean;
 launcher:boolean;
 registry:boolean;
 oracleRegistry:boolean;
 rewardDistributorFactory:boolean;
 feeRouterFactory:boolean;
 assetVaultFactory:boolean;
 oracleGuard:boolean;
 swapExecutor:boolean;
 swapOracleQuoter:boolean;
 swapRouterAdapter:boolean;
 swapAdapterCurrent:boolean;
 feeEscrow:boolean;
 uniswapPoolManager:boolean;
 uniswapRouter:boolean;
 permit2:boolean;
 maxPriceDeviation:boolean;
 swapExecutionEnabled:boolean;
};

const CHAIN_ID="4663";

function addressConfigured(value:string|undefined){
 return Boolean(value&&/^0x[0-9a-fA-F]{40}$/.test(value)&&!/^0x0{40}$/i.test(value));
}
function matchesAddress(value:string|undefined,expected:string){
 return addressConfigured(value)&&value!.toLowerCase()===expected.toLowerCase();
}
function configured(value:string|undefined,fallback:string){
 return addressConfigured(value||fallback);
}

export function serverReadiness():Readiness{
 const deviation=Number(process.env.MAX_PRICE_DEVIATION_BPS||"200");
 const rpcUrl=process.env.RPC_URL?.trim();
 return{
  chain:(process.env.NEXT_PUBLIC_CHAIN_ID||CHAIN_ID)===CHAIN_ID,
  rpc:Boolean(rpcUrl),
  treasury:configured(process.env.ROUTY_TREASURY_ADDRESS,ROUTY_DEPLOYMENT.treasury),
  launcher:configured(process.env.ROUTY_LAUNCHER_V4_ADDRESS,ROUTY_DEPLOYMENT.protocolLauncherV4),
  registry:configured(process.env.NEXT_PUBLIC_ROUTY_ASSET_REGISTRY_ADDRESS,ROUTY_DEPLOYMENT.assetRegistry),
  oracleRegistry:configured(process.env.ROUTY_ORACLE_REGISTRY_ADDRESS,ROUTY_DEPLOYMENT.oracleRegistry),
  rewardDistributorFactory:configured(process.env.ROUTY_REWARD_DISTRIBUTOR_FACTORY_V4_ADDRESS,ROUTY_DEPLOYMENT.rewardDistributorFactoryV4),
  feeRouterFactory:configured(process.env.ROUTY_FEE_ROUTER_FACTORY_V4_ADDRESS,ROUTY_DEPLOYMENT.feeRouterFactoryV4),
  assetVaultFactory:configured(process.env.ROUTY_ASSET_VAULT_FACTORY_V4_ADDRESS,ROUTY_DEPLOYMENT.assetVaultFactoryV4),
  oracleGuard:configured(process.env.ROUTY_ORACLE_GUARD_ADDRESS,ROUTY_DEPLOYMENT.oracleGuard),
  swapExecutor:configured(process.env.ROUTY_SWAP_EXECUTOR_V4_ADDRESS,ROUTY_DEPLOYMENT.swapExecutorV4),
  swapOracleQuoter:configured(process.env.ROUTY_SWAP_ORACLE_QUOTER_ADDRESS,ROUTY_DEPLOYMENT.swapOracleQuoter),
  swapRouterAdapter:configured(process.env.ROUTY_SWAP_ROUTER_ADAPTER_ADDRESS,ROUTY_DEPLOYMENT.swapRouterAdapter),
  swapAdapterCurrent:!ROUTY_RELEASE_STATE.swapAdapterRepairRequired,
  feeEscrow:configured(process.env.PONS_FEE_ESCROW_ADDRESS,PONS_V2.feeEscrow),
  uniswapPoolManager:matchesAddress(process.env.UNISWAP_V4_POOL_MANAGER||UNISWAP_ROBINHOOD.poolManager,UNISWAP_ROBINHOOD.poolManager),
  uniswapRouter:matchesAddress(process.env.UNISWAP_UNIVERSAL_ROUTER||UNISWAP_ROBINHOOD.universalRouter,UNISWAP_ROBINHOOD.universalRouter),
  permit2:matchesAddress(process.env.UNISWAP_PERMIT2||UNISWAP_ROBINHOOD.permit2,UNISWAP_ROBINHOOD.permit2),
  maxPriceDeviation:Number.isInteger(deviation)&&deviation>0&&deviation<=2000,
  // Runtime execution state is verified on-chain by /api/config and /api/health.
  // Do not mark infrastructure unready because of the retired legacy env flag.
  swapExecutionEnabled:true
 };
}

export function ready(r:Readiness){return Object.values(r).every(Boolean)}
export function blockers(r:Readiness){return Object.entries(r).filter(([,ok])=>!ok).map(([key])=>key)}
export function infrastructureReady(r:Readiness){
 return Object.entries(r).filter(([key])=>key!=="swapExecutionEnabled").every(([,ok])=>ok);
}
