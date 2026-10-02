import {decodeFunctionResult, encodeDeployData, encodeFunctionData, isAddress, type Address, type Hex} from "viem";
import type {EthereumProvider, EthereumTransaction, EthereumTransactionReceipt} from "./ethereum-provider";

export const V5_STEPS = [
  {id: "controller", title: "Deploy reward controller", contract: "RewardAutomationController"},
  {id: "rewardFactory", title: "Deploy reward factory", contract: "RewardDistributorFactory"},
  {id: "vaultFactory", title: "Deploy vault factory", contract: "AssetVaultV2Factory"},
  {id: "routerFactory", title: "Deploy direct fee router factory", contract: "FeeRouterFactoryV5"},
  {id: "executor", title: "Deploy swap executor", contract: "SwapExecutor"},
  {id: "launcher", title: "Deploy V5 launcher", contract: "ProtocolLauncherV5"},
  {id: "bindReward", title: "Connect reward factory", contract: null},
  {id: "bindVault", title: "Connect vault factory", contract: null},
  {id: "bindRouter", title: "Connect fee router factory", contract: null},
  {id: "bindExecutor", title: "Connect swap executor", contract: null},
  {id: "configure", title: "Configure swap dependencies", contract: null},
] as const;
export type V5StepId = typeof V5_STEPS[number]["id"];
export type V5Record = {hash: Hex; address?: Address; requestedGas?: Hex};
export type V5Progress = Partial<Record<V5StepId, V5Record>>;
export type V5Configuration = {
  owner: Address; operator: Address; treasury: Address; registry: Address;
  ponsFactory: Address; escrow: Address; oracleRegistry: Address;
  oracleGuard: Address; quoter: Address; adapter: Address;
};
export type V5Transaction = {from: Address; to?: Address; data: Hex; value: "0x0"};
const constructor = (count: number) => [{type: "constructor", inputs: Array.from({length: count}, (_, i) => ({name: `address${i}`, type: "address"}))}] as const;
const launcherAbi = [{type: "function", name: "setLauncher", stateMutability: "nonpayable", inputs: [{name: "launcher_", type: "address"}], outputs: []}] as const;
const configureAbi = [{type: "function", name: "configureDependencies", stateMutability: "nonpayable", inputs: [
  {name: "registry_", type: "address"}, {name: "guard_", type: "address"},
  {name: "quoter_", type: "address"}, {name: "adapter_", type: "address"},
  {name: "deviation_", type: "uint16"},
], outputs: []}] as const;

export function validV5Address(value: unknown): value is Address {
  return typeof value === "string" && isAddress(value, {strict: false}) && !/^0x0{40}$/i.test(value);
}
export function parseV5Progress(value: unknown): V5Progress {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid deployment backup.");
  const object = value as Record<string, unknown>;
  const source = (object.steps ?? object) as Record<string, unknown>;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Invalid deployment steps.");
  const result: V5Progress = {};
  for (const {id} of V5_STEPS) {
    const record = source[id] as Partial<V5Record> | undefined;
    if (record === undefined) continue;
    if (!record || typeof record.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(record.hash)) throw new Error(`Invalid transaction hash for ${id}.`);
    if (record.address !== undefined && !validV5Address(record.address)) throw new Error(`Invalid contract address for ${id}.`);
    if (record.requestedGas !== undefined && !/^0x[0-9a-fA-F]+$/.test(record.requestedGas)) throw new Error(`Invalid gas limit for ${id}.`);
    result[id] = {hash: record.hash, ...(record.address ? {address: record.address} : {}), ...(record.requestedGas ? {requestedGas: record.requestedGas} : {})};
  }
  return result;
}
export function v5StepReady(id: V5StepId, verified: Partial<Record<V5StepId, boolean>>) {
  const index = V5_STEPS.findIndex(step => step.id === id);
  return index >= 0 && V5_STEPS.slice(0, index).every(step => verified[step.id] === true);
}
export function buildV5Transaction(
  id: V5StepId, progress: V5Progress, config: V5Configuration, bytecodes: Record<string, string>,
): V5Transaction {
  for (const [name, value] of Object.entries(config)) if (!validV5Address(value)) throw new Error(`Invalid ${name} address.`);
  const address = (step: V5StepId): Address => {
    const result = progress[step]?.address;
    if (!validV5Address(result)) throw new Error(`Verify ${step} first.`);
    return result;
  };
  const {owner, operator} = config;
  const step = V5_STEPS.find(item => item.id === id);
  if (!step) throw new Error("Unknown deployment step.");
  if (step.contract) {
    const args: Address[] = id === "controller" ? [owner, operator]
      : id === "rewardFactory" ? [owner, address("controller")]
      : id === "routerFactory" ? [owner, operator, config.escrow, config.treasury]
      : id === "launcher" ? [owner, operator, config.registry, config.ponsFactory, address("rewardFactory"), address("vaultFactory"), address("routerFactory"), address("executor")]
      : [owner];
    const bytecode = bytecodes[step.contract];
    if (!bytecode || !/^0x(?:[0-9a-fA-F]{2})+$/.test(bytecode)) throw new Error(`Missing bytecode for ${step.contract}.`);
    return {from: owner, data: encodeDeployData({abi: constructor(args.length), bytecode: bytecode as Hex, args}), value: "0x0"};
  }
  const target = id === "bindReward" ? "rewardFactory" : id === "bindVault" ? "vaultFactory" : id === "bindRouter" ? "routerFactory" : "executor";
  return {
    from: owner, to: address(target), value: "0x0",
    data: id === "configure"
      ? encodeFunctionData({abi: configureAbi, functionName: "configureDependencies", args: [config.oracleRegistry, config.oracleGuard, config.quoter, config.adapter, 200]})
      : encodeFunctionData({abi: launcherAbi, functionName: "setLauncher", args: [address("launcher")]}),
  };
}
export function assertV5Transaction(expected: V5Transaction, actual: {from: string; to?: string | null; input: string}, compatibleData: readonly Hex[] = []) {
  if (actual.from?.toLowerCase() !== expected.from.toLowerCase()
    || (actual.to || "").toLowerCase() !== (expected.to || "").toLowerCase()
    || (actual.input?.toLowerCase() !== expected.data.toLowerCase() && !compatibleData.some(data => data.toLowerCase() === actual.input?.toLowerCase()))) {
    throw new Error("Transaction does not match this deployment step. Check wallet, recipient and transaction data.");
  }
}

