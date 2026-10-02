export type EthereumRequest = {
  method: string;
  params?: readonly unknown[];
};

export type EthereumProvider = {
  request<T = unknown>(request: EthereumRequest): Promise<T>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

// Keep wallet event methods optional so injected providers without EIP-1193 listeners still work.


export type EthereumTransactionReceipt = {
  status?: string;
  contractAddress?: string | null;
  gasUsed?: string;
};

export type EthereumTransaction = {
  from: string;
  to?: string | null;
  input: string;
  gas?: string;
};

function errorRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function nestedErrorMessage(value: unknown, depth = 0): string | undefined {
  if (depth > 3) return undefined;
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = errorRecord(value);
  if (!record) return undefined;
  for (const key of ["shortMessage", "message", "reason"] as const) {
    const message = record[key];
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  for (const key of ["data", "error", "cause"] as const) {
    const message = nestedErrorMessage(record[key], depth + 1);
    if (message) return message;
  }
  return undefined;
}

function nestedErrorCode(value: unknown, depth = 0): string | number | undefined {
  if (depth > 3) return undefined;
  const record = errorRecord(value);
  if (!record) return undefined;
  const code = record.code;
  if (typeof code === "string" || typeof code === "number") return code;
  for (const key of ["data", "error", "cause"] as const) {
    const nested = nestedErrorCode(record[key], depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export function walletErrorCode(value: unknown): string | number | undefined {
  return nestedErrorCode(value);
}

export function walletErrorMessage(value: unknown, fallback: string): string {
  const message = nestedErrorMessage(value);
  const code = walletErrorCode(value);
  if (!message) return fallback;
  return code === undefined ? message : `${message} (wallet code ${code})`;
}

export function walletRequestWasRejected(value: unknown): boolean {
  const code = walletErrorCode(value);
  if (code === 4001 || code === "4001") return true;
  const message = nestedErrorMessage(value)?.toLowerCase() || "";
  return message.includes("user rejected")
    || message.includes("user denied")
    || message.includes("request rejected")
    || message.includes("request denied")
    || message.includes("cancelled by user")
    || message.includes("canceled by user");
}

export function getInjectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}
