import {
  concatHex,
  encodeDeployData,
  encodeFunctionData,
  getCreate2Address,
  isAddress,
  type Address,
  type Hex,
} from "viem";

export const DEPLOYMENT_STEP_IDS = [
  "assetRegistry",
  "oracleRegistry",
  "swapExecutor",
  "oracleGuard",
  "swapOracleQuoter",
  "swapRouterAdapter",
  "feeRouterFactory",
  "assetVaultFactory",
  "protocolLauncher",
  "feeRouterLauncher",
  "assetVaultLauncher",
  "swapExecutorLauncher",
  "swapDependencies",
] as const;

export type DeploymentStatus = "pending" | "awaiting wallet signature" | "submitted" | "confirmed" | "failed";
export type DeployableContract = "AssetRegistry" | "OracleRegistry" | "SwapExecutor" | "OracleGuard" | "SwapOracleQuoter" | "SwapRouterAdapter" | "FeeRouterFactory" | "AssetVaultFactory" | "ProtocolLauncher";
export type WalletTransactionRequest = {
  from: Address;
  to: Address;
  data: Hex;
  gas: Hex;
};
export type DeterministicDeployment = {
  address: Address;
  data: Hex;
};

const addressConstructor = [{ type: "constructor", inputs: [{ name: "owner_", type: "address" }] }] as const;
const oracleGuardConstructor = [{ type: "constructor", inputs: [{ name: "maxAge_", type: "uint256" }] }] as const;
const launcherConstructor = [{
  type: "constructor",
  inputs: [
    { name: "registry_", type: "address" },
    { name: "ponsFactory_", type: "address" },
    { name: "vaultFactory_", type: "address" },
    { name: "routerFactory_", type: "address" },
    { name: "feeEscrow_", type: "address" },
    { name: "treasury_", type: "address" },
    { name: "executor_", type: "address" },
  ],
}] as const;

const setLauncherAbi = [{
  type: "function",
  name: "setLauncher",
  stateMutability: "nonpayable",
  inputs: [{ name: "launcher_", type: "address" }],
  outputs: [],
}] as const;

const configureDependenciesAbi = [{
  type: "function",
  name: "configureDependencies",
  stateMutability: "nonpayable",
  inputs: [
    { name: "oracleRegistry_", type: "address" },
    { name: "oracleGuard_", type: "address" },
    { name: "oracleQuoter_", type: "address" },
    { name: "routerAdapter_", type: "address" },
    { name: "maxDeviationBps_", type: "uint16" },
  ],
  outputs: [],
}] as const;

function assertAddress(value: unknown): asserts value is Address {
  if (typeof value !== "string" || !isAddress(value) || value === "0x0000000000000000000000000000000000000000") {
    throw new Error("Constructor/function arguments must be non-zero EVM addresses.");
  }
}

function assertHexBytes(value: unknown, label: string): asserts value is Hex {
  if (typeof value !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error(`${label} must be non-empty, even-length hexadecimal bytes.`);
  }
}

export function encodeDeployment(contract: DeployableContract, bytecode: Hex, args: readonly unknown[]): Hex {
  if (typeof bytecode !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(bytecode)) {
    throw new Error(`Missing deployment bytecode for ${contract}.`);
  }
  switch (contract) {
    case "AssetRegistry":
    case "OracleRegistry":
    case "SwapExecutor":
    case "FeeRouterFactory":
    case "AssetVaultFactory":
      if (args.length !== 1) throw new Error(`${contract} expects one constructor address.`);
      assertAddress(args[0]);
      return encodeDeployData({ bytecode, abi: addressConstructor, args: [args[0]] });
    case "SwapOracleQuoter":
    case "SwapRouterAdapter":
      if (args.length !== 0) throw new Error(`${contract} expects no constructor arguments.`);
      return encodeDeployData({ bytecode, abi: [] });
    case "OracleGuard":
      if (args.length !== 1 || typeof args[0] !== "bigint" || args[0] <= 0n) throw new Error("OracleGuard expects a positive maxAge.");
      return encodeDeployData({ bytecode, abi: oracleGuardConstructor, args: [args[0]] });
    case "ProtocolLauncher":
      if (args.length !== 7) throw new Error("ProtocolLauncher expects seven constructor addresses.");
      args.forEach(assertAddress);
      return encodeDeployData({
        bytecode,
        abi: launcherConstructor,
        args: args as [Address, Address, Address, Address, Address, Address, Address],
      });
  }
}

export function buildDeterministicDeployment(
  deployer: Address,
  salt: Hex,
  bytecode: Hex,
): DeterministicDeployment {
  assertAddress(deployer);
  if (!/^0x[0-9a-f]{64}$/i.test(salt)) {
    throw new Error("CREATE2 salt must be exactly 32 bytes.");
  }
  assertHexBytes(bytecode, "Deployment bytecode");
  return {
    address: getCreate2Address({ from: deployer, salt, bytecode }),
    data: concatHex([salt, bytecode]),
  };
}

export function encodeSetLauncher(launcher: Address): Hex {
  assertAddress(launcher);
  return encodeFunctionData({ abi: setLauncherAbi, functionName: "setLauncher", args: [launcher] });
}

export function encodeExecutorConfigureDependencies(
  args: readonly [Address, Address, Address, Address, number],
): Hex {
  args.slice(0, 4).forEach(assertAddress);
  if (!Number.isInteger(args[4]) || args[4] <= 0 || args[4] > 2000) {
    throw new Error("maxDeviationBps must be between 1 and 2000.");
  }
  return encodeFunctionData({
    abi: configureDependenciesAbi,
    functionName: "configureDependencies",
    args: [...args],
  });
}

export function buildRepairTransaction(
  from: Address,
  data: Hex,
  to: Address,
  gas: Hex,
): WalletTransactionRequest {
  assertAddress(from);
  assertAddress(to);
  assertHexBytes(data, "Transaction data");
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(gas)) {
    throw new Error("Gas limit must be a canonical hexadecimal quantity.");
  }
  return {
    from,
    to,
    gas,
    data,
  };
}

export function canSubmitStep(statuses: readonly DeploymentStatus[], index: number): boolean {
  return index >= 0
    && index < statuses.length
    && (statuses[index] === "pending" || statuses[index] === "failed")
    && statuses.slice(0, index).every((status) => status === "confirmed");
}

export function canCheckStep(statuses: readonly DeploymentStatus[], index: number): boolean {
  return index >= 0
    && index < statuses.length
    && statuses[index] === "submitted"
    && statuses.slice(0, index).every((status) => status === "confirmed");
}
