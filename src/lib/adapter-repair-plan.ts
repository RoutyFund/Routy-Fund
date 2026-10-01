import { keccak256, type Address, type Hex } from "viem";
import { DEPLOY_BYTECODE } from "@/lib/deploy-artifacts";
import { buildDeterministicDeployment } from "@/lib/deploy-encoding";

export const ADAPTER_BYTECODE = DEPLOY_BYTECODE.SwapRouterAdapter as Hex;
export const ADAPTER_ARTIFACT_HASH = keccak256(ADAPTER_BYTECODE);
export const DETERMINISTIC_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address;
export const DETERMINISTIC_DEPLOYER_CODE = "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";
export const ADAPTER_DEPLOYMENT = buildDeterministicDeployment(
  DETERMINISTIC_DEPLOYER,
  ADAPTER_ARTIFACT_HASH,
  ADAPTER_BYTECODE,
);
export const ADAPTER_ADDRESS = ADAPTER_DEPLOYMENT.address;
