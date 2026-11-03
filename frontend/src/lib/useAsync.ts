"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tiny data hook: runs `fn` on mount / when `deps` change and exposes loading + error + reload.
 * `deps` should be primitives (ids, filters) - they are compared by value.
 *
 * `loading` is DERIVED: it is true from the moment the deps (or a reload) change until the request for that
 * exact key settles. That means filter/page changes show the busy state immediately, without calling
 * setState synchronously inside an effect.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  // Always call the latest `fn` without making it an effect dependency.
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  const key = `${JSON.stringify(deps)}#${tick}`;
  const loading = settledKey !== key;

  useEffect(() => {
    let cancelled = false;
    fnRef.current()
      .then((result) => { if (!cancelled) { setData(result); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong."); })
      .finally(() => { if (!cancelled) setSettledKey(key); });
    return () => { cancelled = true; };
  }, [key]);

  /** Re-fetch. Resolves immediately; the hook's `loading` flag reflects progress. */
  const reload = useCallback(async () => { setTick((t) => t + 1); }, []);

  return { data, error, loading, reload, setData };
}
