"use client";
import {useCallback, useEffect, useState} from "react";
import {fetchJson} from "@/lib/fetch-json";

export function useApiResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchJson<T>(url, {signal});
      if (!signal?.aborted) setData(result);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Data unavailable");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {window.clearTimeout(timer); controller.abort();};
  }, [load]);
  return {data, loading, error, reload: () => load()};
}