export const V5_WALLET_GAS_LIMIT = 1_200_000n;
export function v5GasLimit(estimate: Hex, deployment: boolean): Hex {
  const gas = BigInt(estimate);
  if (gas <= 0n) throw new Error("Invalid gas estimate.");
  if (gas > V5_WALLET_GAS_LIMIT) throw new Error("Gas estimate exceeds Bitget’s 1,200,000 limit. This transaction was not submitted.");
  const buffered = gas * 150n / 100n;
  const limit = deployment || buffered > V5_WALLET_GAS_LIMIT ? V5_WALLET_GAS_LIMIT : buffered;
  return ("0x" + limit.toString(16)) as Hex;
}

export type V5ReceiptCheck = {
  status: "pending" | "reverted" | "verified";
  hash: Hex; address?: Address; gasUsed?: string; gasLimit?: string;
  exhaustedGas?: boolean; walletReducedGas?: boolean;
};
const launcherReadAbi = [{type: "function", name: "launcher", stateMutability: "view", inputs: [], outputs: [{type: "address"}]}] as const;
const quantity = (value?: string) => value && /^0x[0-9a-fA-F]+$/.test(value) ? BigInt(value) : undefined;

export async function readV5Receipt(
  provider: EthereumProvider, id: V5StepId, progress: V5Progress,
  config: V5Configuration, bytecodes: Record<string, string>, compatibleBytecodes: Record<string, string> = {},
): Promise<V5ReceiptCheck> {
  const record = progress[id];
  if (!record) throw new Error("No transaction hash saved.");
  const receipt = await provider.request<EthereumTransactionReceipt | null>({method: "eth_getTransactionReceipt", params: [record.hash]});
  if (!receipt) return {status: "pending", hash: record.hash};
  const transaction = await provider.request<EthereumTransaction | null>({method: "eth_getTransactionByHash", params: [record.hash]});
  if (!transaction) throw new Error("Transaction could not be read. Check its receipt again.");
  const expected = buildV5Transaction(id, progress, config, bytecodes);
  // Retain exact checks for the factory version already submitted before its gas optimization.
  const compatibleData = id === "routerFactory" && compatibleBytecodes.FeeRouterFactoryV5
    ? [buildV5Transaction(id, progress, config, {...bytecodes, ...compatibleBytecodes}).data] : [];
  assertV5Transaction(expected, transaction, compatibleData);
  const gasUsed = quantity(receipt.gasUsed);
  const gasLimit = quantity(transaction.gas);
  const requested = quantity(record.requestedGas);
  const details = {
    hash: record.hash,
    gasUsed: gasUsed?.toString(), gasLimit: gasLimit?.toString(),
    exhaustedGas: gasLimit !== undefined && gasLimit > 0n && gasUsed === gasLimit,
    walletReducedGas: gasLimit !== undefined && requested !== undefined && gasLimit < requested,
  };
  const status = quantity(receipt.status);
  if (status === 0n) return {status: "reverted", ...details};
  if (status !== 1n) throw new Error("Receipt has no confirmed success status. Check again before continuing.");
  const address = expected.to || receipt.contractAddress;
  if (!validV5Address(address)) throw new Error("The receipt has no valid contract address.");
  const code = await provider.request<string>({method: "eth_getCode", params: [address, "latest"]});
  if (!code || code === "0x" || code === "0x0") throw new Error("No deployed contract found.");
  if (id.startsWith("bind")) {
    const data = encodeFunctionData({abi: launcherReadAbi, functionName: "launcher"});
    const result = await provider.request<Hex>({method: "eth_call", params: [{to: address, data}, "latest"]});
    const launcher = decodeFunctionResult({abi: launcherReadAbi, functionName: "launcher", data: result});
    if (launcher.toLowerCase() !== progress.launcher?.address?.toLowerCase()) throw new Error("On-chain launcher binding does not match.");
  }
  return {status: "verified", address, ...details};
}

export function receiptFailure(check: V5ReceiptCheck): string {
  if (check.status === "pending") return "Transaction is pending. Check its receipt again after confirmation.";
  if (check.status !== "reverted") return "";
  const gas = check.exhaustedGas
    ? ` Gas used ${Number(check.gasUsed).toLocaleString("en-US")} / ${Number(check.gasLimit).toLocaleString("en-US")} (100%); the gas limit may be too low.` : "";
  const wallet = check.walletReducedGas ? " The wallet sent a lower gas limit than Routy requested." : "";
  return "Transaction failed on-chain and cannot be verified." + gas + wallet + " Use Retry reverted transaction to submit the updated step. Earlier successful deployments are kept.";
}
