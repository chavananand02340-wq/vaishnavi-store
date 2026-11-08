"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { refreshStorefront } from "@/services/admin/auth";
import { AppError, errorMessage } from "@/lib/errors";

type Options<T> = {
  /** Toast on success (text, or built from the result). */
  success?: string | ((result: T) => string);
  /** Toast when it fails with an unexpected error. Errors we expect (AppError) show their own message. */
  failure?: string;
  /** Also refresh the cached store pages (catalogue / settings changed). */
  refreshStore?: boolean;
  /** Called after success, e.g. reload the list. */
  onSuccess?: (result: T) => void;
};

/**
 * Runs a panel action with consistent feedback:
 * busy flag → service call → success toast (+ store refresh) or error toast.
 * Resolves to true if it worked (the result goes to `onSuccess`). Never throws.
 *
 *   const { run, busy } = useAction();
 *   const saved = await run("save", () => updatePincode(pin, patch), { success: "Saved", onSuccess: reload });
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, o: Options<T> = {}): Promise<boolean> => {
      setBusy(key);
      try {
        const result = await fn();
        if (o.success) toast(typeof o.success === "function" ? o.success(result) : o.success);
        if (o.refreshStore) void refreshStorefront();
        o.onSuccess?.(result);
        return true;
      } catch (e) {
        if (!(e instanceof AppError) || e.status >= 500) console.error(`[action:${key}]`, e);
        const expected = e instanceof AppError && e.code !== "unknown";
        toast(expected ? e.message : (o.failure ?? errorMessage(e)), "error");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  return { run, busy, isBusy: busy !== null };
}
