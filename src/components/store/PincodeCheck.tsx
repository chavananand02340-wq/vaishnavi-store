"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { Icon } from "@/components/Icon";

export const PIN_KEY = "vs-pin";

export function PincodeCheck() {
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const p = window.localStorage.getItem(PIN_KEY);
      if (p && /^\d{6}$/.test(p)) setSaved(p);
    } catch {
      /* ignore */
    }
  }, []);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setResult({ ok: false, text: "Enter a 6-digit PIN code." });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase().from("delivery_pincodes").select("pincode").eq("pincode", pin).eq("is_active", true).maybeSingle();
    setBusy(false);
    if (error) return setResult({ ok: false, text: "Couldn't check right now. Try again." });
    if (data) {
      try {
        window.localStorage.setItem(PIN_KEY, pin);
      } catch {
        /* ignore */
      }
      setSaved(pin);
      setResult(null);
    } else {
      setResult({ ok: false, text: `We don't deliver to ${pin} yet. Call or WhatsApp us to check.` });
    }
  }

  if (saved) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-700">
          <Icon name="pin" />
        </span>
        <p className="flex-1 text-[15px] leading-snug">
          <b>We deliver to {saved}</b>
          <br />
          <span className="text-muted">Your order reaches you in about half an hour.</span>
        </p>
        <button type="button" className="text-[14px] font-semibold text-leaf-700 underline" onClick={() => setSaved(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={check} className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line">
      <label htmlFor="pin" className="text-[15px] font-bold">Do we deliver to you?</label>
      <div className="mt-2 flex gap-2">
        <input
          id="pin"
          className="field py-2.5"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Your PIN code"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            setResult(null);
          }}
        />
        <button className="btn-leaf shrink-0" type="submit" disabled={busy || pin.length !== 6}>
          {busy ? "Checking" : "Check"}
        </button>
      </div>
      {result && <p className={`mt-2 text-[14px] ${result.ok ? "text-leaf-700" : "text-rose-700"}`} role="status">{result.text}</p>}
    </form>
  );
}
