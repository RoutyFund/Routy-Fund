import {type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "./deployment";
import {PONS_V2} from "./pons";
import {type V5Configuration} from "./v5-deployment";

export const V5_CONFIG: V5Configuration = {
  owner: ROUTY_DEPLOYMENT.automationOperatorV4 as Address,
  operator: ROUTY_DEPLOYMENT.automationOperatorV4 as Address,
  treasury: ROUTY_DEPLOYMENT.treasury as Address,
  registry: ROUTY_DEPLOYMENT.assetRegistry as Address,
  ponsFactory: PONS_V2.factory, escrow: PONS_V2.feeEscrow,
  oracleRegistry: ROUTY_DEPLOYMENT.oracleRegistry as Address,
  oracleGuard: ROUTY_DEPLOYMENT.oracleGuard as Address,
  quoter: ROUTY_DEPLOYMENT.swapOracleQuoter as Address,
  adapter: ROUTY_DEPLOYMENT.swapRouterAdapter as Address,
};
