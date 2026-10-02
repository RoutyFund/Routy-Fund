export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {cache: "no-store", ...options});
  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${response.status})`);
  }
  return data as T;
}
