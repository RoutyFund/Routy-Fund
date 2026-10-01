export type EthereumRequest = {
  method: string;
  params?: readonly unknown[];
};

export type EthereumProvider = {
  request<T = unknown>(request: EthereumRequest): Promise<T>;
};

export type EthereumTransactionReceipt = {
  status?: string;
  contractAddress?: string | null;
};

export type EthereumTransaction = {
  from: string;
  to?: string | null;
  input: string;
};

export function getInjectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}
