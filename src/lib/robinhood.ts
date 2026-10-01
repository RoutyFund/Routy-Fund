export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_ASSETS_URL = "https://api.robinhood.com/rhj/assets";

export type RobinhoodAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  currentMultiplier: string;
  pendingMultiplier?: string;
  logoUrl?: string;
  status?: string;
  tradingCapabilities?: Record<string, unknown>;
  deployments?: Array<{ contractAddress: string; chainId: number }>;
};

export function getMainnetDeployment(asset: RobinhoodAsset) {
  return asset.deployments?.find((deployment) => deployment.chainId === ROBINHOOD_CHAIN_ID);
}

export function isCanonicalMainnetAsset(asset: RobinhoodAsset) {
  return asset.status === "ASSET_STATUS_ACTIVE" && Boolean(getMainnetDeployment(asset));
}
