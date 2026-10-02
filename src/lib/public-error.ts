// viem transport messages may contain the RPC URL, including a private API key.
// Public endpoints expose a stable error code; details stay out of responses.
export function publicErrorMessage(error: unknown): string {
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)) return error.message;
  return "ONCHAIN_DATA_UNAVAILABLE";
}
