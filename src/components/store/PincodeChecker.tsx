"use client";

import { useEffect, useState, useTransition } from "react";
import { checkPincode } from "@/app/(store)/actions";

export const PIN_KEY = "vs-pin";

export function PincodeChecker({ compact = false }: { compact?: boolean }) {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PIN_KEY);
      if (saved && /^\d{6}$/.test(saved)) setPin(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function check(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await checkPincode(pin);
      setResult(r);
      if (r.ok) {
        try {
          window.localStorage.setItem(PIN_KEY, pin);
        } catch {
          /* ignore */
        }
      }
    });
  }

  return (
    <form onSubmit={check} className={compact ? "" : "rounded-xl border border-brand-100 bg-brand-50 p-3"}>
      {!compact && <p className="mb-2 text-sm font-semibold text-brand-800">Check delivery to your area</p>}
      <div className="flex gap-2">
        <input
          className="field py-2"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Enter PIN code"
          aria-label="PIN code"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setResult(null);
          }}
        />
        <button className="btn-primary shrink-0" type="submit" disabled={pin.length !== 6 || pending}>
          {pending ? "…" : "Check"}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-sm ${result.ok ? "text-brand-700" : "text-red-700"}`} role="status">
          {result.ok ? "✓ " : ""}
          {result.message}
        </p>
      )}
    </form>
  );
}
