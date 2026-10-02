import {encodeDeployData, encodeFunctionData, isAddress, type Address, type Hex} from "viem";

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
export type V5Record = {hash: Hex; address?: Address};
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
    result[id] = {hash: record.hash, ...(record.address ? {address: record.address} : {})};
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
export function assertV5Transaction(expected: V5Transaction, actual: {from: string; to?: string | null; input: string}) {
  if (actual.from?.toLowerCase() !== expected.from.toLowerCase()
    || (actual.to || "").toLowerCase() !== (expected.to || "").toLowerCase()
    || actual.input?.toLowerCase() !== expected.data.toLowerCase()) {
    throw new Error("Transaction does not match this deployment step. Check wallet, recipient and transaction data.");
  }
}
