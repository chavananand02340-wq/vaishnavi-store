"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";

/**
 * Loads data for a screen: runs `fn` on mount and whenever `deps` change.
 *  - `error` is a readable message (from AppError, or a generic "check your internet").
 *  - `reload()` refetches quietly (keeps showing the old data meanwhile).
 *  - Out-of-date answers are ignored, so fast filter changes can't show stale results.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    try {
      const result = await fnRef.current();
      if (mine === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(errorMessage(e, "Could not load. Check your internet."));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => run(true), setData };
}
